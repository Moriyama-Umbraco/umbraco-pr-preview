#!/usr/bin/env node
/**
 * Pins a renderer's backoffice peer dependencies (and their companion packages, e.g. every @tiptap/* extension)
 * to the exact versions in Umbraco.Web.UI.Client's package-lock.json for that release.
 *
 * The published @umbraco-cms/backoffice declares loose peer ranges (e.g. monaco-editor >=0.55.1 <1.0.0), but its
 * dist imports deep paths that move between minor versions, so the renderer must match what Umbraco built against.
 *
 * Usage: node scripts/pin-backoffice-peers.mjs <renderer-dir> <path-to-Umbraco.Web.UI.Client/package-lock.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [rendererDir, lockPath] = process.argv.slice(2);
if (!rendererDir || !lockPath) {
	console.error('Usage: pin-backoffice-peers.mjs <renderer-dir> <umbraco-package-lock.json>');
	process.exit(1);
}

const lock = JSON.parse(readFileSync(lockPath, 'utf8')).packages;
const pkgPath = join(rendererDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const backoffice = JSON.parse(readFileSync(join(rendererDir, 'node_modules/@umbraco-cms/backoffice/package.json'), 'utf8'));

/**
 * Version of `name` in the Umbraco lockfile. A copy nested under the backoffice's own `src/**` workspaces wins
 * (the top-level one can belong to a dev tool, e.g. `diff@5` for ts-node), then the top-level install.
 */
function lockedVersion(name) {
	const own = Object.entries(lock).find(([k]) => k.startsWith('src/') && k.endsWith(`/node_modules/${name}`));
	if (own) return own[1].version;
	return lock[`node_modules/${name}`]?.version;
}

const wanted = new Set(Object.keys(backoffice.peerDependencies ?? {}));
// Families whose sub-packages the backoffice imports directly although only the umbrella is a peer.
const families = ['@tiptap/'];
for (const key of Object.keys(lock)) {
	const m = /node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(key);
	if (m && families.some((f) => m[1].startsWith(f))) wanted.add(m[1]);
}

const skip = new Set(['@hey-api/openapi-ts', '@types/diff']);
pkg.dependencies ??= {};
const changes = [];
for (const name of [...wanted].sort()) {
	if (skip.has(name)) continue;
	const version = lockedVersion(name);
	if (!version) continue;
	if (pkg.dependencies[name] !== version) changes.push(`${name}: ${pkg.dependencies[name] ?? '-'} → ${version}`);
	pkg.dependencies[name] = version;
}
pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(changes.length ? changes.join('\n') : 'Already pinned.');
