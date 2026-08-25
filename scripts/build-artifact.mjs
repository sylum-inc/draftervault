#!/usr/bin/env node
/**
 * Turns the single-file build into a page that can be published as an Artifact.
 *
 * Two things differ from `dist-single/draft-vault.html`:
 *
 *  1. The artifact viewer supplies its own <head>, so the fragment must carry
 *     no doctype/html/head/body — and must carry its own viewport meta, because
 *     the head it is dropped into has none. Without it a phone assumes a 980px
 *     page and letterboxes the whole app, which is exactly what happened once.
 *
 *  2. A strict CSP blocks every external host except Google Fonts, so the ESPN
 *     images the app normally hotlinks would all fail. Faces and crests are
 *     fetched here and embedded as data URIs under `window.__DV_ASSETS__`,
 *     which `nflIdentity` consults before falling back to the CDN.
 *
 * Only the players most likely to be looked at get a face: the whole pool would
 * blow the 16 MB page budget for photos nobody scrolls to, and anyone without
 * one falls back to the monogram the app already draws.
 *
 *   node scripts/build-artifact.mjs [--faces 260]
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist-single');
const CACHE = join(ROOT, '.cache/images');
const OUT = join(ROOT, 'dist-single/artifact.html');

const args = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? Number(args[at + 1]) : fallback;
};
const FACES = flagValue('faces', 260);

/** Keeps the page inside the publisher's 16 MB ceiling with room to spare. */
const BUDGET_BYTES = 11 * 1024 * 1024;

const cached = async (key, url) => {
  const file = join(CACHE, key);
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, buffer);
  return buffer;
};

const dataUri = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;

const main = async () => {
  const html = join(DIST, 'draft-vault.html');
  if (!existsSync(html)) {
    console.error('[artifact] run "npm run build:single" first');
    process.exit(1);
  }

  const pool = JSON.parse(readFileSync(join(ROOT, 'src/data/nfl/pool.json'), 'utf8'));
  const teams = JSON.parse(readFileSync(join(ROOT, 'src/data/nfl/teams.json'), 'utf8'));

  const headshots = {};
  const logos = {};
  let bytes = 0;

  const teamList = Array.isArray(teams) ? teams : (teams.teams ?? []);
  for (const team of teamList) {
    if (!team?.abbr) continue;
    const buffer = await cached(
      `logo_${team.abbr}.png`,
      // The combiner resizes server-side; the plain path serves a 57 KB crest,
      // which is 1.8 MB of the page budget for 32 marks 20 pixels wide.
      `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${team.abbr.toLowerCase()}.png&w=96&h=96`
    );
    if (buffer) {
      logos[team.abbr] = dataUri(buffer);
      bytes += buffer.length;
    }
  }
  console.log(`[artifact] ${Object.keys(logos).length} crests`);

  // Most valuable first: those are the cards on screen before anyone scrolls.
  const wanted = pool.players
    .filter((player) => player.espnId)
    .sort((a, b) => b.auctionValue - a.auctionValue || a.rank - b.rank)
    .slice(0, FACES);

  for (const player of wanted) {
    if (bytes > BUDGET_BYTES) {
      console.log(`[artifact] stopped at the image budget after ${Object.keys(headshots).length} faces`);
      break;
    }
    const buffer = await cached(
      `head_${player.espnId}.png`,
      `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espnId}.png&w=180&h=131&scale=crop&cquality=80`
    );
    if (buffer) {
      headshots[player.espnId] = dataUri(buffer);
      bytes += buffer.length;
    }
  }
  console.log(
    `[artifact] ${Object.keys(headshots).length} faces · ${(bytes / 1024 / 1024).toFixed(1)} MB of images`
  );

  let page = readFileSync(html, 'utf8');

  // The viewer owns the document shell, so only the shell tags come out — NOT
  // the head's contents. Vite puts the module script in <head>, and this build
  // inlines the whole 2 MB bundle there; extracting <body> alone would leave a
  // page containing nothing but an empty <div id="root">, which is exactly what
  // it did the first time.
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(page)?.[1] ?? '';
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(page)?.[1] ?? page;
  page = `${head}\n${body}`
    .replace(/<!doctype html>/gi, '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    // charset and title are the viewer's to set; ours are added below.
    .replace(/<meta[^>]+charset[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]+name=["']viewport["'][^>]*>/gi, '');

  // The bundle registers a service worker for the deployed app. In an artifact
  // it is useless — the page is already self-contained — and the CSP blocks the
  // fetch, which surfaces as a console error on every load. Shadowing the
  // accessor before the bundle runs is cleaner than regexing minified output.
  const prelude =
    `<script>` +
    `try{Object.defineProperty(navigator,'serviceWorker',{value:undefined,configurable:true});}catch(e){}` +
    `window.__DV_ASSETS__=${JSON.stringify({ headshots, logos })};` +
    `</script>`;
  const assets = prelude;

  // The viewport meta has to be in the fragment: the artifact's own head has
  // none, and without it a phone renders the app into a letterbox.
  const fragment =
    `<title>Draft Vault</title>\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
    assets +
    '\n' +
    page.trim() +
    '\n';

  writeFileSync(OUT, fragment);
  console.log(`[artifact] ${OUT} — ${(Buffer.byteLength(fragment) / 1024 / 1024).toFixed(2)} MB`);
};

main().catch((error) => {
  console.error('[artifact]', error);
  process.exit(1);
});
