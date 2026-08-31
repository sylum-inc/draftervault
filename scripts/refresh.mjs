#!/usr/bin/env node
/**
 * The day-of refresh, in one command, with a report of what actually moved.
 *
 *   npm run refresh                  fetch the market, revalidate research, report
 *   npm run refresh -- --check       report only, change nothing
 *   npm run refresh -- --sheet f.txt report against a different commissioner's list
 *
 * The board fetches nothing on the night, so everything it knows is frozen at
 * the moment somebody last ran a script. That is fine and deliberate — it is
 * what makes the published artifact work — but it puts a ritual on draft
 * morning, and a ritual with four steps and no output is a ritual somebody
 * half-performs at nine in the morning with the draft at noon.
 *
 * So this does the two refreshes that are cheap and says what changed. What it
 * deliberately does **not** do is rebuild the board to tell you the new prices.
 * A second place that decides what a player is worth is the drift
 * `valuation.ts` exists to prevent, and a report that disagreed with the room
 * would be worse than no report. The board lives in the app; this reports the
 * *inputs* the board is built from, which is both exact and more actionable —
 * "Gibbs moved from ADP 1 to 4" is the thing to know, and the price follows
 * from it in the room where it belongs.
 *
 * The pool is not refreshed here on purpose. It is a nineteen-megabyte download
 * and a rebuild that moves every price on the board, which is the last thing
 * anybody wants between breakfast and a draft; and projections come from
 * seasons that have already finished, so they do not go off. What ages inside
 * that file is the roster and injury snapshot, and the research register
 * covers the part of that which moves in a week.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMarket, marketAge, describeMarket } from '../src/lib/marketContract.ts';
import { readAuctionSheet, sheetLoss } from '../src/lib/auctionSheet.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/data/nfl');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 || at === args.length - 1 ? fallback : args[at + 1];
};
const checkOnly = args.includes('--check');
const skipResearch = args.includes('--no-research');
const SHEET = resolve(ROOT, flag('sheet', 'src/data/league/auction-sheet.txt'));

/** How far a player has to move before it is worth a line. */
const ADP_MOVE = 8;

const read = (name) => {
  const path = join(DATA, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
};

const pool = read('pool.json');
if (!pool) {
  console.error('\n  No pool.json. Run `npm run build:pool` first.\n');
  process.exit(1);
}
const byId = new Map(pool.players.map((player) => [player.gsis, player]));

/** ADP by player, before anything is fetched. */
const adpMap = (snapshot) =>
  new Map((snapshot?.entries ?? []).map((entry) => [entry.gsis, entry.adp]));
/** Direction by player, so a flip can be noticed. */
const directions = (research) =>
  new Map(
    Object.entries(research?.players ?? {}).map(([id, record]) => [
      id,
      {
        direction: record.direction,
        // The headline is dropped when an audit refuses the finding that
        // produced it, so a player can carry a direction and no summary. The
        // first surviving claim is what is actually behind the direction in
        // that case, and printing the direction alone would be the confident
        // FADE with nothing under it that the contract exists to prevent.
        headline: record.headline || record.findings[0]?.claim || '',
        findings: record.findings.length,
      },
    ])
  );

const before = {
  market: validateMarket(read('market-adp.json')),
  adp: adpMap(read('market-adp.json')),
  research: directions(read('research.json')),
};

// ---------------------------------------------------------------------------
// the two cheap refreshes
// ---------------------------------------------------------------------------

const run = (label, command, commandArgs) => {
  process.stdout.write(`  ${label}… `);
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    console.log('failed');
    // Not fatal. A refresh that could not reach the market still has a report
    // worth printing, and the report is what says the market is now stale.
    const detail = (result.stderr || result.stdout || '').trim().split('\n').slice(-2);
    for (const line of detail) console.log(`     ${line}`);
    return false;
  }
  console.log('done');
  return true;
};

if (!checkOnly) {
  console.log('\nREFRESHING');
  run('draft market', 'node', ['scripts/fetch-adp.mjs']);
  if (!skipResearch) {
    run('research contract', 'node', ['scripts/ingest-research.mjs', '--revalidate']);
  }
}

