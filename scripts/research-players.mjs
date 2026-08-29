#!/usr/bin/env node
/**
 * What the numbers cannot know, researched one player at a time.
 *
 *   OPENROUTER_API_KEY=sk-or-... node scripts/research-players.mjs [flags]
 *
 * The pool is built from three seasons of play-by-play, so it knows exactly
 * what a player has done and nothing at all about what happened last Tuesday.
 * A holdout, a torn ACL in a joint practice, a new offensive coordinator, a
 * rookie who has taken the job in camp — none of that is in the tape, and all
 * of it moves a price. This script asks a web-searching model for precisely
 * that layer and nothing else.
 *
 * Three rules make the output trustworthy enough to sit next to computed
 * numbers:
 *
 *   1. It never produces a value. There is no dollar or projection field in
 *      the schema, so an opinion has nowhere to masquerade as a measurement.
 *      What comes back is findings plus a direction: pay up, fade, or nothing
 *      material.
 *   2. Every finding must carry a URL *that the search engine actually
 *      returned*. The response's `url_citation` annotations are the allowlist;
 *      a claim citing anything else is dropped and counted, because a model
 *      that can invent the source can invent the claim.
 *   3. Every finding must carry a publication date, so the room can see that
 *      the "questionable" tag is from March and ignore it.
 *
 * A player who ends up with no surviving findings gets no opinion. Silence is
 * the correct answer when nothing was found; a manufactured take is not.
 *
 * The key stays in this shell. Nothing here runs in the browser: the output is
 * a static file the app loads like any other, which is also what makes it
 * usable on draft night, where nobody can wait twenty seconds for a search
 * while the bidding is at $34.
 *
 * Writes src/data/nfl/research.json, merging into whatever is already there,
 * after every player — so a run that dies at 400 has kept 400.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The citation contract lives in the client tree so that the file this script
// writes and the panel that renders it cannot disagree about what counts as
// sourced. Node strips the types on import (v22.18+); CI pins that version.
import {
  OLDEST_USEFUL,
  citedUrls,
  parseReply,
  validateResearch,
} from '../src/lib/researchContract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POOL = join(ROOT, 'src/data/nfl/pool.json');
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 || at === args.length - 1 ? fallback : args[at + 1];
};
const has = (name) => args.includes(`--${name}`);
const int = (name, fallback) => {
  const raw = flag(name);
  const value = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
};

const options = {
  model: flag('model', 'anthropic/claude-sonnet-5'),
  out: flag('out', join(ROOT, 'src/data/nfl/research.json')),
  top: int('top', 0),
  position: flag('position'),
  player: flag('player'),
  maxAge: int('max-age', 3),
  concurrency: Math.max(1, int('concurrency', 4)),
  results: Math.max(1, int('results', 6)),
  limit: int('limit', 0),
  all: has('all'),
  dryRun: has('dry-run'),
  verbose: has('verbose'),
};

if (has('help')) {
  console.log(`
Research the pool with a web-searching model.

  --model <id>        OpenRouter model (default ${options.model})
  --top <n>           only the n most valuable players
  --position <POS>    QB RB WR TE K DST
  --player <text>     only players whose name contains this
  --max-age <days>    re-research anyone researched longer ago (default 3)
  --all               ignore --max-age and redo everyone selected
  --concurrency <n>   parallel requests (default 4)
  --results <n>       search results per player (default 6)
  --limit <n>         stop after n calls, whatever is selected
  --dry-run           print the plan and the cost estimate, call nothing
  --verbose           print each finding as it survives
  --out <path>        where to write (default src/data/nfl/research.json)
`);
  process.exit(0);
}

// ---------------------------------------------------------------- selection

const pool = JSON.parse(readFileSync(POOL, 'utf8'));
const league = pool.league ?? {};
const scoring =
  league.receptionPoints === 1
    ? 'full PPR (1 point per reception)'
    : league.receptionPoints === 0.5
      ? 'half PPR (0.5 points per reception)'
      : 'standard, no points per reception';

const existing = existsSync(options.out)
  ? JSON.parse(readFileSync(options.out, 'utf8'))
  : { generatedAt: null, model: null, players: {} };
const done = existing.players ?? {};

const ageInDays = (iso) => {
  const then = Date.parse(iso ?? '');
  return Number.isFinite(then) ? (Date.now() - then) / 86_400_000 : Infinity;
};

let selected = pool.players.slice();
if (options.position) {
  const want = options.position.toUpperCase();
  selected = selected.filter((p) => p.position === want);
}
if (options.player) {
  const want = options.player.toLowerCase();
  selected = selected.filter((p) => p.name.toLowerCase().includes(want));
}
// Most valuable first, so a run cut short by a budget or a crash has spent
// what it spent on the players who actually get bid on.
selected.sort((a, b) => (b.auctionValue ?? 0) - (a.auctionValue ?? 0));
if (options.top > 0) selected = selected.slice(0, options.top);
if (!options.all) {
  selected = selected.filter((p) => ageInDays(done[p.gsis]?.researchedAt) > options.maxAge);
}
if (options.limit > 0) selected = selected.slice(0, options.limit);

// ------------------------------------------------------------------ prompt

/**
 * What we already know, handed over so the model does not spend its answer
 * telling us the running back is good. The interesting finding is the one that
 * disagrees with this block.
 */
