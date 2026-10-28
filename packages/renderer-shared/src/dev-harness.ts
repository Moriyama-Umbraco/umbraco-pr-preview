/**
 * Renderer-only dev page: renders one side of one fixture entity in-page (no shell, no iframe), for working on the
 * views against the real backoffice. `?set=usync|deploy&side=base|head&key=<guid>`.
 */
import { buildSnapshot, diffSnapshots, snapshotToJson, type SchemaFile } from '@az-umbraco-preview/core';
import { startRenderer, type RendererOptions } from './app.js';

const raw = import.meta.glob('../../../fixtures/{usync,deploy}/{base,head}/**/*.{config,uda}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

function files(set: string, side: string): SchemaFile[] {
	const prefix = `../../../fixtures/${set}/${side}/`;
	return Object.entries(raw)
		.filter(([p]) => p.startsWith(prefix))
		.map(([p, content]) => ({ path: '/' + p.slice(prefix.length), content }));
}

export function startDevHarness(options: RendererOptions) {
	const params = new URLSearchParams(location.search);
	const set = params.get('set') ?? 'usync';
	const side = (params.get('side') ?? 'head') as 'base' | 'head';
	const base = buildSnapshot(files(set, 'base'));
	const head = buildSnapshot(files(set, 'head'));
	const diff = diffSnapshots(base, head);
	const key = params.get('key') ?? diff.entities[0]?.key;

	const nav = document.createElement('nav');
	nav.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;font:13px sans-serif';
	for (const s of ['usync', 'deploy'])
		for (const sd of ['base', 'head'])
			nav.insertAdjacentHTML('beforeend', `<a href="?set=${s}&side=${sd}&key=${key}">${s}/${sd}</a>`);
	nav.insertAdjacentHTML('beforeend', ' | ');
	for (const e of diff.entities)
		nav.insertAdjacentHTML(
			'beforeend',
			`<a href="?set=${set}&side=${side}&key=${e.key}" style="${e.key === key ? 'font-weight:bold' : ''}">${e.name} (${e.status})</a>`,
		);
	document.body.prepend(nav);

	const target = document.createElement('main');
	document.body.append(target);
	const renderer = startRenderer(options, target);
	const entity = diff.entities.find((e) => e.key === key);
	if (!entity) return;
	renderer.render({
		type: 'upr:render',
		side,
		snapshot: snapshotToJson(side === 'base' ? base : head),
		entity: { entityType: entity.entityType, key: entity.key },
		diff: entity,
	});
}
