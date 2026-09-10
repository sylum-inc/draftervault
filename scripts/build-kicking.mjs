#!/usr/bin/env node
/**
 * Every kick a kicker took last season, with its distance and what happened.
 *
 * The pool prices a kicker off his points and knows nothing about how he got
 * them, and the two things a drafter wants to know about a kicker — does he make
 * the long ones, and does his offence give him chances — are not in it. The
 * 2025 weekly asset carries both: `fg_made_list` / `fg_missed_list` /
 * `fg_blocked_list` are the distances of every attempt in a game, semicolon
 * separated, beside the PAT counts. This folds them into one small file the
 * dossier loads lazily, the way it loads the defensive units.
 *
 * Reads the cached asset the pool builder already downloaded; it does not fetch.
 *
 *   node scripts/build-kicking.mjs [--in .cache/nfl/stats_2025.csv] [--out src/data/nfl/kicking.json]
 */
import { writeFileSync, existsSync } from 'node:fs';
import { readCsv, num } from './nflverse.mjs';

const arg = (flag, fallback) => {
  const at = process.argv.indexOf(flag);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const input = arg('--in', '.cache/nfl/stats_2025.csv');
const output = arg('--out', 'src/data/nfl/kicking.json');
if (!existsSync(input)) {
  console.error(`No weekly stats at ${input}. Run npm run build:pool once to fetch it.`);
  process.exit(1);
}

const distances = (value) =>
  String(value ?? '')
    .split(';')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part) && part > 0);

const wanted = [
  'player_id',
  'player_display_name',
  'position',
  'team',
  'season',
  'week',
  'season_type',
  'fg_made_list',
  'fg_missed_list',
  'fg_blocked_list',
  'fg_long',
  'pat_made',
  'pat_att',
];

const kickers = new Map();
let season = null;
for (const row of readCsv(input, wanted)) {
  if (row.position !== 'K') continue;
  if (row.season_type && row.season_type !== 'REG') continue;
  season = season ?? num(row.season);
  const id = row.player_id;
  const entry = kickers.get(id) ?? {
    name: row.player_display_name,
    team: row.team,
    games: [],
  };
  entry.team = row.team || entry.team;
  entry.games.push({
    week: num(row.week),
    made: distances(row.fg_made_list),
    missed: distances(row.fg_missed_list),
    blocked: distances(row.fg_blocked_list),
    patMade: num(row.pat_made),
    patAtt: num(row.pat_att),
  });
  kickers.set(id, entry);
}

const out = {
  source: 'nflverse stats_player_week (regular season)',
  season,
  generatedAt: new Date().toISOString(),
  kickers: Object.fromEntries(
    [...kickers.entries()].map(([id, entry]) => {
      entry.games.sort((a, b) => a.week - b.week);
      const all = entry.games.flatMap((game) => [
        ...game.made.map((d) => ({ d, r: 'made' })),
        ...game.missed.map((d) => ({ d, r: 'missed' })),
        ...game.blocked.map((d) => ({ d, r: 'blocked' })),
      ]);
      const made = all.filter((k) => k.r === 'made');
      return [
        id,
        {
          ...entry,
          attempts: all.length,
          made: made.length,
          long: made.reduce((best, k) => Math.max(best, k.d), 0),
          patMade: entry.games.reduce((sum, g) => sum + g.patMade, 0),
          patAtt: entry.games.reduce((sum, g) => sum + g.patAtt, 0),
        },
      ];
    })
  ),
};

writeFileSync(output, JSON.stringify(out));
const count = Object.keys(out.kickers).length;
const kicks = Object.values(out.kickers).reduce((sum, k) => sum + k.attempts, 0);
console.log(`[build-kicking] ${count} kickers, ${kicks} attempts in ${season} → ${output}`);
