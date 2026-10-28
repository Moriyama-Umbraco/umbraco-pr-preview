import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SUPPORTED_MAJORS, type EntityDiff, type SchemaTombstone, type UmbracoMajor } from '@az-umbraco-preview/core';
import type { ComparisonData, RendererUrls } from '../model.js';
import './renderer-frame.element.js';
import './raw-diff.element.js';

const STATUS_LABEL = { added: 'Added', removed: 'Removed', changed: 'Changed', unchanged: 'Unchanged' } as const;

function groupLabel(e: EntityDiff): string {
	if (e.entityType === 'data-type') return 'Data types';
	const ct = e.after ?? e.before!;
	if (ct.kind === 'media') return 'Media types';
	if (ct.kind === 'member') return 'Member types';
	return ct.isElement ? 'Element types' : 'Document types';
}

const GROUP_ORDER = ['Document types', 'Element types', 'Media types', 'Member types', 'Data types'];

@customElement('upr-compare-app')
export class UprCompareAppElement extends LitElement {
	@property({ attribute: false }) data?: ComparisonData;
	@property({ attribute: false }) rendererUrls: RendererUrls = {};
	@property() status: string | null = 'Loading…';
	@property() error: string | null = null;

	@state() private _selected?: string;
	@state() private _mode: 'visual' | 'raw' = 'visual';
	@state() private _major?: UmbracoMajor;

