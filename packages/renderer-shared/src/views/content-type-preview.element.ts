import { css, html, customElement, property, state, nothing, repeat } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import {
	buildEditorLayout,
	resolveEditorUiAlias,
	type ChangeStatus,
	type ContentTypeDiff,
	type ItemDiff,
	type LayoutProperty,
	type LayoutTab,
	type SchemaContentType,
	type SchemaSnapshot,
} from '@az-umbraco-preview/core';
import { changeOutline, describeFields } from './badge.element.js';
import './badge.element.js';

const KIND_LABEL = { document: 'Document type', media: 'Media type', member: 'Member type' } as const;

@customElement('upr-content-type-preview')
export class UprContentTypePreviewElement extends UmbLitElement {
	@property({ attribute: false })
	contentType?: SchemaContentType;

	@property({ attribute: false })
	snapshot?: SchemaSnapshot;

	@property({ attribute: false })
	diff: ContentTypeDiff | null = null;

	@state()
	private _activeTab?: string;

	#itemDiff(key: string, list: ItemDiff[] | undefined): ItemDiff | undefined {
		// For a wholly added/removed type the entity badge says it all; don't outline every group and property.
		if (this.diff?.status !== 'changed') return undefined;
		return list?.find((d) => d.key === key && d.status !== 'unchanged');
	}

	#tabStatus(tab: LayoutTab): ChangeStatus {
		const containerChanges = tab.keys
			.concat(tab.groups.flatMap((g) => g.keys))
			.map((k) => this.#itemDiff(k, this.diff?.containers));
		const propChanges = tab.properties
			.concat(tab.groups.flatMap((g) => g.properties))
			.map((p) => this.#itemDiff(p.property.key, this.diff?.properties));
		const all = [...containerChanges, ...propChanges].filter(Boolean) as ItemDiff[];
		if (!all.length) return 'unchanged';
		const own = this.#itemDiff(tab.keys[0] ?? '', this.diff?.containers);
		return own?.status ?? 'changed';
	}

	override render() {
		const ct = this.contentType;
		if (!ct || !this.snapshot) return html`<uui-box headline="Not present in this version"></uui-box>`;
		const layout = buildEditorLayout(ct, this.snapshot);
		const active = layout.tabs.find((t) => t.alias === this._activeTab) ?? layout.tabs[0];

		return html`
			${this.#renderInfo(ct, layout.missingCompositions)}
			${layout.tabs.length > 1
				? html`<uui-tab-group>
						${layout.tabs.map((tab) => {
							const status = this.#tabStatus(tab);
							return html`<uui-tab
								label=${tab.name}
								?active=${tab === active}
								@click=${() => (this._activeTab = tab.alias)}
								>${tab.name}${tab.inherited ? html` <small>(inherited)</small>` : nothing}
								${status !== 'unchanged' ? html`<span class="dot dot-${status}" title=${status}></span>` : nothing}
							</uui-tab>`;
						})}
					</uui-tab-group>`
				: nothing}
			${active ? this.#renderTab(active) : html`<uui-box><p class="empty">This type has no properties.</p></uui-box>`}
		`;
	}

	#renderInfo(ct: SchemaContentType, missing: string[]) {
		// Field-level highlights only make sense when both versions exist.
		const changed = new Set(this.diff?.status === 'changed' ? this.diff.fields.map((f) => f.field) : []);
		const cls = (field: string) => (changed.has(field) ? 'status-changed' : '');
		const name = (key: string, fallback: string | null) => this.snapshot!.contentTypes.get(key)?.name ?? fallback ?? key;
		const template = (key: string, fallback: string | null) => this.snapshot!.templates.get(key)?.name ?? fallback ?? key;

		return html`<uui-box>
			<div slot="headline" class="headline">
				<umb-icon name=${ct.icon.split(' ')[0]} class=${cls('icon')}></umb-icon>
				<span class=${cls('name')}>${ct.name}</span>
				<code class=${cls('alias')}>${ct.alias}</code>
				${this.diff
					? html`<upr-diff-badge .status=${this.diff.status} .fields=${this.diff.status === 'changed' ? this.diff.fields : []}></upr-diff-badge>`
					: nothing}
			</div>
			<div slot="header-actions" class="tags">
				<uui-tag look="secondary">${ct.isElement ? 'Element type' : KIND_LABEL[ct.kind]}</uui-tag>
				${ct.allowedAtRoot ? html`<uui-tag look="secondary" class=${cls('allowedAtRoot')}>Allowed at root</uui-tag>` : nothing}
				${ct.variesByCulture ? html`<uui-tag look="secondary" class=${cls('variesByCulture')}>Varies by culture</uui-tag>` : nothing}
				${ct.variesBySegment ? html`<uui-tag look="secondary" class=${cls('variesBySegment')}>Varies by segment</uui-tag>` : nothing}
			</div>
			${ct.description ? html`<p class=${cls('description')}>${ct.description}</p>` : nothing}
			<dl class="meta">
				${ct.compositions.length
					? html`<dt>Compositions</dt>
							<dd class=${cls('compositions')}>
								${ct.compositions.map(
									(c) => html`<uui-tag look="outline">${c.inheritance ? 'Parent: ' : ''}${name(c.key, c.alias)}</uui-tag> `,
								)}
							</dd>`
					: nothing}
				${ct.allowedChildren.length
					? html`<dt>Allowed children</dt>
							<dd class=${cls('allowedChildren')}>
								${ct.allowedChildren.map((c) => html`<uui-tag look="outline">${name(c.key, c.alias)}</uui-tag> `)}
							</dd>`
					: nothing}
				${ct.allowedTemplates.length
					? html`<dt>Templates</dt>
							<dd class=${cls('allowedTemplates')}>
								${ct.allowedTemplates.map(
									(t) =>
										html`<uui-tag look=${t.key === ct.defaultTemplate?.key ? 'primary' : 'outline'}
												>${template(t.key, t.alias)}</uui-tag
											> `,
								)}
							</dd>`
					: nothing}
			</dl>
			${missing.length
				? html`<p class="warning">Compositions not found in this commit: ${missing.join(', ')}</p>`
				: nothing}
		</uui-box>`;
	}

	#renderTab(tab: LayoutTab) {
		return html`<umb-property-dataset .value=${[]}>
			${tab.properties.length ? html`<uui-box>${this.#renderProperties(tab.properties)}</uui-box>` : nothing}
			${repeat(
				tab.groups,
				(g) => g.alias,
				(group) => {
					const diff = group.keys.map((k) => this.#itemDiff(k, this.diff?.containers)).find(Boolean);
					return html`<uui-box class=${diff ? `status-${diff.status}` : ''}>
						<div slot="headline" class="headline">
							${group.name}
							${group.inherited ? html`<small class="inherited">inherited</small>` : nothing}
							${diff ? html`<upr-diff-badge .status=${diff.status} .fields=${diff.fields}></upr-diff-badge>` : nothing}
						</div>
						${group.properties.length
							? this.#renderProperties(group.properties)
							: html`<p class="empty">No properties.</p>`}
					</uui-box>`;
				},
			)}
		</umb-property-dataset>`;
	}

	#renderProperties(properties: LayoutProperty[]) {
		return repeat(
			properties,
			(p) => p.property.key,
			({ property: p, dataType, inheritedFrom }) => {
				const diff = this.#itemDiff(p.key, this.diff?.properties);
				const config = dataType ? Object.entries(dataType.config).map(([alias, value]) => ({ alias, value })) : [];
				const uiAlias = dataType ? resolveEditorUiAlias(dataType) : 'Umb.PropertyEditorUi.Unknown';
				return html`<div class="property ${diff ? `status-${diff.status}` : ''}">
					<div class="property-meta">
						<code>${p.alias}</code>
						<span title=${uiAlias}>${dataType?.name ?? `Missing data type ${p.dataTypeKey}`}</span>
						${inheritedFrom ? html`<small class="inherited">from ${inheritedFrom.name}</small>` : nothing}
						${p.variesByCulture ? html`<small>varies by culture</small>` : nothing}
						${p.variesBySegment ? html`<small>varies by segment</small>` : nothing}
						${diff
							? html`<upr-diff-badge .status=${diff.status} .fields=${diff.fields} title=${describeFields(diff.fields)}></upr-diff-badge>`
							: nothing}
					</div>
					<umb-property
						alias=${p.alias}
						label=${p.name}
						description=${p.description ?? ''}
						property-editor-ui-alias=${uiAlias}
						.config=${config}
						.validation=${{
							mandatory: p.mandatory,
							mandatoryMessage: p.mandatoryMessage,
							regEx: p.regEx,
							regExMessage: p.regExMessage,
						}}
						.appearance=${{ labelOnTop: p.labelOnTop }}></umb-property>
				</div>`;
			},
		);
	}

	static override styles = [
		changeOutline,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-5);
			}
			umb-property-dataset {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-5);
			}
			.headline {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-3);
			}
			.tags {
				display: flex;
				gap: var(--uui-size-space-2);
				flex-wrap: wrap;
			}
			.meta {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: var(--uui-size-space-3) var(--uui-size-space-5);
				margin: 0;
			}
			.meta dt {
				font-weight: 700;
			}
			.meta dd {
				margin: 0;
			}
			uui-tab-group {
				--uui-tab-divider: var(--uui-color-border);
				border-bottom: 1px solid var(--uui-color-border);
			}
			.dot {
				display: inline-block;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				margin-left: 4px;
			}
			.dot-added {
				background: var(--uui-color-positive);
			}
			.dot-removed {
				background: var(--uui-color-danger);
			}
			.dot-changed {
				background: var(--uui-color-warning);
			}
			.property {
				padding: var(--uui-size-space-2) 0;
			}
			.property + .property {
				border-top: 1px solid var(--uui-color-divider);
			}
			.property-meta {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: var(--uui-size-space-3);
				font-size: 12px;
				color: var(--uui-color-text-alt);
			}
			.inherited {
				font-style: italic;
				color: var(--uui-color-text-alt);
			}
			.empty {
				color: var(--uui-color-text-alt);
			}
			.warning {
				color: var(--uui-color-warning-standalone);
			}
		`,
	];
}

declare global {
	interface HTMLElementTagNameMap {
		'upr-content-type-preview': UprContentTypePreviewElement;
	}
}
