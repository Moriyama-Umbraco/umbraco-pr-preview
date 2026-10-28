/**
 * Maps a SchemaSnapshot onto the Umbraco Management API response models (v17/v18), so the real backoffice
 * repositories and editors can be fed from repository files. Shapes mirror
 * `src/packages/core/backend-api/types.gen.ts` in Umbraco.Web.UI.Client; they are re-declared here to keep
 * this package free of the backoffice dependency.
 */
import type { SchemaContentType, SchemaDataType, SchemaSnapshot } from './model.js';

interface Ref {
	id: string;
}

export interface MgmtDataType {
	id: string;
	name: string;
	editorAlias: string;
	editorUiAlias: string;
	values: { alias: string; value: unknown }[];
	isDeletable: boolean;
	canIgnoreStartNodes: boolean;
}

export interface MgmtDataTypeItem {
	id: string;
	flags: [];
	name: string;
	editorUiAlias: string | null;
	editorAlias: string;
	isDeletable: boolean;
}

export interface MgmtContentTypeProperty {
	id: string;
	container: Ref | null;
	sortOrder: number;
	alias: string;
	name: string;
	description: string | null;
	dataType: Ref;
	variesByCulture: boolean;
	variesBySegment: boolean;
	validation: { mandatory: boolean; mandatoryMessage: string | null; regEx: string | null; regExMessage: string | null };
	appearance: { labelOnTop: boolean };
}

export interface MgmtContentTypeContainer {
	id: string;
	parent: Ref | null;
	name: string | null;
	type: 'Tab' | 'Group';
	sortOrder: number;
}

export interface MgmtDocumentType {
	id: string;
	alias: string;
	name: string;
	description: string | null;
	icon: string;
	allowedAsRoot: boolean;
	variesByCulture: boolean;
	variesBySegment: boolean;
	collection: Ref | null;
	isElement: boolean;
	properties: MgmtContentTypeProperty[];
	containers: MgmtContentTypeContainer[];
	allowedTemplates: Ref[];
	defaultTemplate: Ref | null;
	cleanup: { preventCleanup: boolean; keepAllVersionsNewerThanDays: null; keepLatestVersionPerDayForDays: null };
	allowedDocumentTypes: { documentType: Ref; sortOrder: number }[];
	compositions: { documentType: Ref; compositionType: 'Composition' | 'Inheritance' }[];
}

export interface MgmtMediaType extends Omit<MgmtDocumentType, 'allowedTemplates' | 'defaultTemplate' | 'cleanup' | 'allowedDocumentTypes' | 'compositions'> {
	aliasCanBeChanged: boolean;
	allowedMediaTypes: { mediaType: Ref; sortOrder: number }[];
	compositions: { mediaType: Ref; compositionType: 'Composition' | 'Inheritance' }[];
}

export interface MgmtContentTypeItem {
	id: string;
	flags: [];
	name: string;
	isElement: boolean;
	icon: string | null;
	description: string | null;
}

/** Fallback UI aliases for data types that pre-date `editorUiAlias` being serialised. */
const DEFAULT_UI_ALIAS: Record<string, string> = {
	'Umbraco.BlockGrid': 'Umb.PropertyEditorUi.BlockGrid',
	'Umbraco.BlockList': 'Umb.PropertyEditorUi.BlockList',
	'Umbraco.CheckBoxList': 'Umb.PropertyEditorUi.CheckBoxList',
	'Umbraco.ColorPicker': 'Umb.PropertyEditorUi.ColorPicker',
	'Umbraco.ContentPicker': 'Umb.PropertyEditorUi.DocumentPicker',
	'Umbraco.DateTime': 'Umb.PropertyEditorUi.DatePicker',
	'Umbraco.Decimal': 'Umb.PropertyEditorUi.Decimal',
	'Umbraco.DropDown.Flexible': 'Umb.PropertyEditorUi.Dropdown',
	'Umbraco.EmailAddress': 'Umb.PropertyEditorUi.Email',
	'Umbraco.Integer': 'Umb.PropertyEditorUi.Integer',
	'Umbraco.Label': 'Umb.PropertyEditorUi.Label',
	'Umbraco.ListView': 'Umb.PropertyEditorUi.Collection',
	'Umbraco.MediaPicker3': 'Umb.PropertyEditorUi.MediaPicker',
	'Umbraco.MultiNodeTreePicker': 'Umb.PropertyEditorUi.ContentPicker',
	'Umbraco.MultipleTextstring': 'Umb.PropertyEditorUi.MultipleTextString',
	'Umbraco.MultiUrlPicker': 'Umb.PropertyEditorUi.MultiUrlPicker',
	'Umbraco.RadioButtonList': 'Umb.PropertyEditorUi.RadioButtonList',
	'Umbraco.RichText': 'Umb.PropertyEditorUi.Tiptap',
	'Umbraco.Slider': 'Umb.PropertyEditorUi.Slider',
	'Umbraco.Tags': 'Umb.PropertyEditorUi.Tags',
	'Umbraco.TextArea': 'Umb.PropertyEditorUi.TextArea',
	'Umbraco.TextBox': 'Umb.PropertyEditorUi.TextBox',
	'Umbraco.TrueFalse': 'Umb.PropertyEditorUi.Toggle',
	'Umbraco.UploadField': 'Umb.PropertyEditorUi.UploadField',
};

