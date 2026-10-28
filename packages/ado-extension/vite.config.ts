import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
	base: './',
	server: { port: 5180, fs: { allow: [resolve(import.meta.dirname, '../..')] } },
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2022',
		rollupOptions: { input: { 'pr-tab': resolve(import.meta.dirname, 'pr-tab.html') } },
	},
	esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } },
});
