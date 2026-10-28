/** Local harness: the compare shell over the synthetic fixtures, with renderers from their Vite dev servers. */
import type { SchemaFile } from '@az-umbraco-preview/core';
import { buildComparison } from './comparison.js';
import './compare/compare-app.element.js';

const raw = import.meta.glob('../../../fixtures/{usync,deploy}/{base,head}/**/*.{config,uda}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

function files(set: string, side: string): SchemaFile[] {
	const prefix = `../../../fixtures/${set}/${side}/`;
	return Object.entries(raw)
		.filter(([p]) => p.startsWith(prefix))
		.map(([p, content]) => ({ path: '/src/Web/' + p.slice(prefix.length), content }));
}

const set = new URLSearchParams(location.search).get('set') ?? 'usync';
const baseFiles = files(set, 'base');
const headFiles = files(set, 'head');
const changed = new Set<string>();
const baseMap = new Map(baseFiles.map((f) => [f.path, f.content]));
const headMap = new Map(headFiles.map((f) => [f.path, f.content]));
for (const p of new Set([...baseMap.keys(), ...headMap.keys()])) if (baseMap.get(p) !== headMap.get(p)) changed.add(p);

const app = document.querySelector('upr-compare-app')!;
// Built renderers served by `npm run preview` in renderers/vXX: two iframes of unbundled dev modules exhaust
// the browser's connection budget.
// `?renderer=<base url>` points both majors at a packaged layout instead, e.g. the ado-extension dist served by
// `npx vite preview` (http://localhost:4173/) to check the VSIX's nested renderer paths.
const packaged = new URLSearchParams(location.search).get('renderer');
app.rendererUrls = packaged
	? { 17: new URL('renderer-v17/index.html', packaged).href, 18: new URL('renderer-v18/index.html', packaged).href }
	: { 17: 'http://localhost:5172/index.html', 18: 'http://localhost:5173/index.html' };
app.data = buildComparison({ title: `Fixtures: ${set}`, baseFiles, headFiles, changedPaths: [...changed] });
