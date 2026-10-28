#!/usr/bin/env node
/**
 * Headless smoke check of a renderer dev page: loads the URL, prints console errors and failed requests, and saves
 * a full-page screenshot. Requires Playwright (`npx playwright install chromium`).
 *
 * Optional env: SMOKE_CLICK (exact text to click), SMOKE_EVAL (expression evaluated in the page, result printed).
 *
 * Usage: node scripts/smoke.mjs <url|-> <screenshot.png> [waitMs]
 */
import { chromium } from 'playwright';

// The URL may also come from SMOKE_URL: Volta's node shim on Windows mangles `&` in arguments.
const [argUrl, out, wait = '4000'] = process.argv.slice(2);
const url = process.env.SMOKE_URL ?? argUrl;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(process.env.SMOKE_WIDTH ?? 1100), height: 900 } });
page.on('console', (m) => {
	if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[upr')) console.log(`[${m.type()}]`, m.text().slice(0, 400));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url()));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
if (process.env.SMOKE_CLICK) {
	await page.getByText(process.env.SMOKE_CLICK, { exact: true }).first().click();
	await page.waitForTimeout(2500);
}
if (process.env.SMOKE_EVAL) {
	console.log('[eval]', JSON.stringify(await page.evaluate(process.env.SMOKE_EVAL)));
	await page.waitForTimeout(2500);
}
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
