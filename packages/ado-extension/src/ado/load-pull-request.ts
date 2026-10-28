import * as SDK from 'azure-devops-extension-sdk';
import { getClient, type IHostNavigationService } from 'azure-devops-extension-api';
import {
	GitObjectType,
	GitRestClient,
	GitVersionType,
	VersionControlChangeType,
	VersionControlRecursionType,
	type GitItem,
	type GitPullRequest,
} from 'azure-devops-extension-api/Git';
import { unzipSync, strFromU8 } from 'fflate';
import { classifyPath, schemaRootOf, type SchemaFile } from '@az-umbraco-preview/core';
import { buildComparison } from '../comparison.js';
import type { ComparisonData } from '../model.js';

const CHANGES_PAGE = 1000;

/** `CommonServiceIds.HostNavigationService` (a const enum, so not importable under isolatedModules). */
const HOST_NAVIGATION_SERVICE = 'ms.vss-features.host-navigation-service';

/** Finds the PR id for the tab: contribution configuration first, then the host page route. */
async function currentPullRequestId(): Promise<number> {
	const config = SDK.getConfiguration() as { pullRequestId?: number; pullRequest?: { pullRequestId?: number } };
	const fromConfig = config.pullRequestId ?? config.pullRequest?.pullRequestId;
	if (fromConfig) return Number(fromConfig);

	const nav = await SDK.getService<IHostNavigationService>(HOST_NAVIGATION_SERVICE);
	const route = await nav.getPageRoute();
	const values = route.routeValues as Record<string, string | undefined>;
	const id = Number(values.parameters ?? values.pullRequestId);
	if (!id) throw new Error('Could not determine the pull request id for this tab.');
	return id;
}

async function changedPaths(git: GitRestClient, pr: GitPullRequest, iterationId: number): Promise<string[]> {
	const repo = pr.repository.id;
	const project = pr.repository.project.id;
	const paths: string[] = [];
	for (let skip = 0; ; skip += CHANGES_PAGE) {
		const page = await git.getPullRequestIterationChanges(repo, pr.pullRequestId, iterationId, project, CHANGES_PAGE, skip);
		for (const entry of page.changeEntries ?? []) {
			const item = entry.item as { path?: string } | undefined;
			if (item?.path) paths.push(item.path);
			// Renames: include the old path so the base side of the file is loaded too.
			const source = (entry as { sourceServerItem?: string }).sourceServerItem;
			if (source && entry.changeType & VersionControlChangeType.Rename) paths.push(source);
		}
		if ((page.changeEntries?.length ?? 0) < CHANGES_PAGE) break;
	}
	return [...new Set(paths)];
}

/** Downloads every file under `root` at `commit` in two requests (tree listing + blob zip). */
async function filesAt(git: GitRestClient, repo: string, project: string, root: string, commit: string): Promise<SchemaFile[]> {
	let items: GitItem[];
	try {
		items = await git.getItems(repo, project, root, VersionControlRecursionType.Full, false, false, false, false, {
			version: commit,
			versionType: GitVersionType.Commit,
			versionOptions: 0,
		});
	} catch {
		return []; // Folder doesn't exist on this side (e.g. schema added in this PR).
	}
	const blobs = items.filter((i) => i.gitObjectType === GitObjectType.Blob && classifyPath(i.path));
	if (!blobs.length) return [];

	const zip = unzipSync(new Uint8Array(await git.getBlobsZip(blobs.map((b) => b.objectId), repo, project)));
	return blobs.flatMap((b) => {
		const data = zip[b.objectId];
		return data ? [{ path: b.path, content: strFromU8(data) }] : [];
	});
}

/** `Directory.Packages.props` and `*.csproj` files above the schema roots, for Umbraco version detection. */
async function projectFiles(git: GitRestClient, repo: string, project: string, roots: string[], commit: string): Promise<string[]> {
	const dirs = new Set<string>();
	for (const root of roots) {
		const parts = root.split('/').filter(Boolean);
		for (let i = parts.length - 1; i >= 0; i--) dirs.add('/' + parts.slice(0, i).join('/'));
	}
	const version = { version: commit, versionType: GitVersionType.Commit, versionOptions: 0 };
	const out: string[] = [];
	for (const dir of dirs) {
		try {
			const items = await git.getItems(repo, project, dir, VersionControlRecursionType.OneLevel, false, false, false, false, version);
			for (const item of items) {
				if (item.isFolder || !/(Directory\.Packages\.props|\.csproj)$/i.test(item.path)) continue;
				out.push(await git.getItemText(repo, item.path, project, undefined, undefined, false, false, false, version));
			}
		} catch {
			/* ignore missing folders */
		}
		if (out.some((f) => /Include="Umbraco\.Cms"/i.test(f))) break;
	}
	return out;
}

export async function loadPullRequest(onStatus: (status: string) => void): Promise<ComparisonData> {
	const git = getClient(GitRestClient);
	const prId = await currentPullRequestId();
	onStatus(`Loading pull request ${prId}…`);
	const pr = await git.getPullRequestById(prId);
	const repo = pr.repository.id;
	const project = pr.repository.project.id;

	const iterations = await git.getPullRequestIterations(repo, prId, project);
	const last = iterations.at(-1);
	if (!last) throw new Error('This pull request has no iterations yet.');
	const baseCommit = last.commonRefCommit?.commitId ?? pr.lastMergeTargetCommit?.commitId;
	const headCommit = last.sourceRefCommit?.commitId ?? pr.lastMergeSourceCommit?.commitId;
	if (!baseCommit || !headCommit) throw new Error('Could not determine the commits to compare.');

	onStatus('Finding changed Umbraco schema files…');
	const paths = await changedPaths(git, pr, last.id!);
	const roots = [...new Set(paths.map(schemaRootOf).filter((r): r is string => !!r))];
	const schemaPaths = paths.filter((p) => classifyPath(p));
	if (!roots.length) {
		return buildComparison({ title: pr.title, baseFiles: [], headFiles: [], changedPaths: [] });
	}

	onStatus(`Loading schema from ${roots.length} folder(s)…`);
	const [baseFiles, headFiles, csproj] = await Promise.all([
		Promise.all(roots.map((r) => filesAt(git, repo, project, r, baseCommit))).then((f) => f.flat()),
		Promise.all(roots.map((r) => filesAt(git, repo, project, r, headCommit))).then((f) => f.flat()),
		projectFiles(git, repo, project, roots, headCommit),
	]);

	return buildComparison({
		title: pr.title,
		baseFiles,
		headFiles,
		changedPaths: schemaPaths,
		versionHints: { projectFiles: csproj },
	});
}
