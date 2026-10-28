import { XMLParser } from 'fast-xml-parser';
import type {
	ContentTypeKind,
	EntityType,
	SchemaContainer,
	SchemaContentType,
	SchemaDataType,
	SchemaProperty,
	SchemaRef,
	SchemaSnapshot,
	SourceRef,
} from '../model.js';
import { EMPTY_GUID, emptyToNull, normaliseKey, parseBool, parseIntOr, stripBom, variations } from '../util.js';

const ARRAY_TAGS = new Set(['GenericProperty', 'Tab', 'Composition', 'Template', 'ContentType', 'MediaType']);

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	parseTagValue: false,
	parseAttributeValue: false,
	trimValues: true,
	isArray: (name, jpath) => {
		// `ContentType` is both a root element and a child of `<Structure>`; only the latter is a list.
		if (name === 'ContentType' || name === 'MediaType') return /\.Structure\./.test(String(jpath));
		// `Tab` is a list under `<Tabs>` but a single reference inside `<GenericProperty>`.
		if (name === 'Tab') return /\.Tabs\.Tab$/.test(String(jpath));
		return ARRAY_TAGS.has(name);
	},
});

type XmlNode = Record<string, any>;

function text(node: unknown): string | null {
	if (node === undefined || node === null) return null;
	if (typeof node === 'object') return emptyToNull((node as XmlNode)['#text']);
	return emptyToNull(node);
}

function decodeFolder(value: string | null): string | null {
	if (!value) return null;
	try {
		return decodeURIComponent(value.replace(/\+/g, ' '));
	} catch {
		return value;
	}
}

function refList(nodes: XmlNode[] | undefined): SchemaRef[] {
	return (nodes ?? [])
		.map((n) => ({ key: normaliseKey(n?.['@_Key']), alias: text(n) }))
		.filter((r): r is SchemaRef => !!r.key);
}

function parseJson(raw: string | null, path: string, snapshot: SchemaSnapshot): Record<string, unknown> {
	if (!raw) return {};
	try {
		const value = JSON.parse(raw);
		return value && typeof value === 'object' && !Array.isArray(value) ? value : { value };
	} catch {
		snapshot.issues.push({ path, message: 'DataType <Config> is not valid JSON' });
		return { raw };
	}
}

const ROOT_KIND: Record<string, ContentTypeKind> = {
	ContentType: 'document',
	MediaType: 'media',
	MemberType: 'member',
};

