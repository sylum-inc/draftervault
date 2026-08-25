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
 *   pool-identity.json  the auction pool mapped to real players and headshots
 *   defense-units.json  real defensive personnel per team, by unit
 *   unmatched.json      pool entries this run could not resolve (review these)
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

// ---------------------------------------------------------------------------
// name matching
//
// The auction pool stores abbreviated names ("J. Chase", "A.J. Brown"), so a
// match is: same team, same position, surnames equal once punctuation and
// generational suffixes are stripped — and if the pool gave a first initial, it
// has to agree. Anything left over goes to unmatched.json rather than being
// guessed at, because a wrong headshot is worse than none.
// ---------------------------------------------------------------------------

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/** Abbreviations the pool spells differently from ESPN. */
const TEAM_ALIASES = { JAC: 'JAX', AZ: 'ARI', WAS: 'WSH', LA: 'LAR', SD: 'LAC', OAK: 'LV', STL: 'LAR' };
const canonicalTeam = (abbr) => TEAM_ALIASES[abbr] ?? abbr;

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');

const surname = (full) => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && SUFFIXES.has(normalize(parts[parts.length - 1]))) parts.pop();
  return normalize(parts.slice(1).join('') || parts[0]);
};

const firstInitial = (full) => normalize(full.trim().split(/\s+/)[0])[0] ?? '';

/** Levenshtein, capped — only used to surface likely typos in the pool data. */
const editDistance = (a, b) => {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
};

// ---------------------------------------------------------------------------
// pool extraction — read the names straight out of the draft service so the two
// can never drift apart
// ---------------------------------------------------------------------------

const readPool = () => {
  const src = readFileSync(join(ROOT, 'src/services/auctionDraftService.ts'), 'utf8');
  const body = src.slice(src.indexOf('private initializePlayers'), src.indexOf('private initializeTeams'));
  const pool = [];
  const entry = /id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*position:\s*'([^']+)',\s*team:\s*'([^']+)'/g;
  let m;
  while ((m = entry.exec(body))) pool.push({ id: m[1], name: m[2], position: m[3], team: m[4] });
  return pool;
};

// ---------------------------------------------------------------------------

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

  // Resolve the auction pool against those rosters.
  const pool = readPool();
  const identity = [];
  const unmatched = [];

  const everyone = [...byTeam.values()].flat();

  for (const p of pool) {
    const team = canonicalTeam(p.team);
    const candidates = (byTeam.get(team) ?? []).filter((a) => a.position === p.position);
    const target = surname(p.name);
    const initial = firstInitial(p.name);
    const initialAgrees = (a) => !initial || firstInitial(a.name) === initial;

    /** Closest surname among a candidate set, only when it beats the runner-up. */
    const nearest = (pool_, maxDistance) => {
      const ranked = pool_
        .map((a) => ({ a, d: editDistance(surname(a.name), target) }))
        .filter(({ a, d }) => d <= maxDistance && initialAgrees(a))
        .sort((x, y) => x.d - y.d);
      if (!ranked.length) return null;
      if (ranked.length > 1 && ranked[0].d === ranked[1].d) return null;
      return ranked[0];
    };

    let hit = candidates.find((a) => surname(a.name) === target && initialAgrees(a));
    let confidence = 'exact';
    let note = null;

    if (!hit) {
      const near = nearest(candidates, 3);
      if (near) {
        hit = near.a;
        confidence = `fuzzy(${near.d})`;
        note = `pool spells this "${p.name}"`;
      }
    }

    // Still nothing on the listed team: the pool's roster data may simply be out
    // of date, so look league-wide and record where the player actually plays.
    if (!hit) {
      const leagueWide = everyone.filter((a) => a.position === p.position);
      let exact = leagueWide.filter((a) => surname(a.name) === target && initialAgrees(a));
      // Several players can share a surname ("Moore"); when the pool gives more
      // than a bare initial ("DJ."), that first token can break the tie.
      if (exact.length > 1) {
        const firstToken = normalize(p.name.trim().split(/\s+/)[0]);
        const byFirstName = exact.filter((a) => normalize(a.name.trim().split(/\s+/)[0]) === firstToken);
        if (byFirstName.length === 1) exact = byFirstName;
      }
      const chosen = exact.length === 1 ? { a: exact[0], d: 0 } : exact.length ? null : nearest(leagueWide, 1);
      if (chosen) {
        hit = chosen.a;
        confidence = 'moved';
        note = `pool lists ${p.team}; ESPN has ${chosen.a.team}`;
      }
    }

    if (!hit) {
      unmatched.push({ ...p, candidates: candidates.map((c) => c.name) });
      continue;
    }
    identity.push({ poolId: p.id, poolName: p.name, poolTeam: p.team, confidence, note, ...hit });
  }

  mkdirSync(OUT, { recursive: true });
  const meta = { source: 'ESPN public API', season, generatedAt: new Date().toISOString() };
  const write = (file, payload) => {
    writeFileSync(join(OUT, file), JSON.stringify(payload, null, 2) + '\n');
    console.log(`  ${file.padEnd(20)} ${(JSON.stringify(payload).length / 1024).toFixed(1)} KB`);
  };

  console.log(`ESPN ${season} — ${teams.length} teams, ${[...byTeam.values()].flat().length} athletes`);
  write('teams.json', { ...meta, teams });
  write('pool-identity.json', { ...meta, players: identity });
  write('defense-units.json', { ...meta, teams: defenseUnits });
  write('unmatched.json', { ...meta, players: unmatched });

  const flagged = identity.filter((p) => p.confidence !== 'exact');
  console.log(
    `matched ${identity.length}/${pool.length} pool players ` +
      `(${identity.length - flagged.length} exact, ${flagged.length} need review)`
  );
  for (const p of flagged) console.log(`  ~ ${p.poolName} -> ${p.name} [${p.confidence}] ${p.note ?? ''}`);
  for (const p of unmatched) console.log(`  ! ${p.name} (${p.position} ${p.team}) unresolved`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
