import { html, render } from '@umbraco-cms/backoffice/external/lit';
import { umbHttpClient } from '@umbraco-cms/backoffice/http-client';
import { createEmptySnapshot, snapshotFromJson, type SchemaSnapshot } from '@az-umbraco-preview/core';
import { createMockApi } from './api/mock-api.js';
import { UprHostElement, type HostBootstrap } from './host.element.js';
import { isRenderMessage, type RenderMessage, type RendererMessage } from './protocol.js';
import './views/data-type-preview.element.js';
import './views/content-type-preview.element.js';

export interface RendererOptions extends HostBootstrap {
	major: number;
}

const PREVIEW_ROUTE = 'preview';

let currentApi = createMockApi(createEmptySnapshot());

function post(message: RendererMessage) {
	if (window.parent !== window) window.parent.postMessage(message, '*');
}

export async function renderEntity(target: HTMLElement, message: RenderMessage, snapshot: SchemaSnapshot) {
	currentApi = createMockApi(snapshot);
	const { entity, diff } = message;
	let view: HTMLElement;
	if (entity.entityType === 'data-type') {
		const el = document.createElement('upr-data-type-preview');
		el.dataType = snapshot.dataTypes.get(entity.key);
		el.snapshot = snapshot;
		el.diff = diff?.entityType === 'data-type' ? diff : null;
		view = el;
	} else {
		const el = document.createElement('upr-content-type-preview');
		el.contentType = snapshot.contentTypes.get(entity.key);
		el.snapshot = snapshot;
		el.diff = diff?.entityType === 'content-type' ? diff : null;
		view = el;
	}
	// Editors such as Block List register modal routes (catalogue, block workspace), which need a route context, so
	// the view is mounted as the route component of a router slot, as a workspace would be.
	// A fresh host per render resets every store, so values cached for a previous entity can't leak in.
	render(html``, target);
	render(html`<upr-host><umb-router-slot></umb-router-slot></upr-host>`, target);
	// A root router-slot only navigates when routes are added while it is connected, so set them after first render.
	const slot = target.querySelector('umb-router-slot')!;
	await slot.updateComplete;
	slot.routes = [{ path: '', component: () => view }];
}

/** Boots a renderer page. `onMessage` lets dev/Storybook pages drive it without a parent frame. */
export function startRenderer(options: RendererOptions, target: HTMLElement = document.body) {
	UprHostElement.bootstrap = options;
	// The router resolves paths against the document's directory and needs a non-empty base for modal routes
	// (`<base>/modal/...`), like the backoffice's `/umbraco`. Swap the file name (index.html) for a virtual
	// `preview` segment; navigation is client-side only, so the path never hits the server.
	history.replaceState(null, '', location.pathname.replace(/[^/]*$/, '') + PREVIEW_ROUTE + '/' + location.search);
	umbHttpClient.setConfig({
		baseUrl: '',
		fetch: (input: RequestInfo | URL, init?: RequestInit) => currentApi(input, init),
	} as never);

	const handle = (message: RenderMessage) => {
		try {
			document.documentElement.dataset.theme = message.theme ?? 'light';
			renderEntity(target, message, snapshotFromJson(message.snapshot));
		} catch (e) {
			post({ type: 'upr:error', message: (e as Error).message });
			throw e;
		}
	};

	window.addEventListener('message', (event) => {
		if (event.source !== window.parent || !isRenderMessage(event.data)) return;
		handle(event.data);
	});

	new ResizeObserver(() => post({ type: 'upr:resize', height: document.documentElement.scrollHeight })).observe(
		document.body,
	);
	post({ type: 'upr:ready', major: options.major });
	return { render: handle };
}

export type { RenderMessage } from './protocol.js';
