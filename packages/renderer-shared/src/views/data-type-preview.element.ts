import { css, html, customElement, property, nothing } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { resolveEditorUiAlias, type DataTypeDiff, type SchemaDataType, type SchemaSnapshot } from '@az-umbraco-preview/core';
import { changeOutline } from './badge.element.js';
import './badge.element.js';

const pretty = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Appends the entity name after any key in config JSON that resolves in this snapshot (e.g. block element types). */
function annotateKeys(text: string, snapshot: SchemaSnapshot | undefined): string {
	if (!snapshot) return text;
	return text.replace(GUID, (key) => {
		const k = key.toLowerCase();
		const name = snapshot.contentTypes.get(k)?.name ?? snapshot.dataTypes.get(k)?.name ?? snapshot.templates.get(k)?.name;
		return name ? `${key} (${name})` : key;
	});
}

@customElement('upr-data-type-preview')
export class UprDataTypePreviewElement extends UmbLitElement {
	@property({ attribute: false })
	dataType?: SchemaDataType;

	@property({ attribute: false })
	diff: DataTypeDiff | null = null;

	/** Used to name keys referenced from config. */
	@property({ attribute: false })
	snapshot?: SchemaSnapshot;

	override render() {
		const dt = this.dataType;
		if (!dt) return html`<uui-box headline="Not present in this version"></uui-box>`;
		const uiAlias = resolveEditorUiAlias(dt);
		const config = Object.entries(dt.config).map(([alias, value]) => ({ alias, value }));
		// Field-level highlights only make sense when both versions exist.
		const fieldDiff = this.diff?.status === 'changed' ? this.diff : null;
		const changedConfig = new Set(fieldDiff?.config.map((c) => c.field));
		const changedFields = new Set(fieldDiff?.fields.map((f) => f.field));

		return html`
			<uui-box>
				<div slot="headline" class="headline">
					<umb-icon name="icon-autofill"></umb-icon>
					<span class=${changedFields.has('name') ? 'status-changed' : ''}>${dt.name}</span>
					${this.diff ? html`<upr-diff-badge .status=${this.diff.status} .fields=${fieldDiff ? [...fieldDiff.fields, ...fieldDiff.config] : []}></upr-diff-badge>` : nothing}
				</div>
				<dl class="meta">
					<dt>Property editor</dt>
					<dd class=${changedFields.has('editorAlias') ? 'status-changed' : ''}><code>${dt.editorAlias}</code></dd>
					<dt>Property editor UI</dt>
					<dd class=${changedFields.has('editorUiAlias') ? 'status-changed' : ''}><code>${uiAlias}</code></dd>
					${dt.folder ? html`<dt>Folder</dt><dd class=${changedFields.has('folder') ? 'status-changed' : ''}>${dt.folder}</dd>` : nothing}
				</dl>
			</uui-box>

			<uui-box headline="Editor preview">
				<umb-property-dataset .value=${[]}>
					<umb-property
						alias="preview"
						label=${dt.name}
						description="How this data type renders for editors"
						property-editor-ui-alias=${uiAlias}
						.config=${config}></umb-property>
				</umb-property-dataset>
			</uui-box>

			<uui-box headline="Configuration">
				${config.length === 0
					? html`<p class="empty">No configuration.</p>`
					: html`<table>
							${config.map(
								({ alias, value }) => html`<tr class=${changedConfig.has(alias) ? 'status-changed' : ''}>
									<th>${alias}</th>
									<td><pre>${annotateKeys(pretty(value), this.snapshot)}</pre></td>
								</tr>`,
							)}
						</table>`}
				${this.#removedConfig()}
			</uui-box>
		`;
	}

	/** Config aliases present in the other version but not this one. */
	#removedConfig() {
		const own = this.dataType?.config ?? {};
		if (this.diff?.status !== 'changed') return nothing;
		const gone = this.diff.config.filter((c) => !(c.field in own));
		if (!gone.length) return nothing;
		return html`<p class="gone">Not set in this version: ${gone.map((c) => html`<code>${c.field}</code> `)}</p>`;
	}

	static override styles = [
		changeOutline,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-5);
			}
			.headline {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-3);
			}
			.meta {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: var(--uui-size-space-2) var(--uui-size-space-5);
				margin: 0;
			}
			.meta dt {
				font-weight: 700;
			}
			.meta dd {
				margin: 0;
			}
			table {
				width: 100%;
				border-collapse: collapse;
			}
			th,
			td {
				text-align: left;
				vertical-align: top;
				padding: var(--uui-size-space-2) var(--uui-size-space-3);
				border-bottom: 1px solid var(--uui-color-divider);
			}
			th {
				width: 30%;
				font-weight: 600;
			}
			pre {
				margin: 0;
				white-space: pre-wrap;
				word-break: break-word;
				font-size: 12px;
			}
			tr.status-changed {
				outline-offset: -2px;
				background: color-mix(in srgb, var(--uui-color-warning) 12%, transparent);
			}
			.empty,
			.gone {
				color: var(--uui-color-text-alt);
			}
		`,
	];
}

declare global {
	interface HTMLElementTagNameMap {
		'upr-data-type-preview': UprDataTypePreviewElement;
	}
}
