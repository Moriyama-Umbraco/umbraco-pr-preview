import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { snapshotToJson, type EntityDiff, type SchemaSnapshot } from '@az-umbraco-preview/core';

type Side = 'base' | 'head';

/**
 * One renderer iframe showing one side of one entity. Mirrors the protocol in
 * packages/renderer-shared/src/protocol.ts (kept structurally in sync; the shell must not import backoffice code).
 */
@customElement('upr-renderer-frame')
export class UprRendererFrameElement extends LitElement {
	@property() src = '';
	@property() side: Side = 'head';
	@property({ attribute: false }) snapshot?: SchemaSnapshot;
	@property({ attribute: false }) entity?: EntityDiff;

	@state() private _height = 400;
	@state() private _ready = false;
	@state() private _error: string | null = null;

	#onMessage = (event: MessageEvent) => {
		const frame = this.renderRoot.querySelector('iframe');
		if (!frame || event.source !== frame.contentWindow) return;
		const data = event.data as { type?: string; height?: number; message?: string };
		if (data.type === 'upr:ready') {
			this._ready = true;
			this.#post();
		} else if (data.type === 'upr:resize' && data.height) {
			this._height = Math.max(200, data.height);
		} else if (data.type === 'upr:error') {
			this._error = data.message ?? 'Renderer error';
		}
	};

	override connectedCallback() {
		super.connectedCallback();
		window.addEventListener('message', this.#onMessage);
	}

	override disconnectedCallback() {
		window.removeEventListener('message', this.#onMessage);
		super.disconnectedCallback();
	}

	override willUpdate(changed: Map<string, unknown>) {
		// A new src is a new document; wait for its `upr:ready` before posting.
		if (changed.has('src') && changed.get('src') !== undefined) this._ready = false;
	}

	override updated(changed: Map<string, unknown>) {
		if ((changed.has('entity') || changed.has('snapshot')) && this._ready) this.#post();
	}

	#post() {
		const frame = this.renderRoot.querySelector('iframe');
		if (!frame?.contentWindow || !this.snapshot || !this.entity) return;
		this._error = null;
		frame.contentWindow.postMessage(
			{
				type: 'upr:render',
				side: this.side,
				snapshot: snapshotToJson(this.snapshot),
				entity: { entityType: this.entity.entityType, key: this.entity.key },
				diff: this.entity,
			},
			'*',
		);
	}

	override render() {
		return html`${this._ready ? '' : html`<div class="loading">Loading Umbraco editors…</div>`}
			${this._error ? html`<div class="error">${this._error}</div>` : ''}
			<iframe
				title="${this.side === 'base' ? 'Target branch' : 'Pull request'} preview"
				src=${this.src}
				style="height:${this._height}px"></iframe>`;
	}

	static override styles = css`
		:host {
			display: block;
			position: relative;
		}
		iframe {
			display: block;
			width: 100%;
			border: 0;
		}
		.loading,
		.error {
			padding: 12px;
			font-size: 13px;
			color: var(--upr-text-alt);
		}
		.error {
			color: var(--upr-danger);
		}
	`;
}

declare global {
	interface HTMLElementTagNameMap {
		'upr-renderer-frame': UprRendererFrameElement;
	}
}
