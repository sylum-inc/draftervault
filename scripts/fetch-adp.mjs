#!/usr/bin/env node
/**
 * The draft market, refreshed on its own.
 *
 *   node scripts/fetch-adp.mjs [--year 2026] [--teams 12] [--scoring half-ppr]
 *                              [--out src/data/nfl/market-adp.json] [--dry]
 *
 * WHY THIS IS A SEPARATE SCRIPT AND A SEPARATE FILE. `npm run backtest` found
 * that this board's own ordering loses to the draft market in every held-out
 * season, and the app now offers to price off the market instead. That makes
 * the market's freshness a first-order property of the board rather than
 * housekeeping — and the consensus already in the pool can only be refreshed by
 * `build:pool`, which downloads nineteen megabytes of play-by-play and takes
 * minutes. This is one small endpoint. Run it the morning of the draft, rebuild,
 * and the board is ordered by what the room did yesterday.
 *
 * WHY ADP RATHER THAN THE EXPERT CONSENSUS ALREADY BUNDLED. Because ADP is the
 * signal that was actually measured. The backtest scored Fantasy Football
 * Calculator's half-PPR ADP — thousands of real drafts — and the "use the
 * market" button initially shipped driven by FantasyPros ECR, an analyst panel,
 * purely because that is what the pool carried. They are not the same signal
 * and they disagree at the top of the board, which is where the money goes.
 * ECR still has its use here: it ranks 383 players where ADP ranks about 230,
 * so it extends the ordering past the point real drafts stop caring.
 *
 * HALF PPR, matching the league everything else here is scored at. It costs
 * sample against the full-PPR feed and that is the right trade — a noisier
 * measure of the right league beats a precise measure of a different one.
 *
 * NAMES, AND THE REFUSAL TO GUESS. This feed carries no ids, which is the one
 * place in this codebase a join has to be made on a name. So it follows the
 * rule `rankingsCsv` and `auctionSheet` already live by: a name that matches
 * two players matches neither, and is reported rather than bound. Nothing is
 * written for a row that could not be resolved unambiguously.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_CONTRACT, describeMarket, validateMarket } from '../src/lib/marketContract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const YEAR = Number(flag('year', new Date().getUTCFullYear()));
const TEAMS = Number(flag('teams', 12));
const SCORING = String(flag('scoring', 'half-ppr'));
const OUT = resolve(ROOT, flag('out', 'src/data/nfl/market-adp.json'));
const DRY = args.includes('--dry');

/**
 * Punctuation, case, accents and generational suffixes all go.
 *
 * The same normalisation the backtest matches ADP with, because the backtest's
 * 161/153/140 resolved rows are the evidence that this join works at all — a
 * second, subtly different normaliser here would be matching by a rule nobody
 * has ever checked against an outcome.
 */
const normaliseName = (name) =>
  String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z]/g, '');

/** FFC writes defences as a club name; the pool keys them by club. */
const POSITION_ALIAS = { DEF: 'DST', PK: 'K' };

const main = async () => {
  const poolPath = join(ROOT, 'src/data/nfl/pool.json');
  const pool = JSON.parse(readFileSync(poolPath, 'utf8'));
  const players = pool.players ?? pool;

  // A name may belong to two players; the pool is the side that knows.
  const byName = new Map();
  const byTeamDefence = new Map();
  for (const player of players) {
    if (player.position === 'DST') {
      byTeamDefence.set(player.team, player);
      continue;
    }
    const key = `${normaliseName(player.name)}|${player.position}`;
    byName.set(key, byName.has(key) ? 'ambiguous' : player);
  }

  const url =
    `https://fantasyfootballcalculator.com/api/v1/adp/${SCORING}` +
    `?teams=${TEAMS}&year=${YEAR}&position=all`;
  console.log(`fetching ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ADP feed returned ${response.status} ${response.statusText}`);
  const feed = await response.json();
  if (feed.status !== 'Success') throw new Error(`ADP feed said: ${feed.status}`);

  const rows = feed.players ?? [];
  const entries = [];
  const ambiguous = [];
  const missing = [];
  for (const row of rows) {
    const position = POSITION_ALIAS[row.position] ?? row.position;
    let found;
    if (position === 'DST') {
      // "Denver Broncos" carries its club in the team field already.
      found = byTeamDefence.get(row.team) ?? null;
    } else {
      found = byName.get(`${normaliseName(row.name)}|${position}`) ?? null;
    }
    if (found === 'ambiguous') {
      ambiguous.push(`${row.name} (${position})`);
      continue;
    }
    if (!found) {
      // Kept, not dropped. Some of these are 2026 rookies with no NFL tape and
      // some are veterans nflverse's roster file has not caught up with — and
      // the second kind are being taken in real drafts right now. A player the
      // room drafts but this board cannot even nominate is the worst shape a
      // gap can take on the night, so the snapshot carries them and the app
      // makes them draftable.
      missing.push({ name: row.name, position, team: row.team, adp: row.adp });
      continue;
    }
    entries.push({
      gsis: found.gsis,
      adp: row.adp,
      timesDrafted: row.times_drafted ?? undefined,
      high: row.high ?? undefined,
      low: row.low ?? undefined,
      stdev: row.stdev ?? undefined,
    });
  }

  entries.sort((a, b) => a.adp - b.adp);
  const snapshot = {
    contract: MARKET_CONTRACT,
    source: `Fantasy Football Calculator ${feed.meta?.type ?? SCORING}`,
    scoring: feed.meta?.type ?? SCORING,
    teams: feed.meta?.teams ?? TEAMS,
    drafts: feed.meta?.total_drafts ?? 0,
    from: feed.meta?.start_date ?? '',
    to: feed.meta?.end_date ?? '',
    fetchedAt: new Date().toISOString(),
    entries,
    // Everybody the market drafts that the pool has never heard of.
    absent: missing.sort((a, b) => a.adp - b.adp),
  };

  // Refuse to write something the client would then refuse to read. The two
  // halves ship from one checkout; a file only one of them accepts is the
  // failure `serverContract` and `researchContract` both exist to prevent.
  if (!validateMarket(snapshot)) {
    throw new Error('built a snapshot that validateMarket rejects — refusing to write it');
  }

  console.log(`  matched ${entries.length} of ${rows.length}`);
  if (ambiguous.length) {
    console.log(`  ${ambiguous.length} ambiguous, left out rather than guessed:`);
    for (const name of ambiguous) console.log(`    ${name}`);
  }
  if (missing.length) {
    console.log(`  ${missing.length} not in the pool — carried so they stay draftable:`);
    for (const row of missing.slice(0, 12)) {
      console.log(`    ADP ${String(row.adp).padStart(5)}  ${row.name} (${row.position} ${row.team})`);
    }
    if (missing.length > 12) console.log(`    …and ${missing.length - 12} more`);
  }
  console.log(`  ${describeMarket(snapshot)}`);

  if (DRY) {
    console.log('  --dry, nothing written');
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`wrote ${OUT}`);
};

main().catch((error) => {
  // A market refresh must never leave a half-written file behind: the previous
  // snapshot is stale, which is a known quantity, and a truncated one is not.
  console.error(String(error?.message ?? error));
  process.exit(1);
});