const after = {
  market: validateMarket(read('market-adp.json')),
  adp: adpMap(read('market-adp.json')),
  research: directions(read('research.json')),
};

// ---------------------------------------------------------------------------
// what the commissioner's list resolves to
// ---------------------------------------------------------------------------

const candidates = pool.players.map((player) => ({
  id: player.gsis,
  name: player.name,
  position: player.position,
  team: player.team,
}));
const sheetText = existsSync(SHEET) ? readFileSync(SHEET, 'utf8') : null;
const parsed = sheetText ? readAuctionSheet(sheetText, candidates) : null;
// Only a *matched* row puts somebody on the sheet. A `Resolution` is a
// discriminated union on `status`, and reaching for an id that only the matched
// member carries reads as undefined on the others — which is right by accident
// here and would not be if the union ever gained a member with an `id`. Say
// which member is meant.
const onSheet = new Set(
  (parsed?.resolutions ?? [])
    .filter((row) => row.status === 'matched')
    .map((row) => row.player.id)
);

// ---------------------------------------------------------------------------
// the report
// ---------------------------------------------------------------------------

const now = Date.now();
const line = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);

console.log('\nWHAT THE BOARD KNOWS');
line('draft market', after.market ? describeMarket(after.market, now) : 'none — fetch failed');
if (before.market && after.market && before.market.to !== after.market.to) {
  line('', `was ${marketAge(before.market, now)} days old, now ${marketAge(after.market, now)}`);
}
const research = read('research.json');
line(
  'research',
  research?.generatedAt
    ? `${Math.floor((now - Date.parse(research.generatedAt)) / 86_400_000)} days old, ` +
        `${Object.values(research.players).reduce((n, p) => n + p.findings.length, 0)} findings`
    : 'none'
);
line(
  'rosters and injuries',
  pool.generatedAt
    ? `${Math.floor((now - Date.parse(pool.generatedAt)) / 86_400_000)} days old ` +
        `(projections do not age; the roster snapshot does)`
    : 'unknown'
);

console.log('\nTHE COMMISSIONER’S LIST');
if (!parsed) {
  line('sheet', `not found at ${SHEET}`);
} else {
  /*
   * The number that matters is how many rows named somebody, and it is not the
   * number of resolutions: an unmatched row is still a resolution. Reported the
   * other way this said "60 of 60" over the owner's real sheet while eight
   * names had failed — which is the one claim a report about a paste may not
   * get wrong, because those eight are players the room will now snake rather
   * than buy and `auctionSheetSize` drops with them, re-pricing the board for
   * an auction nobody is holding.
   *
   * `sheetLoss` is the app's own answer to that question, so the script and the
   * import panel cannot come to disagree about a paste — the same reason
   * `valuation.ts` is shared with the pool builder.
   */
  const loss = sheetLoss(parsed);
  line('resolved', `${onSheet.size} of ${loss.of} rows`);
  if (loss.lost) {
    line(
      'lost',
      `${loss.lost} rows (${Math.round(loss.share * 100)}%)` +
        (loss.severity === 'much' ? ' — worse than one in eight; fix these before draft day' : '')
    );
    for (const text of loss.lines) console.log(`     ${text}`);
  }
}

// The movers. Only on the sheet by default, because a player nobody is
// auctioning moving four places is not news on the morning of a draft.
const movers = [];
for (const [id, adp] of after.adp) {
  const was = before.adp.get(id);
  if (was == null) {
    if (onSheet.has(id)) movers.push({ id, was: null, now: adp, delta: Infinity });
    continue;
  }
  const delta = adp - was;
  if (Math.abs(delta) >= ADP_MOVE) movers.push({ id, was, now: adp, delta });
}
const sheetMovers = movers.filter((m) => onSheet.has(m.id));
const otherMovers = movers.filter((m) => !onSheet.has(m.id));

