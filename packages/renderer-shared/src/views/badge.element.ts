import { css, html, customElement, property, nothing } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import type { ChangeStatus, FieldChange } from '@az-umbraco-preview/core';

const LABEL: Record<ChangeStatus, string> = {
	added: 'Added',
	removed: 'Removed',
	changed: 'Changed',
	unchanged: '',
};

const COLOR: Record<ChangeStatus, string> = {
	added: 'positive',
	removed: 'danger',
	changed: 'warning',
	unchanged: 'default',
};

export const statusColor = (status: ChangeStatus) => COLOR[status];

export function describeFields(fields: FieldChange[]): string {
	return fields.map((f) => f.field).join(', ');
}

@customElement('upr-diff-badge')
export class UprDiffBadgeElement extends UmbLitElement {
	@property()
	status: ChangeStatus = 'unchanged';

	@property({ attribute: false })
	fields: FieldChange[] = [];

	override render() {
		if (this.status === 'unchanged') return nothing;
		const detail = this.status === 'changed' && this.fields.length ? `: ${describeFields(this.fields)}` : '';
		return html`<uui-tag look="primary" color=${COLOR[this.status]} title=${LABEL[this.status] + detail}
			>${LABEL[this.status]}${detail}</uui-tag
		>`;
	}

	static override styles = css`
		:host {
			display: inline-flex;
		}
		uui-tag {
			max-width: 32em;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`;
}

/** Outline colour for a changed region; matches UUI's semantic colours. */
export const changeOutline = css`
	.status-added {
		outline: 2px solid var(--uui-color-positive);
		outline-offset: 4px;
		border-radius: var(--uui-border-radius);
	}
	.status-removed {
		outline: 2px solid var(--uui-color-danger);
		outline-offset: 4px;
		border-radius: var(--uui-border-radius);
		opacity: 0.85;
	}
	.status-changed {
		outline: 2px dashed var(--uui-color-warning);
		outline-offset: 4px;
		border-radius: var(--uui-border-radius);
	}
`;

declare global {
	interface HTMLElementTagNameMap {
		'upr-diff-badge': UprDiffBadgeElement;
	}
}
