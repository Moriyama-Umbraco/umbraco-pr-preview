/** Normalised, format-agnostic view of an Umbraco schema at a single commit. All keys are lower-case dashed GUIDs. */

export type SourceFormat = 'usync' | 'deploy';

export type ContentTypeKind = 'document' | 'media' | 'member';

export type EntityType = 'data-type' | 'content-type' | 'template' | 'folder';

export interface SourceRef {
	format: SourceFormat;
	path: string;
}

export interface SchemaDataType {
	key: string;
	name: string;
	editorAlias: string;
	editorUiAlias: string | null;
	config: Record<string, unknown>;
	/** Folder path, e.g. "Block Lists/Custom" (uSync) or a folder key (Deploy). */
	folder: string | null;
	source: SourceRef;
}

export interface SchemaContainer {
	key: string;
	name: string;
	/** Full alias, e.g. "content/settings" for a group inside the "content" tab. */
	alias: string;
	type: 'Tab' | 'Group';
	sortOrder: number;
	parentKey: string | null;
}

export interface SchemaProperty {
	key: string;
	alias: string;
	name: string;
	description: string | null;
	dataTypeKey: string;
	/** Present in uSync only; Deploy requires resolving the data type. */
	editorAlias: string | null;
	containerKey: string | null;
	sortOrder: number;
	mandatory: boolean;
	mandatoryMessage: string | null;
	regEx: string | null;
	regExMessage: string | null;
	labelOnTop: boolean;
	variesByCulture: boolean;
	variesBySegment: boolean;
}

export interface SchemaRef {
	key: string;
	alias: string | null;
}

export interface SchemaComposition extends SchemaRef {
	/** True when this is the parent ("master") content type rather than a mixin composition. */
	inheritance: boolean;
}

export interface SchemaContentType {
	kind: ContentTypeKind;
	key: string;
	alias: string;
	name: string;
	description: string | null;
	icon: string;
	isElement: boolean;
	allowedAtRoot: boolean;
	variesByCulture: boolean;
	variesBySegment: boolean;
	folder: string | null;
	listView: string | null;
	compositions: SchemaComposition[];
	allowedChildren: SchemaRef[];
	allowedTemplates: SchemaRef[];
	defaultTemplate: SchemaRef | null;
	containers: SchemaContainer[];
	properties: SchemaProperty[];
	source: SourceRef;
}

export interface SchemaTemplate {
	key: string;
	alias: string;
	name: string;
	source: SourceRef;
}

export interface SchemaFolder {
	key: string;
	name: string;
	parentKey: string | null;
	source: SourceRef;
}

/** A uSync `<Empty Change="Delete|Rename"/>` marker. */
export interface SchemaTombstone {
	key: string;
	alias: string;
	change: string;
	entityType: EntityType;
	source: SourceRef;
}

export interface ParseIssue {
	path: string;
	message: string;
}

export interface SchemaSnapshot {
	dataTypes: Map<string, SchemaDataType>;
	contentTypes: Map<string, SchemaContentType>;
	templates: Map<string, SchemaTemplate>;
	folders: Map<string, SchemaFolder>;
	tombstones: SchemaTombstone[];
	issues: ParseIssue[];
}

export interface SchemaFile {
	path: string;
	content: string;
}

export function createEmptySnapshot(): SchemaSnapshot {
	return {
		dataTypes: new Map(),
		contentTypes: new Map(),
		templates: new Map(),
		folders: new Map(),
		tombstones: [],
		issues: [],
	};
}
