import type { SchemaSnapshot, SnapshotDiff, UmbracoMajor } from '@az-umbraco-preview/core';

/** Everything the compare view needs, independent of where it came from (Azure DevOps or local fixtures). */
export interface ComparisonData {
	title: string;
	base: SchemaSnapshot;
	head: SchemaSnapshot;
	diff: SnapshotDiff;
	/** Raw text of schema files by path, for the raw diff toggle. Missing = file absent on that side. */
	baseFiles: Map<string, string>;
	headFiles: Map<string, string>;
	/** Changed schema file paths that could not be mapped to an entity (e.g. parse errors). */
	unmatchedPaths: string[];
	major: UmbracoMajor | null;
}

/** Where each renderer build lives, keyed by Umbraco major. */
export type RendererUrls = Partial<Record<UmbracoMajor, string>>;