function folderEntityType(path: string): EntityType {
	if (/\/DataTypes\//i.test(path)) return 'data-type';
	if (/\/Templates\//i.test(path)) return 'template';
	return 'content-type';
}

/** Parses one uSync `.config` file into the snapshot. Unsupported roots are ignored. */
export function parseUSyncFile(path: string, content: string, snapshot: SchemaSnapshot): void {
	let doc: XmlNode;
	try {
		doc = parser.parse(stripBom(content));
	} catch (e) {
		snapshot.issues.push({ path, message: `Invalid XML: ${(e as Error).message}` });
		return;
	}
	const source: SourceRef = { format: 'usync', path };

	if (doc.Empty) {
		const key = normaliseKey(doc.Empty['@_Key']);
		if (key)
			snapshot.tombstones.push({
				key,
				alias: doc.Empty['@_Alias'] ?? '',
				change: doc.Empty['@_Change'] ?? 'Delete',
				entityType: folderEntityType(path),
				source,
			});
		return;
	}

	if (doc.DataType) return parseDataType(doc.DataType, source, snapshot);
	if (doc.Template) return parseTemplate(doc.Template, source, snapshot);
	for (const [root, kind] of Object.entries(ROOT_KIND)) {
		if (doc[root]) return parseContentType(doc[root], kind, source, snapshot);
	}
}

function parseDataType(node: XmlNode, source: SourceRef, snapshot: SchemaSnapshot): void {
	const key = normaliseKey(node['@_Key']);
	if (!key) return void snapshot.issues.push({ path: source.path, message: 'DataType has no Key' });
	const info = node.Info ?? {};
	const dataType: SchemaDataType = {
		key,
		name: text(info.Name) ?? node['@_Alias'] ?? key,
		editorAlias: text(info.EditorAlias) ?? '',
		editorUiAlias: text(info.EditorUIAlias),
		config: parseJson(text(node.Config), source.path, snapshot),
		folder: decodeFolder(text(info.Folder)),
		source,
	};
	snapshot.dataTypes.set(key, dataType);
}

function parseTemplate(node: XmlNode, source: SourceRef, snapshot: SchemaSnapshot): void {
	const key = normaliseKey(node['@_Key']);
	if (!key) return;
	const alias = node['@_Alias'] ?? '';
	snapshot.templates.set(key, { key, alias, name: text(node.Name) ?? alias, source });
}

function parseContentType(node: XmlNode, kind: ContentTypeKind, source: SourceRef, snapshot: SchemaSnapshot): void {
	const key = normaliseKey(node['@_Key']);
	if (!key) return void snapshot.issues.push({ path: source.path, message: 'Content type has no Key' });
	const info = node.Info ?? {};
	const vary = variations(text(info.Variations));

	const tabs: XmlNode[] = node.Tabs?.Tab ?? [];
	const containers: SchemaContainer[] = tabs.map((t) => ({
		key: normaliseKey(text(t.Key)) ?? `${key}:${text(t.Alias)}`,
		name: text(t.Caption) ?? '',
		alias: text(t.Alias) ?? '',
		type: text(t.Type) === 'Tab' ? 'Tab' : 'Group',
		sortOrder: parseIntOr(text(t.SortOrder)),
		parentKey: null,
	}));
	const byAlias = new Map(containers.map((c) => [c.alias, c]));
	for (const c of containers) {
		// Groups nested in a tab are aliased "<tabAlias>/<groupAlias>".
		const slash = c.alias.lastIndexOf('/');
		if (slash > 0) c.parentKey = byAlias.get(c.alias.slice(0, slash))?.key ?? null;
	}

	const props: XmlNode[] = node.GenericProperties?.GenericProperty ?? [];
	const properties: SchemaProperty[] = props.map((p) => {
		const pv = variations(text(p.Variations));
		return {
			key: normaliseKey(text(p.Key)) ?? `${key}:${text(p.Alias)}`,
			alias: text(p.Alias) ?? '',
			name: text(p.Name) ?? '',
			description: text(p.Description),
			dataTypeKey: normaliseKey(text(p.Definition)) ?? '',
			editorAlias: text(p.Type),
			containerKey: byAlias.get(p.Tab?.['@_Alias'] ?? '')?.key ?? null,
			sortOrder: parseIntOr(text(p.SortOrder)),
			mandatory: parseBool(text(p.Mandatory)),
			mandatoryMessage: text(p.MandatoryMessage),
			regEx: text(p.Validation),
			regExMessage: text(p.ValidationRegExpMessage),
			labelOnTop: parseBool(text(p.LabelOnTop)),
			variesByCulture: pv.culture,
			variesBySegment: pv.segment,
		};
	});

	const allowedTemplates = refList(info.AllowedTemplates?.Template);
	const defaultAlias = text(info.DefaultTemplate);
	const defaultTemplate = defaultAlias
		? (allowedTemplates.find((t) => t.alias === defaultAlias) ?? { key: '', alias: defaultAlias })
		: null;
	const listView = normaliseKey(text(info.ListView));
	const compositions = refList(info.Compositions?.Composition).map((r) => ({ ...r, inheritance: false }));
	const parentKey = normaliseKey(info.Parent?.['@_Key']);
	if (parentKey && !compositions.some((c) => c.key === parentKey))
		compositions.unshift({ key: parentKey, alias: text(info.Parent), inheritance: true });

	const contentType: SchemaContentType = {
		kind,
		key,
		alias: node['@_Alias'] ?? '',
		name: text(info.Name) ?? node['@_Alias'] ?? key,
		description: text(info.Description),
		icon: text(info.Icon) ?? 'icon-document',
		isElement: parseBool(text(info.IsElement)),
		allowedAtRoot: parseBool(text(info.AllowAtRoot)),
		variesByCulture: vary.culture,
		variesBySegment: vary.segment,
		folder: decodeFolder(text(info.Folder)),
		listView: listView && listView !== EMPTY_GUID ? listView : null,
		compositions,
		allowedChildren: refList(node.Structure?.ContentType ?? node.Structure?.MediaType),
		allowedTemplates,
		defaultTemplate,
		containers,
		properties,
		source,
	};
	snapshot.contentTypes.set(key, contentType);
}
