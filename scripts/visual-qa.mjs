#!/usr/bin/env node
// Visual QA without a simulator: exports the app for web in dev mode, serves it and screenshots
// the dev-only gallery route with the pre-installed Playwright Chromium.
// Usage: node scripts/visual-qa.mjs [outFile] [route]
import { execSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? 'design/qa/gallery.png';
const route = process.argv[3] ?? '/dev-gallery';
const dir = mkdtempSync(join(tmpdir(), 'noskip-web-'));
execSync(`npx expo export --platform web --dev --clear --output-dir ${dir}`, {
  stdio: 'inherit',
  env: { ...process.env, EXPO_OFFLINE: '1', CI: '1' },
});
// Own process group, so the whole `npx serve` tree is stopped afterwards (a leftover server
// would keep serving a stale export on the next run).
const server = spawn('npx', ['--yes', 'serve', '-s', dir, '-l', '4573'], {
  stdio: 'ignore',
  detached: true,
});
await new Promise((r) => setTimeout(r, 3000));
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 1400 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://localhost:4573${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`Screenshot: ${out}`);
} finally {
  await browser.close();
  process.kill(-server.pid, 'SIGTERM');
}
