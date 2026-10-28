// Copies each built renderer (renderers/vXX/dist) into dist/renderer-vXX so the VSIX serves them beside pr-tab.html.
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const renderers = resolve(here, '../../../renderers');
const dist = resolve(here, '../dist');
let copied = 0;
for (const name of readdirSync(renderers)) {
	const src = join(renderers, name, 'dist');
	if (!existsSync(join(src, 'index.html'))) {
		console.warn(`renderers/${name}: not built (run "npm run build" in renderers/${name}); skipping`);
		continue;
	}
	cpSync(src, join(dist, `renderer-${name}`), { recursive: true });
	copied++;
	console.log(`copied renderers/${name}/dist → dist/renderer-${name}`);
}
if (!copied) {
	console.error('No renderer builds found.');
	process.exit(1);
}
