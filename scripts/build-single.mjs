#!/usr/bin/env node
/**
 * Folds the dist-single build into one self-contained HTML file.
 *
 * Vite is run with SINGLE_FILE=true (one JS chunk, every asset inlined as a
 * data URI); this step inlines that chunk plus the stylesheet into the HTML and
 * drops the tags that point at files which no longer travel with the page.
 *
 * Output: dist-single/draft-vault.html — open it directly, email it, or drop it
 * on any static host. No server, no build step, no network beyond web fonts.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist-single';
const htmlPath = join(DIST, 'index.html');

if (!existsSync(htmlPath)) {
  console.error(`[build-single] ${htmlPath} not found — run "npm run build:single" instead.`);
  process.exit(1);
}

let html = readFileSync(htmlPath, 'utf8');

const readAsset = (src) => {
  const file = join(DIST, src.replace(/^\//, ''));
  if (!existsSync(file)) throw new Error(`referenced asset is missing: ${file}`);
  return readFileSync(file, 'utf8');
};

const isRemote = (url) => /^(https?:)?\/\//.test(url) || url.startsWith('data:');

// Inline local stylesheets; leave remote ones (web fonts) as links
html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, (tag) => {
  const href = tag.match(/href="([^"]+)"/)?.[1];
  if (!href || isRemote(href)) return tag;
  return `<style>\n${readAsset(href)}\n</style>`;
});

// Inline the script bundle. Escaping </script> keeps the parser from bailing out
// early if the bundle happens to contain that sequence in a string literal.
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src) =>
  `<script type="module">\n${readAsset(src).replace(/<\/script>/g, '<\\/script>')}\n</script>`
);

// Drop references to files that are not part of the single-file bundle
html = html
  .replace(/^\s*<link[^>]+rel="manifest"[^>]*>\s*$/gm, '')
  .replace(/^\s*<link[^>]+rel="(icon|apple-touch-icon)"[^>]*>\s*$/gm, '')
  .replace(/^\s*<!--\s*(PWA Meta Tags|Apple Touch Icons|Favicon)\s*-->\s*$/gm, '')
  .replace(/\n{3,}/g, '\n\n');

const out = join(DIST, 'draft-vault.html');
writeFileSync(out, html);
console.log(`[build-single] ${out} — ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
