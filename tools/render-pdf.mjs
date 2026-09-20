/**
 * Tasklet 7.5, headless Chromium PDF compilation.
 * One renderer, one truth: the PDF is produced from the same HTML the in app
 * document stream serves, so a figure cannot differ between the two surfaces.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/registry.mjs';

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.log('No Chromium binary found. Set CHROMIUM_PATH. The HTML is unaffected.');
  process.exit(0);
}

const OUT = join(ROOT, 'out');
const pages = readdirSync(OUT).filter((f) => f.endsWith('.html'));
if (!pages.length) {
  console.log('Nothing to render. Run `npm run build:sample` first.');
  process.exit(0);
}

for (const page of pages) {
  const pdf = join(OUT, page.replace(/\.html$/, '.pdf'));
  execFileSync(chrome, [
    '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`, `file://${join(OUT, page)}`,
  ], { stdio: 'ignore' });
  console.log(`${page.padEnd(38)} -> ${pdf.split('/').pop()}`);
}
console.log('\nA4 at 15mm margins, table headers repeating across page breaks, greyscale safe.');
