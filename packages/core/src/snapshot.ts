import { createEmptySnapshot, type SchemaFile, type SchemaSnapshot, type SourceFormat } from './model.js';
import { parseDeployFile } from './parsers/deploy.js';
import { parseUSyncFile } from './parsers/usync.js';

/** Build output, runtime copies and agent worktrees that duplicate the real schema files. */
const EXCLUDED = /(^|\/)(bin|obj|node_modules|TEMP|\.git|\.claude)\//i;

const USYNC = /(^|\/)uSync\/v\d+\/(DataTypes|ContentTypes|MediaTypes|MemberTypes|Templates)\/[^/]+\.config$/i;
const DEPLOY =
	/(^|\/)Deploy\/Revision\/(data-type|document-type|media-type|member-type|template|document-type-container|data-type-container|media-type-container)__[0-9a-f]{32}\.uda$/i;

function toPosix(path: string): string {
	return path.replace(/\\/g, '/');
}

/** Returns which schema format a repository path belongs to, or null when it isn't a schema file we render. */
export function classifyPath(path: string): SourceFormat | null {
	const p = toPosix(path);
	if (EXCLUDED.test(p)) return null;
	if (USYNC.test(p)) return 'usync';
	if (DEPLOY.test(p)) return 'deploy';
	return null;
}

/** The folder whose full contents are needed to resolve references, e.g. `/src/Web/uSync/v17` or `/src/Web/umbraco/Deploy/Revision`. */
export function schemaRootOf(path: string): string | null {
	const p = toPosix(path);
	const usync = /^(.*?\/?uSync\/v\d+)\//i.exec(p);
	if (usync && classifyPath(p) === 'usync') return usync[1];
	const deploy = /^(.*?\/?Deploy\/Revision)\//i.exec(p);
	if (deploy && classifyPath(p) === 'deploy') return deploy[1];
	return null;
}

export function buildSnapshot(files: Iterable<SchemaFile>): SchemaSnapshot {
	const snapshot = createEmptySnapshot();
	for (const file of files) {
		const format = classifyPath(file.path);
		if (format === 'usync') parseUSyncFile(toPosix(file.path), file.content, snapshot);
		else if (format === 'deploy') parseDeployFile(toPosix(file.path), file.content, snapshot);
	}
	return snapshot;
}
