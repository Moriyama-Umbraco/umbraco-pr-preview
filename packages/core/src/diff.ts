import type {
	SchemaContainer,
	SchemaContentType,
	SchemaDataType,
	SchemaProperty,
	SchemaSnapshot,
	SchemaTombstone,
	SourceRef,
} from './model.js';
import { stableStringify } from './util.js';

export type ChangeStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldChange {
	field: string;
	before: unknown;
	after: unknown;
}

export interface ItemDiff {
	key: string;
	alias: string;
	status: ChangeStatus;
	fields: FieldChange[];
}

export interface DataTypeDiff {
	entityType: 'data-type';
	key: string;
	name: string;
	status: ChangeStatus;
	fields: FieldChange[];
	/** Per config alias; only aliases that differ are listed. */
	config: FieldChange[];
	before: SchemaDataType | null;
	after: SchemaDataType | null;
	renamed: boolean;
}

export interface ContentTypeDiff {
	entityType: 'content-type';
	key: string;
	name: string;
	status: ChangeStatus;
	fields: FieldChange[];
	containers: ItemDiff[];
	properties: ItemDiff[];
	before: SchemaContentType | null;
	after: SchemaContentType | null;
	renamed: boolean;
}

export type EntityDiff = DataTypeDiff | ContentTypeDiff;

export interface SnapshotDiff {
	entities: EntityDiff[];
	/** Tombstones added in the PR whose entity no longer exists in the head snapshot. */
	deletions: SchemaTombstone[];
}

function same(a: unknown, b: unknown): boolean {
	return stableStringify(a) === stableStringify(b);
}

function fieldChanges<T extends object>(before: T | null, after: T | null, fields: (keyof T)[]): FieldChange[] {
	const out: FieldChange[] = [];
	for (const field of fields) {
		const b = before ? before[field] : undefined;
		const a = after ? after[field] : undefined;
		if (!same(b, a)) out.push({ field: String(field), before: b, after: a });
	}
	return out;
}

function status(before: unknown, after: unknown, changes: number): ChangeStatus {
	if (!before) return 'added';
	if (!after) return 'removed';
	return changes > 0 ? 'changed' : 'unchanged';
}

const DATA_TYPE_FIELDS: (keyof SchemaDataType)[] = ['name', 'editorAlias', 'editorUiAlias', 'folder'];

export function diffDataType(before: SchemaDataType | null, after: SchemaDataType | null): DataTypeDiff {
	const fields = fieldChanges(before, after, DATA_TYPE_FIELDS);
	const bc = before?.config ?? {};
	const ac = after?.config ?? {};
	const config: FieldChange[] = [];
	for (const alias of new Set([...Object.keys(bc), ...Object.keys(ac)])) {
		if (!same(bc[alias], ac[alias])) config.push({ field: alias, before: bc[alias], after: ac[alias] });
	}
	const ref = (after ?? before)!;
	return {
		entityType: 'data-type',
		key: ref.key,
		name: ref.name,
		status: status(before, after, fields.length + config.length),
		fields,
		config,
		before,
		after,
		renamed: renamed(before?.source, after?.source),
	};
}

const CONTENT_TYPE_FIELDS: (keyof SchemaContentType)[] = [
	'alias',
	'name',
	'description',
	'icon',
	'isElement',
	'allowedAtRoot',
	'variesByCulture',
	'variesBySegment',
	'folder',
	'listView',
	'compositions',
	'allowedChildren',
	'allowedTemplates',
	'defaultTemplate',
];

const CONTAINER_FIELDS: (keyof SchemaContainer)[] = ['name', 'alias', 'type', 'sortOrder', 'parentKey'];

const PROPERTY_FIELDS: (keyof SchemaProperty)[] = [
	'alias',
	'name',
	'description',
	'dataTypeKey',
	'containerKey',
	'sortOrder',
	'mandatory',
	'mandatoryMessage',
	'regEx',
	'regExMessage',
	'labelOnTop',
	'variesByCulture',
	'variesBySegment',
];

function diffItems<T extends { key: string; alias: string }>(
	before: T[],
	after: T[],
	fields: (keyof T)[],
): ItemDiff[] {
	const b = new Map(before.map((i) => [i.key, i]));
	const a = new Map(after.map((i) => [i.key, i]));
	const out: ItemDiff[] = [];
	for (const key of new Set([...b.keys(), ...a.keys()])) {
		const bi = b.get(key) ?? null;
		const ai = a.get(key) ?? null;
		const changes = fieldChanges(bi, ai, fields);
		out.push({ key, alias: (ai ?? bi)!.alias, status: status(bi, ai, changes.length), fields: changes });
	}
	return out;
}

export function diffContentType(before: SchemaContentType | null, after: SchemaContentType | null): ContentTypeDiff {
	const fields = fieldChanges(before, after, CONTENT_TYPE_FIELDS);
	const containers = diffItems(before?.containers ?? [], after?.containers ?? [], CONTAINER_FIELDS);
	const properties = diffItems(before?.properties ?? [], after?.properties ?? [], PROPERTY_FIELDS);
	const childChanges = [...containers, ...properties].filter((d) => d.status !== 'unchanged').length;
	const ref = (after ?? before)!;
	return {
		entityType: 'content-type',
		key: ref.key,
		name: ref.name,
		status: status(before, after, fields.length + childChanges),
		fields,
		containers,
		properties,
		before,
		after,
		renamed: renamed(before?.source, after?.source),
	};
}

function renamed(before: SourceRef | undefined, after: SourceRef | undefined): boolean {
	return !!before && !!after && before.path !== after.path;
}

/** Semantic diff of two snapshots. Unchanged entities are omitted. */
export function diffSnapshots(base: SchemaSnapshot, head: SchemaSnapshot): SnapshotDiff {
	const entities: EntityDiff[] = [];

	for (const key of new Set([...base.dataTypes.keys(), ...head.dataTypes.keys()])) {
		const d = diffDataType(base.dataTypes.get(key) ?? null, head.dataTypes.get(key) ?? null);
		if (d.status !== 'unchanged' || d.renamed) entities.push(d);
	}
	for (const key of new Set([...base.contentTypes.keys(), ...head.contentTypes.keys()])) {
		const d = diffContentType(base.contentTypes.get(key) ?? null, head.contentTypes.get(key) ?? null);
		if (d.status !== 'unchanged' || d.renamed) entities.push(d);
	}

	const baseTombstones = new Set(base.tombstones.map((t) => `${t.key}|${t.change}`));
	const deletions = head.tombstones.filter(
		(t) =>
			!baseTombstones.has(`${t.key}|${t.change}`) &&
			!head.dataTypes.has(t.key) &&
			!head.contentTypes.has(t.key) &&
			!head.templates.has(t.key),
	);

	entities.sort((x, y) => x.entityType.localeCompare(y.entityType) || x.name.localeCompare(y.name));
	return { entities, deletions };
}