const dossier = (player) => {
  const lines = [
    `Name: ${player.name}`,
    `Position: ${player.position}, team ${player.team}, age ${player.age ?? 'unknown'}, ${player.experience ?? 0} seasons`,
    `Our projection: ${Math.round(player.projection?.points ?? 0)} points over ${player.projection?.expectedGames ?? 17} games (${scoring})`,
    `Our auction value: rank ${player.rank ?? '?'} at this position group, tier ${player.tier ?? '?'}`,
    `2025 snap share: ${player.snapShare ?? 'unknown'}%, role we have him in: ${player.role ?? 'unknown'}`,
    `Games missed in 2025: ${player.gamesMissed2025 ?? 0}; three-season total ${player.durability?.totalMissed ?? 0}`,
  ];
  if (player.competition?.nextUp) {
    lines.push(
      `Next on the depth chart behind him, by our reading: ${player.competition.nextUp}` +
        (player.competition.starterAhead
          ? `; ahead of him: ${player.competition.starterAhead}`
          : '')
    );
  }
  return lines.join('\n');
};

const SYSTEM = `You research NFL players for a fantasy football auction draft. Today is ${new Date().toISOString().slice(0, 10)}.

You are given what a statistical model already knows about a player: three seasons of production, snap share, injury history, depth-chart position. Do not repeat any of it back. Your only job is to find what changed that the tape cannot contain, and what it means.

Report only things in these categories, and only if you found them in a search result:
- injury, surgery, or a return timeline
- a holdout, suspension, or contract dispute
- a depth-chart or role change, including a rookie or signing taking work
- a coaching, scheme or play-caller change that moves his usage
- a trade, release, or team change
- credible beat-reporter reporting from camp or the preseason about his role
- anything that contradicts the model summary you were given

HARD RULES:
- Never state a dollar value, an auction price, a projected point total, or a rank. You are not valuing the player; something else does that. A contract figure quoted from a news story is fine, an opinion about what he is worth in a draft is not.
- Every finding must cite a URL you were actually given by the search results. Never construct, guess, shorten or complete a URL.
- Every finding must carry the date its source was published, as YYYY-MM-DD. If you cannot establish the date, drop the finding.
- Nothing found is a perfectly good answer. Return an empty findings list and the NEUTRAL direction rather than filling space.
- Prefer recent reporting. Anything published before ${OLDEST_USEFUL} is not news.

Reply with JSON only, no prose around it, in exactly this shape:
{
  "direction": "PAY_UP" | "FADE" | "NEUTRAL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "headline": "one clause, under 120 characters, no numbers about value",
  "findings": [
    {
      "claim": "one sentence, specific, in the past tense where it is a fact",
      "url": "the exact URL from the search results",
      "published": "YYYY-MM-DD",
      "impact": "POSITIVE" | "NEGATIVE" | "CONTEXT"
    }
  ]
}

"direction" is about the model's number, not about the player: PAY_UP means what you found argues his real outlook is better than that summary implies, FADE means worse, NEUTRAL means nothing you found moves it.`;

// ------------------------------------------------------------- the request

const key = process.env.OPENROUTER_API_KEY;

const ask = async (player) => {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/sylum-inc/draftervault',
      'X-Title': 'Draft Vault player research',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0,
      max_tokens: 1600,
      // Exa is pinned rather than left to the default. OpenRouter routes some
      // models to the provider's own native search, and native results do not
      // land in `annotations` the same way — which would quietly empty the
      // allowlist that rule 2 depends on and drop every finding as unsourced.
      plugins: [
        {
          id: 'web',
          engine: 'exa',
          max_results: options.results,
          search_prompt: `Recent news, injury reports and beat coverage about the NFL player ${player.name} (${player.position}, ${player.team}) and his role for the 2026 season.`,
        },
      ],
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: dossier(player) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
};

// -------------------------------------------------------------------- run

const money = (n) => `$${n.toFixed(2)}`;
// Exa's published rate: one search per request, whatever the result count, up
// to ten. Tokens are the other half and are read back off the response.
const SEARCH_COST = 0.007;

