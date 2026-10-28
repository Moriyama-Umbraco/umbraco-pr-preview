import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { UserConfig } from 'vite';

/** Finds `node_modules/<pkg>` walking up from `from`, the way Node resolves it (ignores `exports`). */
function packageDir(from: string, pkg: string): string {
	for (let dir = from; ; dir = dirname(dir)) {
		const candidate = join(dir, 'node_modules', pkg);
		if (existsSync(join(candidate, 'package.json'))) return candidate;
		if (dirname(dir) === dir) throw new Error(`Cannot find ${pkg} from ${from}`);
	}
}

/**
 * Shared Vite config for `renderer-vXX`. Each renderer pins its own `@umbraco-cms/backoffice`; `dedupe` makes
 * the shared source in renderer-shared resolve that renderer's copy rather than whichever version npm hoisted.
 */
export function rendererConfig(rendererDir: string, major: number): UserConfig {
	const backoffice = packageDir(rendererDir, '@umbraco-cms/backoffice');
	const repoRoot = resolve(rendererDir, '..', '..');
	return {
		root: rendererDir,
		base: './',
		define: { __UMBRACO_MAJOR__: JSON.stringify(major) },
		resolve: {
			alias: [{ find: /^@umbraco-cms\/internal\//, replacement: join(backoffice, 'dist-cms').replace(/\\/g, '/') + '/' }],
			dedupe: ['@umbraco-cms/backoffice', '@umbraco-ui/uui', 'lit', 'rxjs', 'element-internals-polyfill'],
		},
		optimizeDeps: {
			// dist-cms uses Vite-only imports (`?worker`, `?inline`) that the esbuild pre-bundler can't handle, and every
			// backoffice dependency already ships ESM, so serve them unbundled in dev.
			noDiscovery: true,
			include: [],
		},
		server: {
			port: 5170 + (major - 17),
			fs: { allow: [repoRoot] },
		},
		build: {
			outDir: 'dist',
			emptyOutDir: true,
			target: 'es2022',
			chunkSizeWarningLimit: 4000,
			rollupOptions: {
				input: { index: join(rendererDir, 'index.html') },
				// The Marketplace rejects a VSIX with more than 1000 files; unmerged, each renderer emits ~1650 chunks.
				// Localization files stay out of the merge: once merged into another chunk, Umbraco 18 stops applying them.
				output: {
					experimentalMinChunkSize: 50_000,
					manualChunks(id) {
						const lang = /\/assets\/lang\/([\w-]+)\.js$/.exec(id.replace(/\\/g, '/'))?.[1];
						if (lang) return lang === 'en' || lang === 'en-us' ? `lang-${lang}` : 'lang-other';
					},
				},
			},
		},
		esbuild: {
			// Lit decorators in renderer-shared are compiled with legacy (experimental) semantics.
			tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
		},
	};
}
