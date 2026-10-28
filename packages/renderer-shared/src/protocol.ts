import type { EntityDiff, SchemaSnapshotJson } from '@az-umbraco-preview/core';

export type Side = 'base' | 'head';

/** Shell → renderer. One renderer iframe shows one side of one entity. */
export interface RenderMessage {
	type: 'upr:render';
	side: Side;
	snapshot: SchemaSnapshotJson;
	entity: { entityType: EntityDiff['entityType']; key: string };
	diff: EntityDiff | null;
	theme?: 'light' | 'dark';
}

/** Renderer → shell. */
export type RendererMessage =
	| { type: 'upr:ready'; major: number }
	| { type: 'upr:resize'; height: number }
	| { type: 'upr:error'; message: string };

export const isRenderMessage = (data: unknown): data is RenderMessage =>
	!!data && typeof data === 'object' && (data as { type?: unknown }).type === 'upr:render';
