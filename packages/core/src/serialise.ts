import type {
	ParseIssue,
	SchemaContentType,
	SchemaDataType,
	SchemaFolder,
	SchemaSnapshot,
	SchemaTemplate,
	SchemaTombstone,
} from './model.js';

/** JSON-safe form of a SchemaSnapshot (Maps become arrays). */
export interface SchemaSnapshotJson {
	dataTypes: SchemaDataType[];
	contentTypes: SchemaContentType[];
	templates: SchemaTemplate[];
	folders: SchemaFolder[];
	tombstones: SchemaTombstone[];
	issues: ParseIssue[];
}

export function snapshotToJson(s: SchemaSnapshot): SchemaSnapshotJson {
	return {
		dataTypes: [...s.dataTypes.values()],
		contentTypes: [...s.contentTypes.values()],
		templates: [...s.templates.values()],
		folders: [...s.folders.values()],
		tombstones: s.tombstones,
		issues: s.issues,
	};
}

export function snapshotFromJson(j: SchemaSnapshotJson): SchemaSnapshot {
	return {
		dataTypes: new Map(j.dataTypes.map((x) => [x.key, x])),
		contentTypes: new Map(j.contentTypes.map((x) => [x.key, x])),
		templates: new Map(j.templates.map((x) => [x.key, x])),
		folders: new Map(j.folders.map((x) => [x.key, x])),
		tombstones: j.tombstones,
		issues: j.issues,
	};
}
