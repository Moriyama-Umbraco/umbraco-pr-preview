import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SchemaFile } from '../src/index.js';

export const FIXTURES = join(import.meta.dirname, '..', '..', '..', 'fixtures');

/** Reads every file under `fixtures/<set>/<side>` as repository-relative SchemaFiles. */
export function loadFixture(set: 'usync' | 'deploy', side: 'base' | 'head'): SchemaFile[] {
	const root = join(FIXTURES, set, side);
	const out: SchemaFile[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) walk(full);
			else out.push({ path: '/src/Web/' + relative(root, full).replace(/\\/g, '/'), content: readFileSync(full, 'utf8') });
		}
	};
	walk(root);
	return out;
}