	#major(): UmbracoMajor {
		return this._major ?? this.data?.major ?? 17;
	}

	override render() {
		if (this.error) return html`<div class="message error">${this.error}</div>`;
		if (!this.data) return html`<div class="message">${this.status}</div>`;
		const { diff } = this.data;
		if (!diff.entities.length && !this.data.unmatchedPaths.length)
			return html`<div class="message">No uSync or Umbraco Deploy schema changes in this pull request.</div>`;

		const selected = diff.entities.find((e) => e.key === this._selected) ?? diff.entities[0];
		return html`<div class="layout">
			<nav>${this.#renderList(diff.entities, diff.deletions)}</nav>
			<main>${selected ? this.#renderEntity(selected) : nothing}</main>
		</div>`;
	}

	#renderList(entities: EntityDiff[], deletions: SchemaTombstone[]) {
		const groups = new Map<string, EntityDiff[]>();
		for (const e of entities) {
			const g = groupLabel(e);
			groups.set(g, [...(groups.get(g) ?? []), e]);
		}
		const selectedKey = this._selected ?? entities[0]?.key;
		return html`${GROUP_ORDER.filter((g) => groups.has(g)).map(
				(g) => html`<h3>${g} <span class="count">${groups.get(g)!.length}</span></h3>
					<ul>
						${groups.get(g)!.map(
							(e) => html`<li>
								<button
									class=${e.key === selectedKey ? 'selected' : ''}
									@click=${() => (this._selected = e.key)}
									title=${(e.after ?? e.before)!.source.path}>
									<span class="dot ${e.status}"></span>
									<span class="name">${e.name}</span>
									<span class="status">${e.renamed && e.status === 'unchanged' ? 'Renamed' : STATUS_LABEL[e.status]}</span>
								</button>
							</li>`,
						)}
					</ul>`,
			)}
			${this.data!.unmatchedPaths.length
				? html`<h3>Not previewed</h3>
						<ul class="plain">
							${this.data!.unmatchedPaths.map((p) => html`<li title=${p}>${p.split('/').pop()}</li>`)}
						</ul>`
				: nothing}
			${deletions.length
				? html`<p class="hint">${deletions.length} uSync delete marker(s) added.</p>`
				: nothing}`;
	}

	#renderEntity(entity: EntityDiff) {
		const { base, head, baseFiles, headFiles } = this.data!;
		const major = this.#major();
		const src = this.rendererUrls[major];
		const paths = [...new Set([entity.before?.source.path, entity.after?.source.path].filter(Boolean) as string[])];

		return html`<header>
				<div>
					<h2>${entity.name}</h2>
					<div class="paths">${paths.join(' → ')}</div>
				</div>
				<div class="actions">
					<div class="toggle" role="group" aria-label="View">
						<button aria-pressed=${this._mode === 'visual'} @click=${() => (this._mode = 'visual')}>Visual</button>
						<button aria-pressed=${this._mode === 'raw'} @click=${() => (this._mode = 'raw')}>Raw diff</button>
					</div>
					<label class="version">
						Umbraco
						<select @change=${(e: Event) => (this._major = Number((e.target as HTMLSelectElement).value) as UmbracoMajor)}>
							${SUPPORTED_MAJORS.map((m) => html`<option value=${m} ?selected=${m === major}>${m}</option>`)}
						</select>
					</label>
				</div>
			</header>
			${this._mode === 'raw'
				? paths.map(
						(p) =>
							html`<upr-raw-diff .path=${p} .original=${baseFiles.get(p) ?? null} .modified=${headFiles.get(p) ?? null}></upr-raw-diff>`,
					)
				: !src
					? html`<div class="message">No renderer available for Umbraco ${major}.</div>`
					: html`<div class="sides">
							<section>
								<h4>Target branch</h4>
								<upr-renderer-frame side="base" .src=${src} .snapshot=${base} .entity=${entity}></upr-renderer-frame>
							</section>
							<section>
								<h4>This pull request</h4>
								<upr-renderer-frame side="head" .src=${src} .snapshot=${head} .entity=${entity}></upr-renderer-frame>
							</section>
						</div>`}`;
	}

	static override styles = css`
		:host {
			display: block;
			font: 14px/1.4 'Segoe UI', system-ui, sans-serif;
			color: var(--upr-text);
			--upr-text: #201f1e;
			--upr-text-alt: #605e5c;
			--upr-border: #e1dfdd;
			--upr-surface-alt: #f8f8f8;
			--upr-accent: #0078d4;
			--upr-danger: #a4262c;
			--upr-add-bg: #dff6dd;
			--upr-del-bg: #fde7e9;
			--upr-mono: Consolas, 'Cascadia Mono', monospace;
		}
		.layout {
			display: grid;
			grid-template-columns: 280px minmax(0, 1fr);
			gap: 16px;
			min-height: 100vh;
		}
		nav {
			border-right: 1px solid var(--upr-border);
			padding: 8px 8px 8px 0;
			overflow: auto;
		}
		h3 {
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--upr-text-alt);
			margin: 16px 8px 4px;
		}
		.count {
			font-weight: 400;
		}
		ul {
			list-style: none;
			margin: 0;
			padding: 0;
		}
		ul.plain li {
			padding: 4px 8px;
			color: var(--upr-text-alt);
			font-size: 13px;
		}
		nav button {
			display: flex;
			align-items: center;
			gap: 8px;
			width: 100%;
			padding: 6px 8px;
			border: 0;
			border-radius: 4px;
			background: none;
			font: inherit;
			text-align: left;
			cursor: pointer;
		}
		nav button:hover {
			background: var(--upr-surface-alt);
		}
		nav button.selected {
			background: #deecf9;
		}
		.name {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.status {
			font-size: 12px;
			color: var(--upr-text-alt);
		}
		.dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			flex: none;
			background: #c8c6c4;
		}
		.dot.added {
			background: #107c10;
		}
		.dot.removed {
			background: var(--upr-danger);
		}
		.dot.changed {
			background: #ca5010;
		}
		main {
			min-width: 0;
			padding: 8px 0;
		}
		header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 16px;
			margin-bottom: 12px;
		}
		h2 {
			margin: 0;
			font-size: 20px;
			font-weight: 600;
		}
		.paths {
			font: 12px var(--upr-mono);
			color: var(--upr-text-alt);
			margin-top: 2px;
		}
		.actions {
			display: flex;
			gap: 12px;
			align-items: center;
		}
		.toggle {
			display: inline-flex;
			border: 1px solid var(--upr-border);
			border-radius: 4px;
			overflow: hidden;
		}
		.toggle button {
			border: 0;
			background: none;
			padding: 4px 12px;
			font: inherit;
			cursor: pointer;
		}
		.toggle button[aria-pressed='true'] {
			background: var(--upr-accent);
			color: white;
		}
		.version {
			font-size: 13px;
			color: var(--upr-text-alt);
		}
		.sides {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
		h4 {
			margin: 0 0 6px;
			font-size: 13px;
			font-weight: 600;
			color: var(--upr-text-alt);
		}
		section {
			min-width: 0;
			border: 1px solid var(--upr-border);
			border-radius: 4px;
			padding: 8px;
			background: #f3f3f5;
		}
		.message {
			padding: 24px;
			color: var(--upr-text-alt);
		}
		.message.error {
			color: var(--upr-danger);
		}
		.hint {
			font-size: 12px;
			color: var(--upr-text-alt);
			margin: 16px 8px;
		}
		@media (max-width: 1100px) {
			.sides {
				grid-template-columns: 1fr;
			}
		}
	`;
}

declare global {
	interface HTMLElementTagNameMap {
		'upr-compare-app': UprCompareAppElement;
	}
}
