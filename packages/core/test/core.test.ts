import { describe, expect, it } from 'vitest';
import {
	buildSnapshot,
	classifyPath,
	detectUmbracoMajor,
	diffSnapshots,
	normaliseKey,
	schemaRootOf,
	snapshotFromJson,
	snapshotToJson,
	toManagementSnapshot,
	type ContentTypeDiff,
	type DataTypeDiff,
} from '../src/index.js';
import { loadFixture } from './load-fixtures.js';

const LANDING = '102e9699-044e-45ff-9d09-9f9d636ec6f9';
const BLOCK_LIST = '3726dfae-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const TOGGLE = '92897bc6-a5f3-4ffe-ae27-f2e7e33dda49';
const DROPDOWN = '5a1d7b2e-3c4f-4e5a-9b6c-7d8e9f0a1b2c';
const QUOTE = '9531ac35-3f0c-44e7-a8ae-dc6f93d2d752';
const SEO = 'bc368f8a-99c5-4629-826a-54d1737d3091';

describe('util', () => {
	it('normalises N, D and UDI keys', () => {
		expect(normaliseKey('umb://data-type/0E24080BCB3B4B2C81DC92948575ACD3')).toBe('0e24080b-cb3b-4b2c-81dc-92948575acd3');
		expect(normaliseKey('0e24080b-cb3b-4b2c-81dc-92948575acd3')).toBe('0e24080b-cb3b-4b2c-81dc-92948575acd3');
		expect(normaliseKey('nope')).toBeNull();
	});
});

describe('classifyPath', () => {
	it.each([
		['/src/Web/uSync/v17/DataTypes/Foo.config', 'usync'],
		['/src/Web/uSync/v17/Content/home.config', null],
		['/src/Web/umbraco/Data/TEMP/uSync/v17/DataTypes/Foo.config', null],
		['/src/Web/bin/Debug/uSync/v17/DataTypes/Foo.config', null],
		['/src/Web/umbraco/Deploy/Revision/data-type__0e24080bcb3b4b2c81dc92948575acd3.uda', 'deploy'],
		['/src/Web/umbraco/Deploy/Revision/dictionary-item__0e24080bcb3b4b2c81dc92948575acd3.uda', null],
		['src\\Web\\uSync\\v17\\ContentTypes\\page.config', 'usync'],
	])('%s → %s', (path, expected) => expect(classifyPath(path)).toBe(expected));

	it('finds the schema root', () => {
		expect(schemaRootOf('/src/Web/uSync/v17/DataTypes/Foo.config')).toBe('/src/Web/uSync/v17');
		expect(schemaRootOf('/a/umbraco/Deploy/Revision/data-type__0e24080bcb3b4b2c81dc92948575acd3.uda')).toBe(
			'/a/umbraco/Deploy/Revision',
		);
	});
});