console.log('\nDraft Vault — researching the pool\n');
console.log(`  model        ${options.model}`);
console.log(`  selected     ${selected.length} of ${pool.players.length} players`);
console.log(
  `  already      ${Object.keys(done).length} on file` +
    (existing.generatedAt ? ` (last run ${existing.generatedAt.slice(0, 10)})` : '')
);
console.log(
  `  search cost  ${money(selected.length * SEARCH_COST)} at ${money(SEARCH_COST)} per player, plus tokens\n`
);

if (options.dryRun) {
  for (const player of selected.slice(0, 20)) {
    console.log(
      `    ${String(player.auctionValue).padStart(4)}  ${player.position.padEnd(4)} ${player.name}`
    );
  }
  if (selected.length > 20) console.log(`    … and ${selected.length - 20} more`);
  console.log('\n  --dry-run: nothing was called.\n');
  process.exit(0);
}

if (!key) {
  console.error('  OPENROUTER_API_KEY is not set. Nothing was called.\n');
  process.exit(1);
}
if (selected.length === 0) {
  console.log('  Nothing to research. Everyone selected is current.\n');
  process.exit(0);
}

const players = { ...done };
const counters = { ok: 0, failed: 0, silent: 0, findings: 0, dropped: 0, tokens: 0, cost: 0 };
let writing = null;

/** Save through a temp file, so a kill mid-write cannot truncate the record. */
const save = () => {
  const path = options.out;
  mkdirSync(dirname(path), { recursive: true });
  const body = {
    generatedAt: new Date().toISOString(),
    model: options.model,
    engine: 'exa',
    league: { receptionPoints: league.receptionPoints ?? 1 },
    contract:
      'Every finding cites a URL the search engine returned and a publication date. ' +
      'Claims that could not do both were dropped. No value, price or projection is produced here.',
    players,
  };
  writeFileSync(`${path}.tmp`, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
};

const research = async (player) => {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const payload = await ask(player);
      const message = payload?.choices?.[0]?.message;
      const answer = parseReply(message?.content ?? '');
      if (!answer) throw new Error('the reply was not JSON');

      const record = validateResearch(answer, citedUrls(message));
      counters.tokens += payload?.usage?.total_tokens ?? 0;
      counters.cost += Number(payload?.usage?.cost ?? 0) || SEARCH_COST;
      counters.findings += record.findings.length;
      counters.dropped += Object.values(record.dropped).reduce((a, b) => a + b, 0);
      if (record.findings.length === 0) counters.silent += 1;
      counters.ok += 1;

      players[player.gsis] = {
        name: player.name,
        position: player.position,
        team: player.team,
        researchedAt: new Date().toISOString(),
        ...record,
      };
      return record;
    } catch (error) {
      // 429 and 5xx are the provider asking us to slow down; anything else is
      // ours and retrying it just spends the same money twice.
      const retryable = error.status === 429 || (error.status >= 500 && error.status < 600);
      if (attempt >= 3 || (error.status && !retryable)) {
        counters.failed += 1;
        console.log(`    !!  ${player.name}: ${error.message}`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** (attempt - 1)));
    }
  }
};

const queue = selected.slice();
let started = 0;

const worker = async () => {
  for (;;) {
    const player = queue.shift();
    if (!player) return;
    const at = (started += 1);
    const record = await research(player);
    if (record) {
      const mark =
        record.direction === 'PAY_UP'
          ? '↑'
          : record.direction === 'FADE'
            ? '↓'
            : record.findings.length
              ? '·'
              : ' ';
      console.log(
        `  ${String(at).padStart(4)}/${selected.length} ${mark} ${player.position.padEnd(4)} ${player.name.padEnd(26)} ` +
          `${String(record.findings.length).padStart(2)} sourced` +
          (record.headline ? `  ${record.headline}` : '')
      );
      if (options.verbose) {
        for (const f of record.findings)
          console.log(`         ${f.published}  ${f.source}  ${f.claim}`);
      }
    }
    // Serialised behind whatever write is already in flight, so two workers
    // finishing together cannot interleave into the same file.
    writing = (writing ?? Promise.resolve()).then(save);
    await writing;
  }
};

await Promise.all(Array.from({ length: Math.min(options.concurrency, selected.length) }, worker));

console.log(`\n  researched   ${counters.ok}, failed ${counters.failed}`);
console.log(
  `  findings     ${counters.findings} kept, ${counters.dropped} dropped for no source or no date`
);
console.log(`  silent       ${counters.silent} players had nothing to report`);
console.log(
  `  spent        ${money(counters.cost)} over ${counters.tokens.toLocaleString()} tokens`
);
console.log(`  written to   ${options.out}\n`);
