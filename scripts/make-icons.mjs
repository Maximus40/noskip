// Renders the NoSkip app icon, Android adaptive layers, splash mark and favicon from one SVG
// drawing (an orange plate seen from the front) with the pre-installed Playwright Chromium.
// Usage: node scripts/make-icons.mjs
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Playwright is installed globally (not a project dependency).
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');

const BG = '#111214';
const ACCENT = '#FF6A3D';
const INK = '#0E0E0F';

/** Plate centred at (c, c), outer radius r. `mono` draws a single-colour silhouette. */
function plate(c, r, mono = false) {
  const fill = mono ? '#FFFFFF' : ACCENT;
  const cut = mono ? 'transparent' : INK;
  return `
    <circle cx="${c}" cy="${c}" r="${r}" fill="${fill}"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.86}" fill="none" stroke="${cut}" stroke-opacity="${mono ? 0 : 0.28}" stroke-width="${r * 0.035}"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.42}" fill="none" stroke="${cut}" stroke-opacity="${mono ? 0 : 0.28}" stroke-width="${r * 0.035}"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.2}" fill="${mono ? 'black' : BG}"/>`;
}

function svg(size, body, background = null) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
    ${body}</svg>`;
}

// Monochrome: the hole must be cut out, so use a mask.
function monoSvg(size) {
  const c = size / 2;
  const r = size * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><mask id="m"><rect width="${size}" height="${size}" fill="white"/><circle cx="${c}" cy="${c}" r="${r * 0.2}" fill="black"/></mask></defs>
    <circle cx="${c}" cy="${c}" r="${r}" fill="#FFFFFF" mask="url(#m)"/></svg>`;
}

const outputs = [
  // iOS / generic icon: opaque, full bleed (the OS rounds the corners).
  ['assets/images/icon.png', 1024, svg(1024, plate(512, 330), BG), false],
  // Android adaptive icon: 108dp canvas, safe zone = inner 66dp → plate radius ≤ ~0.3.
  ['assets/images/android-icon-foreground.png', 512, svg(512, plate(256, 150)), true],
  ['assets/images/android-icon-background.png', 512, svg(512, '', BG), false],
  ['assets/images/android-icon-monochrome.png', 432, monoSvg(432), true],
  // Splash mark (shown at 76 dp on #111214).
  ['assets/images/splash-icon.png', 456, svg(456, plate(228, 220)), true],
  ['assets/images/favicon.png', 48, svg(48, plate(24, 21), BG), false],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, markup, transparent] of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup}</body></html>`,
  );
  const png = await page.locator('svg').screenshot({ omitBackground: transparent });
  writeFileSync(file, png);
  console.log('wrote', file);
}
await browser.close();