describe.each(['usync', 'deploy'] as const)('%s fixtures', (set) => {
	const base = buildSnapshot(loadFixture(set, 'base'));
	const head = buildSnapshot(loadFixture(set, 'head'));

	it('parses without issues', () => {
		expect(base.issues).toEqual([]);
		expect(head.issues).toEqual([]);
		expect(base.dataTypes.size).toBe(5);
		expect(base.contentTypes.size).toBe(3);
	});

	it('parses data type config', () => {
		const bl = base.dataTypes.get(BLOCK_LIST)!;
		expect(bl.editorAlias).toBe('Umbraco.BlockList');
		expect(bl.editorUiAlias).toBe('Umb.PropertyEditorUi.BlockList');
		expect((bl.config.blocks as unknown[]).length).toBe(1);
	});

	it('parses containers, nesting and properties', () => {
		const lp = base.contentTypes.get(LANDING)!;
		expect(lp.allowedAtRoot).toBe(true);
		expect(lp.compositions).toEqual([expect.objectContaining({ key: SEO, inheritance: false })]);
		expect(lp.allowedTemplates.map((t) => t.key)).toEqual(['97df1a2b-3c4d-4e5f-a6b7-c8d9e0f1a2b3']);
		expect(lp.defaultTemplate?.key).toBe('97df1a2b-3c4d-4e5f-a6b7-c8d9e0f1a2b3');
		expect(lp.allowedChildren.map((c) => c.key)).toEqual([LANDING]);

		const content = lp.containers.find((c) => c.alias === 'content')!;
		const hero = lp.containers.find((c) => c.alias === 'content/hero')!;
		expect(content.type).toBe('Tab');
		expect(hero.type).toBe('Group');
		expect(hero.parentKey).toBe(content.key);

		const heroProp = lp.properties.find((p) => p.alias === 'hero')!;
		expect(heroProp.containerKey).toBe(hero.key);
		expect(heroProp.dataTypeKey).toBe(BLOCK_LIST);
	});

	it('marks element types', () => {
		expect(base.contentTypes.get('4f92f906-0a1b-4c2d-9e3f-a4b5c6d7e8f9')!.isElement).toBe(true);
	});

	it('diffs the PR changes', () => {
		const diff = diffSnapshots(base, head);
		const byKey = new Map(diff.entities.map((e) => [e.key, e]));

		const bl = byKey.get(BLOCK_LIST) as DataTypeDiff;
		expect(bl.status).toBe('changed');
		expect(bl.config.map((c) => c.field).sort()).toEqual(['blocks', 'validationLimit']);

		const toggle = byKey.get(TOGGLE) as DataTypeDiff;
		expect(toggle.status).toBe('changed');
		expect(toggle.fields.map((f) => f.field)).toEqual(['name']);

		expect(byKey.get(DROPDOWN)?.status).toBe('removed');
		expect(byKey.get(QUOTE)?.status).toBe('added');

		const lp = byKey.get(LANDING) as ContentTypeDiff;
		expect(lp.status).toBe('changed');
		const props = Object.fromEntries(lp.properties.map((p) => [p.alias, p]));
		expect(props.intro.status).toBe('changed');
		expect(props.intro.fields.map((f) => f.field)).toContain('mandatory');
		expect(props.size.status).toBe('removed');
		expect(props.ctaLabel.status).toBe('added');
		expect(props.hero.status).toBe('unchanged');
		expect(lp.containers.find((c) => c.alias === 'content/cta')?.status).toBe('added');

		// Untouched entities are not reported.
		expect(byKey.has(SEO)).toBe(false);
	});

	it('maps to management API models', () => {
		const m = toManagementSnapshot(head);
		const lp = m.documentTypes.find((d) => d.id === LANDING)!;
		expect(lp.compositions).toEqual([{ documentType: { id: SEO }, compositionType: 'Composition' }]);
		const cta = lp.properties.find((p) => p.alias === 'ctaLabel')!;
		expect(cta.validation.regEx).toBe('^.{0,40}$');
		expect(cta.appearance.labelOnTop).toBe(true);
		expect(lp.containers.some((c) => c.type === 'Tab' && c.parent === null)).toBe(true);
		const bl = m.dataTypes.find((d) => d.id === BLOCK_LIST)!;
		expect(bl.values.find((v) => v.alias === 'blocks')!.value).toHaveLength(2);
	});

	it('round-trips JSON', () => {
		const back = snapshotFromJson(JSON.parse(JSON.stringify(snapshotToJson(head))));
		expect(diffSnapshots(head, back).entities).toEqual([]);
	});
});

describe('uSync specifics', () => {
	it('tracks tombstones; renames keep the entity', () => {
		const head = buildSnapshot(loadFixture('usync', 'head'));
		const base = buildSnapshot(loadFixture('usync', 'base'));
		const diff = diffSnapshots(base, head);
		expect(diff.deletions.map((t) => t.key)).toEqual([DROPDOWN]);
		const toggle = diff.entities.find((e) => e.key === TOGGLE)!;
		expect(toggle.renamed).toBe(true);
	});

	it('decodes folder names', () => {
		const base = buildSnapshot(loadFixture('usync', 'base'));
		expect(base.dataTypes.get(BLOCK_LIST)!.folder).toBe('Block Lists/Custom');
	});
});

