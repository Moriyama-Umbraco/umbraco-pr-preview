const GUID_N = /^[0-9a-f]{32}$/i;
const GUID_D = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalises a GUID in "N" or "D" format, or an `umb://entity/<guid>` UDI, to lower-case dashed form. */
export function normaliseKey(value: string | null | undefined): string | null {
	if (!value) return null;
	let v = value.trim();
	const udi = /^umb:\/\/[^/]+\/(.+)$/i.exec(v);
	if (udi) v = udi[1];
	if (GUID_D.test(v)) return v.toLowerCase();
	if (GUID_N.test(v)) {
		const s = v.toLowerCase();
		return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
	}
	return null;
}

/** Returns the entity type of an `umb://` UDI, e.g. "data-type". */
export function udiEntityType(udi: string | null | undefined): string | null {
	const m = /^umb:\/\/([^/]+)\//i.exec(udi ?? '');
	return m ? m[1].toLowerCase() : null;
}

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export function parseBool(value: unknown, fallback = false): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
	return fallback;
}

export function parseIntOr(value: unknown, fallback = 0): number {
	const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
	return Number.isFinite(n) ? n : fallback;
}

export function emptyToNull(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	const s = String(value);
	return s.trim() === '' ? null : s;
}

/** Strips a UTF-8 BOM, which both uSync and Deploy files commonly start with. */
export function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function variations(value: unknown): { culture: boolean; segment: boolean } {
	const v = String(value ?? 'Nothing');
	return {
		culture: /culture/i.test(v),
		segment: /segment/i.test(v),
	};
}

/** Deterministic, stable stringify used for value comparison in diffs. */
export function stableStringify(value: unknown): string {
	return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortDeep);
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(value as object).sort()) out[k] = sortDeep((value as Record<string, unknown>)[k]);
		return out;
	}
	return value;
}