export function resolveEditorUiAlias(dataType: Pick<SchemaDataType, 'editorAlias' | 'editorUiAlias'>): string {
	return dataType.editorUiAlias ?? DEFAULT_UI_ALIAS[dataType.editorAlias] ?? dataType.editorAlias;
}

export function toDataType(dt: SchemaDataType): MgmtDataType {
	return {
		id: dt.key,
		name: dt.name,
		editorAlias: dt.editorAlias,
		editorUiAlias: resolveEditorUiAlias(dt),
		values: Object.entries(dt.config).map(([alias, value]) => ({ alias, value })),
		isDeletable: true,
		canIgnoreStartNodes: false,
	};
}

export function toDataTypeItem(dt: SchemaDataType): MgmtDataTypeItem {
	return {
		id: dt.key,
		flags: [],
		name: dt.name,
		editorUiAlias: resolveEditorUiAlias(dt),
		editorAlias: dt.editorAlias,
		isDeletable: true,
	};
}

function common(ct: SchemaContentType) {
	return {
		id: ct.key,
		alias: ct.alias,
		name: ct.name,
		description: ct.description,
		icon: ct.icon,
		allowedAsRoot: ct.allowedAtRoot,
		variesByCulture: ct.variesByCulture,
		variesBySegment: ct.variesBySegment,
		collection: ct.listView ? { id: ct.listView } : null,
		isElement: ct.isElement,
		properties: ct.properties.map(
			(p): MgmtContentTypeProperty => ({
				id: p.key,
				container: p.containerKey ? { id: p.containerKey } : null,
				sortOrder: p.sortOrder,
				alias: p.alias,
				name: p.name,
				description: p.description,
				dataType: { id: p.dataTypeKey },
				variesByCulture: p.variesByCulture,
				variesBySegment: p.variesBySegment,
				validation: {
					mandatory: p.mandatory,
					mandatoryMessage: p.mandatoryMessage,
					regEx: p.regEx,
					regExMessage: p.regExMessage,
				},
				appearance: { labelOnTop: p.labelOnTop },
			}),
		),
		containers: ct.containers.map(
			(c): MgmtContentTypeContainer => ({
				id: c.key,
				parent: c.parentKey ? { id: c.parentKey } : null,
				name: c.name,
				type: c.type,
				sortOrder: c.sortOrder,
			}),
		),
	};
}

const compositionType = (inheritance: boolean): 'Composition' | 'Inheritance' =>
	inheritance ? 'Inheritance' : 'Composition';

export function toDocumentType(ct: SchemaContentType): MgmtDocumentType {
	return {
		...common(ct),
		allowedTemplates: ct.allowedTemplates.filter((t) => t.key).map((t) => ({ id: t.key })),
		defaultTemplate: ct.defaultTemplate?.key ? { id: ct.defaultTemplate.key } : null,
		cleanup: { preventCleanup: false, keepAllVersionsNewerThanDays: null, keepLatestVersionPerDayForDays: null },
		allowedDocumentTypes: ct.allowedChildren.map((c, i) => ({ documentType: { id: c.key }, sortOrder: i })),
		compositions: ct.compositions.map((c) => ({
			documentType: { id: c.key },
			compositionType: compositionType(c.inheritance),
		})),
	};
}

export function toMediaType(ct: SchemaContentType): MgmtMediaType {
	return {
		...common(ct),
		aliasCanBeChanged: true,
		allowedMediaTypes: ct.allowedChildren.map((c, i) => ({ mediaType: { id: c.key }, sortOrder: i })),
		compositions: ct.compositions.map((c) => ({
			mediaType: { id: c.key },
			compositionType: compositionType(c.inheritance),
		})),
	};
}

export function toContentTypeItem(ct: SchemaContentType): MgmtContentTypeItem {
	return { id: ct.key, flags: [], name: ct.name, isElement: ct.isElement, icon: ct.icon, description: ct.description };
}

/** Serialisable Management-API view of a snapshot, as handed to the renderer iframe. */
export interface ManagementSnapshot {
	dataTypes: MgmtDataType[];
	documentTypes: MgmtDocumentType[];
	mediaTypes: MgmtMediaType[];
	memberTypes: MgmtDocumentType[];
}

export function toManagementSnapshot(snapshot: SchemaSnapshot): ManagementSnapshot {
	const types = [...snapshot.contentTypes.values()];
	return {
		dataTypes: [...snapshot.dataTypes.values()].map(toDataType),
		documentTypes: types.filter((t) => t.kind === 'document').map(toDocumentType),
		mediaTypes: types.filter((t) => t.kind === 'media').map(toMediaType),
		memberTypes: types.filter((t) => t.kind === 'member').map(toDocumentType),
	};
}