describe('deploy specifics', () => {
	it('treats container parents as folders', () => {
		const base = buildSnapshot(loadFixture('deploy', 'base'));
		expect(base.contentTypes.get(LANDING)!.folder).toBe('69c5ddb8-b153-430b-bc9d-94786c492182');
		expect(base.folders.size).toBe(2);
	});

	it('treats a document-type parent as inheritance', () => {
		const snapshot = buildSnapshot([
			{
				path: '/x/umbraco/Deploy/Revision/document-type__aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.uda',
				content: JSON.stringify({
					Name: 'Child',
					Alias: 'child',
					Parent: 'umb://document-type/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
					PropertyGroups: [],
					PropertyTypes: [],
					Udi: 'umb://document-type/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				}),
			},
		]);
		const ct = [...snapshot.contentTypes.values()][0];
		expect(ct.folder).toBeNull();
		expect(ct.compositions).toEqual([
			{ key: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', alias: null, inheritance: true },
		]);
	});
});

describe('deploy variation', () => {
	it('reads culture and segment booleans, treating missing as false', () => {
		const snapshot = buildSnapshot([
			{
				path: '/x/umbraco/Deploy/Revision/document-type__aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.uda',
				content: JSON.stringify({
					Name: 'Variant',
					Alias: 'variant',
					Permissions: { AllowVaryingByCulture: true, AllowVaryingBySegment: true },
					PropertyGroups: [
						{
							Key: '808d1326-0001-4a00-8000-000000000001',
							Name: 'Content',
							Alias: 'content',
							PropertyTypes: [
								{ Key: '1552cf3a-0001-4a00-8000-000000000001', Alias: 'both', VariesByCulture: true, VariesBySegment: true },
								{ Key: '1552cf3a-0001-4a00-8000-000000000002', Alias: 'none' },
							],
						},
					],
					PropertyTypes: [{ Key: '1552cf3a-0001-4a00-8000-000000000003', Alias: 'rootCulture', VariesByCulture: true }],
					Udi: 'umb://document-type/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				}),
			},
			{
				path: '/x/umbraco/Deploy/Revision/document-type__bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.uda',
				content: JSON.stringify({
					Name: 'Invariant',
					Alias: 'invariant',
					PropertyGroups: [],
					PropertyTypes: [],
					Udi: 'umb://document-type/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
				}),
			},
		]);
		const variant = snapshot.contentTypes.get('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')!;
		expect(variant.variesByCulture).toBe(true);
		expect(variant.variesBySegment).toBe(true);
		const props = Object.fromEntries(variant.properties.map((p) => [p.alias, p]));
		expect(props.both).toMatchObject({ variesByCulture: true, variesBySegment: true });
		expect(props.none).toMatchObject({ variesByCulture: false, variesBySegment: false });
		expect(props.rootCulture).toMatchObject({ variesByCulture: true, variesBySegment: false });
		const invariant = snapshot.contentTypes.get('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')!;
		expect(invariant.variesByCulture).toBe(false);
		expect(invariant.variesBySegment).toBe(false);
	});
});

describe('detectUmbracoMajor', () => {
	it('prefers project files', () => {
		expect(
			detectUmbracoMajor({
				projectFiles: ['<PackageVersion Include="Umbraco.Cms" Version="18.2.0" />'],
				schemaPaths: ['/uSync/v17/DataTypes/x.config'],
			}),
		).toBe(18);
	});
	it('falls back to uSync folder and Deploy __version', () => {
		expect(detectUmbracoMajor({ schemaPaths: ['/a/uSync/v17/DataTypes/x.config'] })).toBe(17);
		expect(detectUmbracoMajor({ deployArtifacts: ['{"__version": "18.0.1"}'] })).toBe(18);
		expect(detectUmbracoMajor({})).toBeNull();
	});
});

describe('buildEditorLayout', () => {
	it.each(['usync', 'deploy'] as const)('merges compositions into tabs and groups (%s)', async (set) => {
		const { buildEditorLayout } = await import('../src/index.js');
		const head = buildSnapshot(loadFixture(set, 'head'));
		const layout = buildEditorLayout(head.contentTypes.get(LANDING)!, head);
		expect(layout.missingCompositions).toEqual([]);
		expect(layout.tabs.map((t) => t.name)).toEqual(['Content', 'Settings', 'SEO']);
		const content = layout.tabs[0];
		expect(content.groups.map((g) => g.name)).toEqual(['Hero', 'Call to action']);
		expect(content.groups[0].properties.map((p) => p.property.alias)).toEqual(['hero', 'intro']);
		const seo = layout.tabs[2];
		expect(seo.inherited).toBe(true);
		expect(seo.groups[0].properties[0].inheritedFrom?.alias).toBe('seoMeta');
		expect(seo.groups[0].properties[0].dataType?.editorAlias).toBe('Umbraco.TextBox');
	});
});
