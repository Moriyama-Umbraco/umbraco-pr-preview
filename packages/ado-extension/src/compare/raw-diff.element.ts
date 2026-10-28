import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { diffLines } from 'diff';

interface Row {
	kind: 'same' | 'add' | 'del' | 'gap';
	left: string | null;
	right: string | null;
	leftNo: number | null;
	rightNo: number | null;
}

const CONTEXT = 4;

/** Side-by-side line diff of one schema file. */
@customElement('upr-raw-diff')
export class UprRawDiffElement extends LitElement {
	@property() path = '';
	@property({ attribute: false }) original: string | null = null;
	@property({ attribute: false }) modified: string | null = null;

	#rows(): Row[] {
		const rows: Row[] = [];
		let l = 1;
		let r = 1;
		const parts = diffLines(this.original ?? '', this.modified ?? '');
		for (const part of parts) {
			const lines = part.value.replace(/\n$/, '').split('\n');
			if (part.added) for (const line of lines) rows.push({ kind: 'add', left: null, right: line, leftNo: null, rightNo: r++ });
			else if (part.removed) for (const line of lines) rows.push({ kind: 'del', left: line, right: null, leftNo: l++, rightNo: null });
			else for (const line of lines) rows.push({ kind: 'same', left: line, right: line, leftNo: l++, rightNo: r++ });
		}
		// Pair adjacent del/add runs onto the same rows so edits line up.
		const paired: Row[] = [];
		for (let i = 0; i < rows.length; i++) {
			if (rows[i].kind !== 'del') {
				paired.push(rows[i]);
				continue;
			}
			const dels: Row[] = [];
			while (i < rows.length && rows[i].kind === 'del') dels.push(rows[i++]);
			const adds: Row[] = [];
			while (i < rows.length && rows[i].kind === 'add') adds.push(rows[i++]);
			i--;
			for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
				const d = dels[k];
				const a = adds[k];
				paired.push({
					kind: d && a ? 'del' : d ? 'del' : 'add',
					left: d?.left ?? null,
					leftNo: d?.leftNo ?? null,
					right: a?.right ?? null,
					rightNo: a?.rightNo ?? null,
				});
			}
		}
		return this.#collapse(paired);
	}

	/** Keeps CONTEXT unchanged lines around each change and folds the rest. */
	#collapse(rows: Row[]): Row[] {
		const keep = rows.map(() => false);
		rows.forEach((row, i) => {
			if (row.kind === 'same') return;
			for (let k = Math.max(0, i - CONTEXT); k <= Math.min(rows.length - 1, i + CONTEXT); k++) keep[k] = true;
		});
		const out: Row[] = [];
		rows.forEach((row, i) => {
			if (keep[i]) out.push(row);
			else if (out.at(-1)?.kind !== 'gap') out.push({ kind: 'gap', left: null, right: null, leftNo: null, rightNo: null });
		});
		return out;
	}

	override render() {
		return html`<div class="file">${this.path}</div>
			<table>
				${this.#rows().map((row) =>
					row.kind === 'gap'
						? html`<tr class="gap"><td colspan="4">⋯</td></tr>`
						: html`<tr>
								<td class="no">${row.leftNo ?? nothing}</td>
								<td class="code ${row.left !== null && row.kind !== 'same' ? 'del' : ''}">${row.left ?? ''}</td>
								<td class="no">${row.rightNo ?? nothing}</td>
								<td class="code ${row.right !== null && row.kind !== 'same' ? 'add' : ''}">${row.right ?? ''}</td>
							</tr>`,
				)}
			</table>`;
	}

	static override styles = css`
		:host {
			display: block;
			border: 1px solid var(--upr-border);
			border-radius: 4px;
			overflow: auto;
			margin-bottom: 16px;
		}
		.file {
			font: 600 12px var(--upr-mono);
			padding: 6px 10px;
			background: var(--upr-surface-alt);
			border-bottom: 1px solid var(--upr-border);
		}
		table {
			border-collapse: collapse;
			width: 100%;
			table-layout: fixed;
			font: 12px/1.5 var(--upr-mono);
		}
		td.no {
			width: 3.5em;
			text-align: right;
			padding: 0 6px;
			color: var(--upr-text-alt);
			user-select: none;
			vertical-align: top;
		}
		td.code {
			white-space: pre-wrap;
			word-break: break-all;
			padding: 0 6px;
			vertical-align: top;
		}
		td.del {
			background: var(--upr-del-bg);
		}
		td.add {
			background: var(--upr-add-bg);
		}
		tr.gap td {
			text-align: center;
			color: var(--upr-text-alt);
			background: var(--upr-surface-alt);
		}
	`;
}

declare global {
	interface HTMLElementTagNameMap {
		'upr-raw-diff': UprRawDiffElement;
	}
}
