import { buildSnapshot, classifyPath, detectUmbracoMajor, diffSnapshots, type SchemaFile, type VersionHints } from '@az-umbraco-preview/core';
import type { ComparisonData } from './model.js';

export function buildComparison(input: {
	title: string;
	baseFiles: SchemaFile[];
	headFiles: SchemaFile[];
	changedPaths: string[];
	versionHints?: VersionHints;
}): ComparisonData {
	const base = buildSnapshot(input.baseFiles);
	const head = buildSnapshot(input.headFiles);
	const diff = diffSnapshots(base, head);

	const covered = new Set<string>();
	for (const e of diff.entities) {
		if (e.before) covered.add(e.before.source.path);
		if (e.after) covered.add(e.after.source.path);
	}
	for (const t of head.tombstones) covered.add(t.source.path);
	const unmatchedPaths = input.changedPaths.filter((p) => classifyPath(p) && !covered.has(p));

	const major = detectUmbracoMajor({
		...input.versionHints,
		schemaPaths: [...(input.versionHints?.schemaPaths ?? []), ...input.changedPaths],
		deployArtifacts: [
			...(input.versionHints?.deployArtifacts ?? []),
			...input.headFiles.filter((f) => f.path.endsWith('.uda')).slice(0, 1).map((f) => f.content),
		],
	});

	return {
		title: input.title,
		base,
		head,
		diff,
		baseFiles: new Map(input.baseFiles.map((f) => [f.path, f.content])),
		headFiles: new Map(input.headFiles.map((f) => [f.path, f.content])),
		unmatchedPaths,
		major,
	};
}