console.log('\nWHAT MOVED IN THE MARKET');
if (!before.adp.size) {
  console.log('  nothing to compare against — this is the first market snapshot');
} else if (!movers.length) {
  console.log(`  nobody moved more than ${ADP_MOVE} places`);
} else {
  const show = (rows, heading) => {
    if (!rows.length) return;
    console.log(`  ${heading}`);
    for (const m of rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15)) {
      const who = byId.get(m.id);
      const name = who ? `${who.name} ${who.position}` : m.id;
      const move = m.was == null ? 'new to the market' : `${m.was.toFixed(1)} → ${m.now.toFixed(1)}`;
      const arrow = m.was == null ? '' : m.delta < 0 ? '  (rising)' : '  (falling)';
      console.log(`    ${name.padEnd(28)} ${move}${arrow}`);
    }
  };
  show(sheetMovers, `on your sheet — these are the ones that change what a bid buys`);
  show(otherMovers, `elsewhere — these change who the snake hands you free`);
}

// A direction that flipped is the thing most likely to change a decision, and
// the free men matter as much as the players for sale: the whole gain is a
// difference against one of them.
console.log('\nWHAT MOVED IN THE RESEARCH');
const flips = [];
for (const [id, next] of after.research) {
  const was = before.research.get(id);
  if (!was) {
    if (next.findings > 0) flips.push({ id, from: 'nothing', to: next.direction, headline: next.headline });
    continue;
  }
  if (was.direction !== next.direction) {
    flips.push({ id, from: was.direction, to: next.direction, headline: next.headline });
  }
}
for (const [id, was] of before.research) {
  if (!after.research.has(id) && was.findings > 0) {
    flips.push({ id, from: was.direction, to: 'nothing', headline: '' });
  }
}
if (!flips.length) {
  console.log('  no direction changed');
} else {
  for (const flip of flips.slice(0, 20)) {
    const who = byId.get(flip.id);
    const where = onSheet.has(flip.id) ? 'on the sheet' : 'free in the snake';
    console.log(`    ${(who?.name ?? flip.id).padEnd(24)} ${flip.from} → ${flip.to}  (${where})`);
    if (flip.headline) console.log(`      ${flip.headline}`);
  }
}

// The standing flags. Not a change, but the thing worth re-reading on the
// morning: a FADE on a man the whole plan is measured against.
const freeFlags = [...after.research.entries()]
  .filter(([id, r]) => r.direction !== 'NEUTRAL' && r.findings > 0 && !onSheet.has(id))
  .filter(([id]) => byId.has(id))
  .map(([id, r]) => ({ id, ...r }));
console.log('\nFLAGS ON MEN THE SNAKE WOULD HAND YOU FREE');
console.log('  (the gain on every bid is a difference against one of these)');
if (!freeFlags.length) console.log('  none');
else {
  for (const row of freeFlags.slice(0, 12)) {
    const who = byId.get(row.id);
    console.log(`    ${who.name.padEnd(24)} ${who.position}  ${row.direction}`);
    if (row.headline) console.log(`      ${row.headline.slice(0, 150)}`);
  }
  const byPosition = {};
  for (const row of freeFlags) {
    const pos = byId.get(row.id).position;
    byPosition[pos] ??= { FADE: 0, PAY_UP: 0 };
    byPosition[pos][row.direction] += 1;
  }
  console.log('');
  for (const [pos, counts] of Object.entries(byPosition)) {
    console.log(
      `    ${pos.padEnd(5)} ${counts.FADE} fading, ${counts.PAY_UP} being paid up for` +
        (counts.FADE > counts.PAY_UP
          ? '  — the free man here may be worse than his projection, so a bid at this position buys more'
          : counts.PAY_UP > counts.FADE
            ? '  — the free man here may be better, so a bid at this position buys less'
            : '')
    );
  }
}

console.log('\nNEXT');
if (checkOnly) {
  console.log('  nothing was changed. Drop --check to actually refresh.');
} else {
  console.log('  npm run build:artifact     rebuild the self-contained page');
  console.log('  then republish it, and open it once to confirm the board looks right.');
}
console.log(
  '  the pool itself is untouched: it is a 19MB download and a rebuild that moves every price.\n'
);

const jsonOut = flag('json');
if (jsonOut) {
  writeFileSync(
    resolve(ROOT, jsonOut),
    `${JSON.stringify({ market: after.market, movers, flips, sheet: parsed?.resolutions.length ?? 0 }, null, 2)}\n`
  );
  console.log(`  wrote ${jsonOut}\n`);
}
