import type {
	ContentTypeKind,
	SchemaContainer,
	SchemaContentType,
	SchemaProperty,
	SchemaRef,
	SchemaSnapshot,
	SourceRef,
} from '../model.js';
import { EMPTY_GUID, emptyToNull, normaliseKey, parseIntOr, stripBom, udiEntityType, variations } from '../util.js';

type Artifact = Record<string, any>;

const CONTENT_TYPE_KIND: Record<string, ContentTypeKind> = {
	'document-type': 'document',
	'media-type': 'media',
	'member-type': 'member',
};

/** Deploy's `PropertyGroupType` enum: Group = 0 (omitted when default), Tab = 1. */
function groupType(value: unknown): 'Tab' | 'Group' {
	return value === 1 || value === 'Tab' ? 'Tab' : 'Group';
}

function refs(udis: unknown): SchemaRef[] {
	if (!Array.isArray(udis)) return [];
	return udis
		.map((u): { key: string | null; alias: string | null } => ({ key: normaliseKey(typeof u === 'string' ? u : u?.Udi), alias: null }))
		.filter((r): r is SchemaRef => !!r.key);
}

/** Parses one Deploy `.uda` artifact into the snapshot. Unsupported entity types are ignored. */
export function parseDeployFile(path: string, content: string, snapshot: SchemaSnapshot): void {
	let artifact: Artifact;
	try {
		artifact = JSON.parse(stripBom(content));
	} catch (e) {
		snapshot.issues.push({ path, message: `Invalid JSON: ${(e as Error).message}` });
		return;
	}
	const source: SourceRef = { format: 'deploy', path };
	const entityType = udiEntityType(artifact.Udi);
	const key = normaliseKey(artifact.Udi);
	if (!entityType || !key) {
		snapshot.issues.push({ path, message: 'Artifact has no Udi' });
		return;
	}

	if (entityType === 'data-type') {
		snapshot.dataTypes.set(key, {
			key,
			name: artifact.Name ?? key,
			editorAlias: artifact.EditorAlias ?? '',
			editorUiAlias: emptyToNull(artifact.EditorUiAlias),
			config:
				artifact.Configuration && typeof artifact.Configuration === 'object' ? artifact.Configuration : {},
			folder: normaliseKey(artifact.Parent),
			source,
		});
		return;
	}

	if (entityType === 'template') {
		snapshot.templates.set(key, { key, alias: artifact.Alias ?? '', name: artifact.Name ?? '', source });
		return;
	}

	if (entityType.endsWith('-container')) {
		snapshot.folders.set(key, { key, name: artifact.Name ?? '', parentKey: normaliseKey(artifact.Parent), source });
		return;
	}

	const kind = CONTENT_TYPE_KIND[entityType];
	if (kind) parseContentType(artifact, kind, key, source, snapshot);
}

function parseContentType(
	a: Artifact,
	kind: ContentTypeKind,
	key: string,
	source: SourceRef,
	snapshot: SchemaSnapshot,
): void {
	const containers: SchemaContainer[] = [];
	const properties: SchemaProperty[] = [];

	const addProperties = (list: Artifact[] | undefined, containerKey: string | null) => {
		for (const p of list ?? []) {
			const pv = variations(p.Variations);
			properties.push({
				key: normaliseKey(p.Key) ?? `${key}:${p.Alias}`,
				alias: p.Alias ?? '',
				name: p.Name ?? '',
				description: emptyToNull(p.Description),
				dataTypeKey: normaliseKey(p.DataType) ?? '',
				editorAlias: null,
				containerKey,
				sortOrder: parseIntOr(p.SortOrder),
				mandatory: p.Mandatory === true,
				mandatoryMessage: emptyToNull(p.MandatoryMessage),
				regEx: emptyToNull(p.Validation),
				regExMessage: emptyToNull(p.ValidationMessage ?? p.ValidationRegExpMessage),
				labelOnTop: p.LabelOnTop === true,
				variesByCulture: pv.culture,
				variesBySegment: pv.segment,
			});
		}
	};

	for (const g of (a.PropertyGroups ?? []) as Artifact[]) {
		const gKey = normaliseKey(g.Key) ?? `${key}:${g.Alias}`;
		containers.push({
			key: gKey,
			name: g.Name ?? '',
			alias: g.Alias ?? '',
			type: groupType(g.Type),
			sortOrder: parseIntOr(g.SortOrder),
			parentKey: null,
		});
		addProperties(g.PropertyTypes, gKey);
	}
	// Properties outside any group (rare, but valid).
	addProperties(a.PropertyTypes, null);

	const byAlias = new Map(containers.map((c) => [c.alias, c]));
	for (const c of containers) {
		const slash = c.alias.lastIndexOf('/');
		if (slash > 0) c.parentKey = byAlias.get(c.alias.slice(0, slash))?.key ?? null;
	}

	const vary = variations(a.Variations);
	const perms = a.Permissions ?? {};
	const listView = normaliseKey(a.ListView);
	const defaultTemplate = normaliseKey(a.DefaultTemplate);
	// `Parent` is either a folder (`*-container`) or, for inherited types, the parent content type.
	const parentKey = normaliseKey(a.Parent);
	const parentIsFolder = udiEntityType(a.Parent)?.endsWith('-container') ?? false;
	const compositions = refs(a.CompositionContentTypes).map((r) => ({ ...r, inheritance: false }));
	if (parentKey && !parentIsFolder && !compositions.some((c) => c.key === parentKey))
		compositions.unshift({ key: parentKey, alias: null, inheritance: true });

	const contentType: SchemaContentType = {
		kind,
		key,
		alias: a.Alias ?? '',
		name: a.Name ?? a.Alias ?? key,
		description: emptyToNull(a.Description),
		icon: a.Icon ?? 'icon-document',
		isElement: perms.IsElementType === true || a.IsElement === true,
		allowedAtRoot: perms.AllowedAtRoot === true,
		variesByCulture: vary.culture,
		variesBySegment: vary.segment,
		folder: parentIsFolder ? parentKey : null,
		listView: listView && listView !== EMPTY_GUID ? listView : null,
		compositions,
		allowedChildren: refs(perms.AllowedChildContentTypes),
		allowedTemplates: refs(a.AllowedTemplates),
		defaultTemplate: defaultTemplate ? { key: defaultTemplate, alias: null } : null,
		containers,
		properties,
		source,
	};
	snapshot.contentTypes.set(key, contentType);
}
