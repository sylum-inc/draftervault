#!/usr/bin/env node
/**
 * Builds the curated NFL identity data the app falls back to when the live
 * ESPN endpoints are unavailable.
 *
 *   node scripts/fetch-nfl-data.mjs [--cache <dir>] [--offline]
 *
 * --cache stores every raw ESPN payload so repeat runs are reproducible and do
 * not hammer their servers; --offline refuses to make any request and fails if
 * the cache is incomplete.
 *
 * Writes to src/data/nfl/:
 *   teams.json          32 teams: colors, logos, ESPN ids
 *   defense-units.json  real defensive personnel per team, by unit
 *
 * The draft pool itself is built separately by scripts/build-player-pool.mjs,
 * which sources players from nflverse and needs no name matching.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/nfl');
const API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

const args = process.argv.slice(2);
const cacheDir = args.includes('--cache') ? args[args.indexOf('--cache') + 1] : join(ROOT, '.cache/espn');
const offline = args.includes('--offline');

// ---------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------

const getJSON = async (url, cacheKey) => {
  const cached = join(cacheDir, cacheKey);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  if (offline) throw new Error(`--offline and no cache entry for ${cacheKey}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const json = await res.json();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cached, JSON.stringify(json));
  return json;
};

const UNIT_BY_POSITION = {
  dl: ['DE', 'DT', 'NT', 'EDGE'],
  lb: ['LB', 'ILB', 'OLB', 'MLB'],
  db: ['CB', 'S', 'FS', 'SS', 'DB'],
};

const unitFor = (abbr) =>
  Object.keys(UNIT_BY_POSITION).find((unit) => UNIT_BY_POSITION[unit].includes(abbr));

const athleteRecord = (a, teamAbbr) => ({
  espnId: a.id,
  name: a.fullName ?? a.displayName,
  team: teamAbbr,
  position: a.position?.abbreviation ?? '',
  jersey: a.jersey ?? null,
  age: a.age ?? null,
  experience: a.experience?.years ?? null,
  heightInches: a.height ?? null,
  weightPounds: a.weight ?? null,
  college: a.college?.name ?? null,
  headshot: a.headshot?.href ?? null,
  status: a.status?.name ?? null,
  injury: a.injuries?.[0]
    ? { status: a.injuries[0].status ?? null, detail: a.injuries[0].details?.type ?? null }
    : null,
});

const main = async () => {
  const teamsPayload = await getJSON(`${API}/teams`, 'teams.json');
  const league = teamsPayload.sports[0].leagues[0];
  const season = league.season?.year ?? null;

  const teams = league.teams.map(({ team }) => ({
    abbr: team.abbreviation,
    espnId: team.id,
    name: team.displayName,
    nickname: team.name,
    location: team.location,
    color: `#${team.color}`,
    altColor: `#${team.alternateColor}`,
    logo: team.logos?.[0]?.href ?? `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`,
  }));

  // Index every rostered athlete, and collect defensive personnel per team.
  const byTeam = new Map();
  const defenseUnits = {};

  for (const team of teams) {
    const roster = await getJSON(`${API}/teams/${team.espnId}/roster`, `roster-${team.espnId}.json`);
    const active = (roster.athletes ?? [])
      .filter((g) => ['offense', 'defense', 'specialTeam'].includes(g.position))
      .flatMap((g) => g.items ?? [])
      .map((a) => athleteRecord(a, team.abbr));

    byTeam.set(team.abbr, active);

    const units = { dl: [], lb: [], db: [] };
    for (const a of active) {
      const unit = unitFor(a.position);
      if (unit) units[unit].push(a);
    }
    // Jersey number is the closest thing the roster feed gives to a depth order.
    const byJersey = (x, y) => Number(x.jersey ?? 99) - Number(y.jersey ?? 99);
    defenseUnits[team.abbr] = {
      dl: units.dl.sort(byJersey).slice(0, 4),
      lb: units.lb.sort(byJersey).slice(0, 4),
      db: units.db.sort(byJersey).slice(0, 5),
    };
  }

  mkdirSync(OUT, { recursive: true });
  const meta = { source: 'ESPN public API', season, generatedAt: new Date().toISOString() };
  const write = (file, payload) => {
    writeFileSync(join(OUT, file), JSON.stringify(payload, null, 2) + '\n');
    console.log(`  ${file.padEnd(20)} ${(JSON.stringify(payload).length / 1024).toFixed(1)} KB`);
  };

  console.log(`ESPN ${season} — ${teams.length} teams, ${[...byTeam.values()].flat().length} athletes`);
  write('teams.json', { ...meta, teams });
  write('defense-units.json', { ...meta, teams: defenseUnits });
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
