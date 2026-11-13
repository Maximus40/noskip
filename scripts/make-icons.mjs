// Renders the NOXCUSE app icon, Android adaptive layers, splash mark and favicons from one SVG
// drawing (two loaded barbells crossing into an X: the teammates' bar in off-white, yours in
// orange) with the pre-installed Playwright Chromium. Usage: node scripts/make-icons.mjs
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Playwright is installed globally (not a project dependency).
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');

const BG = '#111214';
const ACCENT = '#FF6A3D';
const WHITE = '#F5F5F0';

/**
 * One barbell along the x axis, centred on the origin, in a 1000-unit box: bar 760 × 44 and two
 * plates 58 × 240. Rotated ±45° it reaches about ±354 units, so `scale` sizes the whole X.
 */
function bar(color) {
  return `<rect x="-380" y="-22" width="760" height="44" rx="22" fill="${color}"/>
    <rect x="-330" y="-120" width="58" height="240" rx="14" fill="${color}"/>
    <rect x="272" y="-120" width="58" height="240" rx="14" fill="${color}"/>`;
}

/** The crossed bars centred at (c, c); `extent` = half the width of the X in pixels. */
function cross(c, extent, colors = [WHITE, ACCENT]) {
  const k = extent / 354;
  return `<g transform="translate(${c} ${c}) scale(${k})">
    <g transform="rotate(45)">${bar(colors[0])}</g>
    <g transform="rotate(-45)">${bar(colors[1])}</g></g>`;
}

function svg(size, body, background = null) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
    ${body}</svg>`;
}

const outputs = [
  // iOS / App Store icon: opaque, full bleed (the OS rounds the corners).
  ['assets/images/icon.png', 1024, svg(1024, cross(512, 330), BG), false],
  // Android adaptive icon: 108dp canvas, safe zone = inner 66dp → X half-width ≤ ~0.3 of the side.
  ['assets/images/android-icon-foreground.png', 512, svg(512, cross(256, 150)), true],
  ['assets/images/android-icon-background.png', 512, svg(512, '', BG), false],
  [
    'assets/images/android-icon-monochrome.png',
    432,
    svg(432, cross(216, 126, ['#FFFFFF', '#FFFFFF'])),
    true,
  ],
  // Splash mark (shown at 76 dp on #111214).
  ['assets/images/splash-icon.png', 456, svg(456, cross(228, 210)), true],
  ['assets/images/favicon.png', 48, svg(48, cross(24, 19), BG), false],
  // Public site (docs/): favicon and Apple touch icon.
  ['docs/favicon.png', 64, svg(64, cross(32, 25), BG), false],
  ['docs/apple-touch-icon.png', 180, svg(180, cross(90, 58), BG), false],
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
