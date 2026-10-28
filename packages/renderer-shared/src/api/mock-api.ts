/**
 * In-memory Management API answering the read-only schema endpoints the property editors call, served from a
 * snapshot of repository files. Wired into the backoffice's hey-api client via `setConfig({ fetch })`, so no
 * service worker is needed inside the Azure DevOps iframe.
 */
import {
	toContentTypeItem,
	toDataType,
	toDataTypeItem,
	toDocumentType,
	toMediaType,
	type SchemaContentType,
	type SchemaSnapshot,
} from '@az-umbraco-preview/core';

const API = '/umbraco/management/api/v1/';

type Handler = (match: RegExpExecArray, ids: string[]) => unknown;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const paged = (items: unknown[]) => ({ total: items.length, items });

export function createMockApi(snapshot: SchemaSnapshot) {
	const contentTypes = (kind: SchemaContentType['kind']) =>
		[...snapshot.contentTypes.values()].filter((c) => c.kind === kind);
	const byIds = <T>(ids: string[], get: (id: string) => T | undefined) =>
		ids.map(get).filter((x): x is T => x !== undefined);
	const contentType = (kind: SchemaContentType['kind'], id: string) => {
		const ct = snapshot.contentTypes.get(id);
		return ct?.kind === kind ? ct : undefined;
	};
	const docType = (id: string) => {
		const ct = contentType('document', id);
		return ct && toDocumentType(ct);
	};
	const mediaType = (id: string) => {
		const ct = contentType('media', id);
		return ct && toMediaType(ct);
	};

	const routes: [RegExp, Handler][] = [
		[/^data-type\/batch$/, (_, ids) => paged(byIds(ids, (id) => maybe(snapshot.dataTypes.get(id), toDataType)))],
		[/^item\/data-type$/, (_, ids) => byIds(ids, (id) => maybe(snapshot.dataTypes.get(id), toDataTypeItem))],
		[/^data-type\/([0-9a-f-]{36})$/, (m) => maybe(snapshot.dataTypes.get(m[1]), toDataType)],

		[/^document-type\/batch$/, (_, ids) => paged(byIds(ids, docType))],
		[/^item\/document-type$/, (_, ids) => byIds(ids, (id) => maybe(contentType('document', id), toContentTypeItem))],
		[/^document-type\/([0-9a-f-]{36})$/, (m) => docType(m[1])],
		[/^document-type\/allowed-at-root$/, () => paged(contentTypes('document').filter((c) => c.allowedAtRoot).map(toContentTypeItem))],

		[/^media-type\/batch$/, (_, ids) => paged(byIds(ids, mediaType))],
		[/^item\/media-type$/, (_, ids) => byIds(ids, (id) => maybe(contentType('media', id), toContentTypeItem))],
		[/^item\/media-type\/allowed$/, () => paged(contentTypes('media').map(toContentTypeItem))],
		[/^media-type\/([0-9a-f-]{36})$/, (m) => mediaType(m[1])],

		[/^item\/member-type$/, (_, ids) => byIds(ids, (id) => maybe(contentType('member', id), toContentTypeItem))],
		[
			/^item\/template$/,
			(_, ids) => byIds(ids, (id) => maybe(snapshot.templates.get(id), (t) => ({ id: t.key, name: t.name, alias: t.alias }))),
		],

		// Static backoffice configuration some editors read on connect.
		[/^(document|media|member)-type\/configuration$/, () => ({ dataTypesCanBeChanged: 'True', disableTemplates: false, useSegments: false, reservedFieldNames: [] })],
		[/^data-type\/configuration$/, () => ({ canBeChanged: 'True', documentListViewId: '', mediaListViewId: '' })],
		[/^language$/, () => paged([{ isoCode: 'en-US', name: 'English (United States)', isDefault: true, isMandatory: true, fallbackIsoCode: null }])],
		[/^item\/language$/, () => [{ isoCode: 'en-US', name: 'English (United States)' }]],
	];

	return async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		const request = input instanceof Request ? input : new Request(input, init);
		const url = new URL(request.url, location.href);
		const at = url.pathname.indexOf(API);
		if (at === -1) return fetch(request);

		const path = url.pathname.slice(at + API.length).replace(/\/$/, '');
		if (request.method !== 'GET') return json({ title: 'Read-only preview' }, 405);

		const ids = url.searchParams.getAll('id').map((id) => id.toLowerCase());
		if (import.meta.env.DEV) console.debug('[upr-api]', path, ids.join(','));
		for (const [pattern, handler] of routes) {
			const m = pattern.exec(path);
			if (!m) continue;
			const body = handler(m, ids);
			return body === undefined ? json({ title: 'Not found in this commit' }, 404) : json(body);
		}
		// Trees, searches, references, users… nothing to show in a schema preview.
		return json(paged([]));
	};
}

function maybe<T, R>(value: T | undefined, map: (v: T) => R): R | undefined {
	return value === undefined ? undefined : map(value);
}
