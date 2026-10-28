import type { SchemaContainer, SchemaContentType, SchemaDataType, SchemaProperty, SchemaSnapshot } from './model.js';

export interface LayoutProperty {
	property: SchemaProperty;
	dataType: SchemaDataType | null;
	/** Set when the property comes from a composition or parent type rather than this type. */
	inheritedFrom: SchemaContentType | null;
}

export interface LayoutGroup {
	/** Keys of every container merged into this group (own + compositions). */
	keys: string[];
	name: string;
	alias: string;
	sortOrder: number;
	inherited: boolean;
	properties: LayoutProperty[];
}

export interface LayoutTab {
	keys: string[];
	name: string;
	alias: string;
	sortOrder: number;
	inherited: boolean;
	/** Properties placed directly on the tab, outside any group. */
	properties: LayoutProperty[];
	groups: LayoutGroup[];
}

export interface EditorLayout {
	tabs: LayoutTab[];
	/** Composition keys that could not be resolved in this snapshot. */
	missingCompositions: string[];
}

export const GENERIC_TAB_ALIAS = '__generic';

/** All content types contributing to `contentType`, own type first, de-duplicated, depth-first. */
function contributors(
	contentType: SchemaContentType,
	snapshot: SchemaSnapshot,
	missing: Set<string>,
	seen = new Set<string>(),
): SchemaContentType[] {
	if (seen.has(contentType.key)) return [];
	seen.add(contentType.key);
	const out = [contentType];
	for (const c of contentType.compositions) {
		const ct = snapshot.contentTypes.get(c.key);
		if (ct) out.push(...contributors(ct, snapshot, missing, seen));
		else missing.add(c.key);
	}
	return out;
}

/**
 * Resolves the editor layout the backoffice would render: tabs → groups → properties, with compositions merged
 * in by container alias (the backoffice merges same-named containers across compositions the same way).
 */
export function buildEditorLayout(contentType: SchemaContentType, snapshot: SchemaSnapshot): EditorLayout {
	const missing = new Set<string>();
	const types = contributors(contentType, snapshot, missing);

	const tabs = new Map<string, LayoutTab>();
	const groups = new Map<string, LayoutGroup>();

	const tabFor = (alias: string, c: SchemaContainer | null, inherited: boolean): LayoutTab => {
		let tab = tabs.get(alias);
		if (!tab) {
			tab = {
				keys: [],
				name: c?.name ?? 'Generic',
				alias,
				sortOrder: c?.sortOrder ?? -1,
				inherited,
				properties: [],
				groups: [],
			};
			tabs.set(alias, tab);
		}
		if (c && !tab.keys.includes(c.key)) tab.keys.push(c.key);
		if (!inherited) tab.inherited = false;
		return tab;
	};

	for (const ct of types) {
		const inherited = ct !== contentType;
		const containers = new Map(ct.containers.map((c) => [c.key, c]));

		for (const c of ct.containers) {
			if (c.type === 'Tab') {
				tabFor(c.alias, c, inherited);
				continue;
			}
			const parent = c.parentKey ? containers.get(c.parentKey) : undefined;
			const tab = parent ? tabFor(parent.alias, parent, inherited) : tabFor(GENERIC_TAB_ALIAS, null, inherited);
			const groupId = `${tab.alias}|${c.alias}`;
			let group = groups.get(groupId);
			if (!group) {
				group = { keys: [], name: c.name, alias: c.alias, sortOrder: c.sortOrder, inherited, properties: [] };
				groups.set(groupId, group);
				tab.groups.push(group);
			}
			group.keys.push(c.key);
			if (!inherited) group.inherited = false;
		}

		for (const p of ct.properties) {
			const lp: LayoutProperty = {
				property: p,
				dataType: snapshot.dataTypes.get(p.dataTypeKey) ?? null,
				inheritedFrom: inherited ? ct : null,
			};
			const c = p.containerKey ? containers.get(p.containerKey) : undefined;
			if (!c) {
				tabFor(GENERIC_TAB_ALIAS, null, inherited).properties.push(lp);
			} else if (c.type === 'Tab') {
				tabFor(c.alias, c, inherited).properties.push(lp);
			} else {
				const parent = c.parentKey ? containers.get(c.parentKey) : undefined;
				const tabAlias = parent ? parent.alias : GENERIC_TAB_ALIAS;
				groups.get(`${tabAlias}|${c.alias}`)!.properties.push(lp);
			}
		}
	}

	const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
	const byPropSort = (a: LayoutProperty, b: LayoutProperty) => a.property.sortOrder - b.property.sortOrder;
	const result = [...tabs.values()].sort(bySort);
	for (const tab of result) {
		tab.properties.sort(byPropSort);
		tab.groups.sort(bySort);
		for (const g of tab.groups) g.properties.sort(byPropSort);
	}
	// Tabs with nothing in them are hidden by the backoffice too.
	return {
		tabs: result.filter((t) => t.properties.length || t.groups.some((g) => g.properties.length) || t.keys.length),
		missingCompositions: [...missing],
	};
}
