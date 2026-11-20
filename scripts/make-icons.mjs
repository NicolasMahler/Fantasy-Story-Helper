// Builds the app icons from one SVG drawing: a clasped grimoire with the dragon-card eye on its cover.
//
//   node scripts/make-icons.mjs
//
// Writes public/icon.svg (browser tab) and renders the PNGs with a local headless Chrome or Edge
// (set CHROME=/path/to/chrome if neither is found in the usual place):
//   apple-touch-icon.png  180  full-bleed square; iOS rounds the corners itself
//   icon-192.png / icon-512.png  full-bleed square, for the web app manifest
//   icon-maskable-512.png  artwork shrunk into the safe zone, for Android's shaped icons
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BG = '#211b16';
const GOLD = '#e3a95b';

/** The grimoire, drawn on a 100×100 canvas. */
const ART = `
  <rect x="30" y="18" width="48" height="66" rx="2" fill="#efe6d8"/>
  <path d="M71 22 L71 80 M74 22 L74 80" stroke="#c9b79c" stroke-width="0.8"/>
  <rect x="22" y="14" width="50" height="68" rx="3" fill="#3a2a1c"/>
  <rect x="22" y="14" width="7" height="68" rx="2" fill="#2a1e14"/>
  <path d="M72 14 L62 14 L72 24 Z M72 82 L62 82 L72 72 Z M29 14 L37 14 L29 22 Z M29 82 L37 82 L29 74 Z" fill="${GOLD}"/>
  <rect x="68" y="42" width="12" height="12" rx="2" fill="${GOLD}"/>
  <circle cx="76" cy="48" r="1.6" fill="${BG}"/>
  <rect x="36" y="24" width="27" height="48" rx="2" fill="#2d251e" stroke="${GOLD}" stroke-width="1.6"/>
  <path d="M41 48 Q49.5 39 58 48 Q49.5 57 41 48 Z" fill="none" stroke="${GOLD}" stroke-width="1.8"/>
  <ellipse cx="49.5" cy="48" rx="2" ry="6" fill="${GOLD}"/>
  <path d="M49.5 30 l2.3 2.8 l-2.3 2.8 l-2.3 -2.8 Z M49.5 60.4 l2.3 2.8 l-2.3 2.8 l-2.3 -2.8 Z" fill="${GOLD}"/>`;

const svg = ({ radius = 0, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
  `<rect width="100" height="100" rx="${radius}" fill="${BG}"/>` +
  // The book's centre is (51, 49); scaling about it keeps it centred.
  `<g transform="translate(51 49) scale(${scale}) translate(-51 -49)">${ART}</g></svg>\n`;

// Tab icon: rounded, since browsers show it as-is.
writeFileSync('public/icon.svg', svg({ radius: 22 }));

const browsers = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error('No Chrome or Edge found. Set CHROME=/path/to/chrome.');

const work = mkdtempSync(join(tmpdir(), 'fh-icons-'));
function render(name, size, options) {
  const page = join(work, `${name}.html`);
  writeFileSync(page, `<html><body style="margin:0">${svg(options).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  execFileSync(browser, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${size},${size}`, `--screenshot=${resolve('public', name)}`, pathToFileURL(page).href,
  ], { stdio: 'ignore' });
}

render('apple-touch-icon.png', 180);
render('icon-192.png', 192);
render('icon-512.png', 512);
// Android may crop maskable icons to a circle: keep the artwork inside the central 80%.
render('icon-maskable-512.png', 512, { scale: 0.78 });

rmSync(work, { recursive: true, force: true });
console.log(`icons written (rendered with ${browser})`);
