#!/usr/bin/env node
/**
 * Fold agent-gathered research into `research.json`, under the same contract.
 *
 *   node scripts/ingest-research.mjs <batches.json> [--out <path>] [--dry-run]
 *
 * `scripts/research-players.mjs` asks OpenRouter, which needs a key and spends
 * money. This is the other door: a Claude Code workflow searches the web with
 * its own tools, and hands back what it found. Both end up in the same file
 * because both come through `validateResearch` in `src/lib/researchContract.ts`
 * — one definition of what counts as sourced, so the panel cannot be shown a
 * finding that only one of the two doors would have accepted.
 *
 * The allowlist is the only thing that differs, and the difference is worth
 * being honest about. OpenRouter attaches the search engine's own
 * `url_citation` annotations, which the model cannot forge. An agent reports
 * the URLs its searches returned, which is self-reported. The structural rules
 * still bite — a citation must be on that list, carry a date, and the date must
 * be real and recent — and `--verify` re-fetches a sample to check the pages
 * exist and mention the player. What that buys is stated in CLAUDE.md rather
 * than assumed.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { citedUrls, validateResearch } from '../src/lib/researchContract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POOL = join(ROOT, 'src/data/nfl/pool.json');

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 || at === args.length - 1 ? fallback : args[at + 1];
};
const out = flag('out', join(ROOT, 'src/data/nfl/research.json'));
const dryRun = args.includes('--dry-run');

if (!input) {
  console.error('\n  Give me the batches file the workflow produced.\n');
  process.exit(1);
}

const pool = JSON.parse(readFileSync(POOL, 'utf8'));
const known = new Map(pool.players.map((player) => [player.gsis, player]));

const existing = existsSync(out)
  ? JSON.parse(readFileSync(out, 'utf8'))
  : { generatedAt: null, model: null, players: {} };
const players = { ...(existing.players ?? {}) };

const batches = JSON.parse(readFileSync(input, 'utf8'));
const tally = { players: 0, kept: 0, dropped: 0, silent: 0, unknown: 0, mismatched: 0 };
const complaints = [];
const now = new Date().toISOString();

for (const batch of Array.isArray(batches) ? batches : []) {
  // The URLs this batch's searches actually returned, in the shape citedUrls
  // already reads — so the allowlist is built by the same code either door
  // comes through, rather than a second reading of the same rule.
  const allowed = citedUrls({
    annotations: (batch?.searchUrls ?? []).map((url) => ({ url_citation: { url } })),
  });

  for (const entry of batch?.players ?? []) {
    const player = known.get(entry?.gsis);
    if (!player) {
      tally.unknown += 1;
      complaints.push(`no player has id ${entry?.gsis} (given as ${entry?.name})`);
      continue;
    }

    /*
     * The id and the name have to agree, and this is not belt-and-braces.
     *
     * A wrong id does not fail loudly: every id in this pool belongs to
     * *somebody*, so a transposed one silently writes one player's findings
     * onto another. It happened on the first run of this script — four ids in
     * ten were wrong, and a receiver's injury report landed on a tight end who
     * was perfectly fit. That is the worst shape a data error can take here,
     * because the room renders it with a source and a date and every reason to
     * be believed.
     *
     * The name is right there in the record. Refusing to guess between them is
     * the same rule the rankings importer lives by.
     */
    if (typeof entry?.name === 'string' && entry.name.trim() && entry.name !== player.name) {
      tally.mismatched += 1;
      complaints.push(`${entry.name} was given the id of ${player.name} (${entry.gsis})`);
      continue;
    }
    const record = validateResearch(entry, allowed);
    tally.players += 1;
    tally.kept += record.findings.length;
    tally.dropped += Object.values(record.dropped).reduce((a, b) => a + b, 0);
    if (!record.findings.length) tally.silent += 1;

    players[player.gsis] = {
      name: player.name,
      position: player.position,
      team: player.team,
      researchedAt: now,
      ...record,
    };
  }
}

console.log('\nDraft Vault — folding in what the agents found\n');
console.log(
  `  players      ${tally.players} researched, ${tally.unknown} unknown, ${tally.mismatched} whose id and name disagreed`
);
for (const complaint of complaints.slice(0, 12)) console.log(`               ! ${complaint}`);
console.log(`  findings     ${tally.kept} kept, ${tally.dropped} dropped for no source or no date`);
console.log(`  silent       ${tally.silent} had nothing to report`);
console.log(`  file now     ${Object.keys(players).length} players\n`);

if (dryRun) {
  console.log('  --dry-run: nothing written.\n');
  process.exit(0);
}

mkdirSync(dirname(out), { recursive: true });
const body = {
  generatedAt: now,
  model: 'claude-code-agents',
  engine: 'websearch',
  league: { receptionPoints: pool.league?.receptionPoints ?? 1 },
  contract:
    'Every finding cites a URL a search returned and a publication date. ' +
    'Claims that could not do both were dropped. No value, price or projection is produced here.',
  players,
};
writeFileSync(`${out}.tmp`, `${JSON.stringify(body, null, 2)}\n`);
renameSync(`${out}.tmp`, out);
console.log(`  written to   ${out}\n`);
