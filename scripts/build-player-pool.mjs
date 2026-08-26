#!/usr/bin/env node
/**
 * Builds the draft pool from real NFL data.
 *
 *   node scripts/build-player-pool.mjs [--cache <dir>] [--offline]
 *
 * Replaces the hand-typed player list with ~600 players drawn from actual
 * rosters, actual production, and a projection model documented below. Nothing
 * here is invented: every number either comes from a source file or from the
 * model in `project()`, which is deliberately simple enough to audit.
 *
 * Sources (all free, no keys):
 *   nflverse  players.csv                 cross-source id map (gsis <-> espn <-> pfr)
 *             roster_2026.csv             who is on a team right now
 *             player_stats.csv            weekly stats, 1999-2024 (legacy schema)
 *             stats_player_week_2025.csv  weekly stats, 2025 (150-column schema)
 *             snap_counts_2025.csv        snap share, keyed by pfr id
 *             injuries_2025.csv           games missed
 *             draft_picks.csv             draft capital, for rookies with no tape
 *             play_by_play_2025.csv.gz    red-zone usage, team pace and pass rate
 *             injuries_2023-25.csv        games missed, three seasons deep
 *   Sleeper   players/nfl                 market rank, depth chart order
 *   DynastyProcess
 *             db_playerids.csv            gsis <-> sleeper <-> fantasypros
 *             db_fpecr_latest.csv         FantasyPros expert consensus rank
 *
 * Writes src/data/nfl/pool.json and src/data/nfl/player-history.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gunzipSync } from 'node:zlib';
// The league shape and the points-to-dollars maths live in the client tree so
// that the browser and this script cannot disagree about what a player is
// worth. Node strips the types on import (v22.18+); CI pins that version.
import {
  DEFAULT_LEAGUE,
  LEAGUE_LIMITS,
  pricePool,
  rosteredForTeams,
} from '../src/lib/valuation.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/nfl');
const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download';
const DYNASTYPROCESS = 'https://github.com/dynastyprocess/data/raw/master/files';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const cacheDir = flag('cache', join(ROOT, '.cache/nfl'));
const offline = args.includes('--offline');

/** The seasons that inform a projection. Older tape exists but stops mattering. */
const SEASONS = [2023, 2024, 2025];
/** Injury history reaches back further: durability is a slower-moving trait. */
const INJURY_SEASONS = [2023, 2024, 2025];
const CURRENT_SEASON = 2026;

const SOURCES = {
  'players.csv': `${NFLVERSE}/players/players.csv`,
  'roster_2026.csv': `${NFLVERSE}/rosters/roster_${CURRENT_SEASON}.csv`,
  'player_stats.csv': `${NFLVERSE}/player_stats/player_stats.csv`,
  'stats_2025.csv': `${NFLVERSE}/stats_player/stats_player_week_2025.csv`,
  'snaps_2025.csv': `${NFLVERSE}/snap_counts/snap_counts_2025.csv`,
  'injuries_2025.csv': `${NFLVERSE}/injuries/injuries_2025.csv`,
  'injuries_2024.csv': `${NFLVERSE}/injuries/injuries_2024.csv`,
  'injuries_2023.csv': `${NFLVERSE}/injuries/injuries_2023.csv`,
  // Play-by-play is the only source for where on the field a touch happened and
  // for what a team's play-calling looks like. 19MB gzipped for one season.
  'pbp_2025.csv.gz': `${NFLVERSE}/pbp/play_by_play_2025.csv.gz`,
  'draft_picks.csv': `${NFLVERSE}/draft_picks/draft_picks.csv`,
  'team_2025.csv': `${NFLVERSE}/stats_team/stats_team_reg_2025.csv`,
  'games.csv': `${NFLVERSE}/schedules/games.csv`,
  'sleeper.json': 'https://api.sleeper.app/v1/players/nfl',
  // nflverse's crosswalk stops at ESPN and PFR. DynastyProcess maintains the
  // fantasy-side one — Sleeper and FantasyPros ids keyed by gsis — which is the
  // only way to reach either market without matching on names.
  'db_playerids.csv': `${DYNASTYPROCESS}/db_playerids.csv`,
  'db_fpecr_latest.csv': `${DYNASTYPROCESS}/db_fpecr_latest.csv`,
};

/** nflverse spells a few teams differently from ESPN. */
const TEAM_ALIASES = { LA: 'LAR', JAC: 'JAX', AZ: 'ARI', WAS: 'WSH', SD: 'LAC', OAK: 'LV', STL: 'LAR' };
const canonicalTeam = (abbr) => TEAM_ALIASES[abbr] ?? abbr;

/**
 * League shape the shipped valuations assume: twelve teams, $200 each, sixteen
 * roster spots. It is imported rather than declared here — src/lib/valuation.ts
 * is the only definition, and the client recomputes from it, so a league the
 * pool was not built for still prices correctly.
 */
const LEAGUE = DEFAULT_LEAGUE;

/** Scoring for kickers, who carry no PPR value in the source data. */
const kickerPoints = (row) => {
  const n = (key) => num(row[key]);
  const short = n('fg_made_0_19') + n('fg_made_20_29') + n('fg_made_30_39');
  const mid = n('fg_made_40_49');
  const long = n('fg_made_50_59') + n('fg_made_60_');
  const bucketed = short + mid + long;
  // Fall back to an average field-goal value when the buckets are absent.
  const fromFgs = bucketed > 0 ? short * 3 + mid * 4 + long * 5 : n('fg_made') * 3.4;
  return fromFgs + n('pat_made');
};

// ---------------------------------------------------------------------------
// fetching and CSV
// ---------------------------------------------------------------------------

const cached = async (name) => {
  const path = join(cacheDir, name);
  if (existsSync(path)) return path;
  if (offline) throw new Error(`--offline and ${name} is not cached`);
  mkdirSync(cacheDir, { recursive: true });
  process.stdout.write(`  fetching ${name}… `);
  const res = await fetch(SOURCES[name], { redirect: 'follow' });
  if (!res.ok) throw new Error(`${SOURCES[name]} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  console.log('done');
  return path;
};

/**
 * Minimal RFC 4180 reader. These files quote any field containing a comma —
 * college names, injury descriptions and every play-by-play description do —
 * so splitting on commas silently corrupts rows.
 *
 * `wanted` narrows each record to a handful of columns. Play-by-play carries
 * 372 of them across ~50k rows; materialising all of it is 18M property writes
 * and gigabytes of strings for the dozen fields anything here actually reads.
 */
function* readCsv(path, wanted) {
  const text = path.endsWith('.gz')
    ? gunzipSync(readFileSync(path)).toString('utf8')
    : readFileSync(path, 'utf8');
  const header = [];
  let keep = null;
  let field = '';
  let row = [];
  let quoted = false;
  let isHeader = true;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (isHeader) {
      header.push(...row);
      isHeader = false;
      if (wanted) {
        const set = new Set(wanted);
        keep = header.map((name, index) => (set.has(name) ? index : -1)).filter((i) => i >= 0);
      }
    } else if (row.length > 1) {
      const record = {};
      if (keep) for (const i of keep) record[header[i]] = row[i] ?? '';
      else for (let i = 0; i < header.length; i++) record[header[i]] = row[i] ?? '';
      return record;
    }
    row = [];
    return null;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') endField();
    else if (char === '\n') {
      const record = endRow();
      row = [];
      if (record) yield record;
    } else if (char !== '\r') field += char;
  }
  if (field || row.length) {
    const record = endRow();
    if (record) yield record;
  }
}

const num = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------------------------
// weekly stats: two schema generations, one shape
//
// The 1999-2024 asset carries 53 columns; the 2025 asset carries 150 and renamed
// several of them. Everything downstream reads this normalized row instead.
// ---------------------------------------------------------------------------

const normalizeWeek = (row) => ({
  playerId: row.player_id,
  season: num(row.season),
  week: num(row.week),
  position: row.position,
  team: row.recent_team || row.team || '',
  seasonType: row.season_type,
  passingYards: num(row.passing_yards),
  passingTds: num(row.passing_tds),
  interceptions: num(row.interceptions ?? row.passing_interceptions),
  carries: num(row.carries),
  rushingYards: num(row.rushing_yards),
  rushingTds: num(row.rushing_tds),
  targets: num(row.targets),
  receptions: num(row.receptions),
  receivingYards: num(row.receiving_yards),
  receivingTds: num(row.receiving_tds),
  receivingAirYards: num(row.receiving_air_yards),
  yardsAfterCatch: num(row.receiving_yards_after_catch),
  targetShare: num(row.target_share),
  airYardsShare: num(row.air_yards_share),
  wopr: num(row.wopr),
  racr: num(row.racr),
  receivingEpa: num(row.receiving_epa),
  rushingEpa: num(row.rushing_epa),
  passingEpa: num(row.passing_epa),
  receivingFirstDowns: num(row.receiving_first_downs),
  rushingFirstDowns: num(row.rushing_first_downs),
  fantasyPointsPpr: row.position === 'K' ? kickerPoints(row) : num(row.fantasy_points_ppr),
});

// ---------------------------------------------------------------------------
// projection model
//
// Deliberately transparent. A player's rate of scoring is the recency-weighted
// average of their points per game, shrunk toward the positional baseline in
// proportion to how little we have seen of them, then adjusted for age. Volume
// is expected games, discounted by how much time they have actually missed.
//
//   points = shrunk_ppg x age_multiplier x expected_games
//
// Every constant is named and sits in one place so it can be argued with.
// ---------------------------------------------------------------------------

/** Recency weights for the three seasons of tape. */
const SEASON_WEIGHTS = { 2023: 0.2, 2024: 0.3, 2025: 0.5 };

/**
 * Games of prior to blend in. Higher means the position regresses harder toward
 * its baseline. Kicking barely predicts itself from one season to the next, so
 * kickers are shrunk until the spread between them nearly disappears — which is
 * why a real auction prices them all at a dollar.
 */
const SHRINKAGE_GAMES = { QB: 8, RB: 8, WR: 8, TE: 8, K: 60 };

/** Peak window and decline rate per position, from the shape of aging curves. */
const AGE_CURVE = {
  QB: { peakStart: 26, peakEnd: 34, declinePerYear: 0.02, risePerYear: 0.03 },
  RB: { peakStart: 23, peakEnd: 27, declinePerYear: 0.07, risePerYear: 0.05 },
  WR: { peakStart: 25, peakEnd: 29, declinePerYear: 0.04, risePerYear: 0.05 },
  TE: { peakStart: 26, peakEnd: 30, declinePerYear: 0.04, risePerYear: 0.06 },
  K: { peakStart: 24, peakEnd: 36, declinePerYear: 0.01, risePerYear: 0.01 },
};

const ageMultiplier = (position, age) => {
  const curve = AGE_CURVE[position];
  if (!curve || !age) return 1;
  if (age < curve.peakStart) return 1 - (curve.peakStart - age) * curve.risePerYear;
  if (age > curve.peakEnd) return Math.max(0.45, 1 - (age - curve.peakEnd) * curve.declinePerYear);
  return 1;
};

/**
 * What a rookie is worth before anyone has seen them play, by draft capital.
 * Derived empirically in `rookieBaselines()` from every drafted skill player
 * since 2010 — not guessed.
 */
const rookieBaselines = (draftPicks, seasonsByPlayer) => {
  const buckets = new Map(); // `${position}:${round}` -> points per game samples
  for (const pick of draftPicks) {
    const position = pick.position;
    if (!AGE_CURVE[position] || position === 'K') continue;
    const year = num(pick.season);
    if (year < 2010 || year > 2024) continue;
    const seasons = seasonsByPlayer.get(pick.gsis_id);
    const rookieYear = seasons?.get(year);
    if (!rookieYear || rookieYear.games < 4) continue;
    const key = `${position}:${Math.min(7, num(pick.round))}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(rookieYear.pprPoints / rookieYear.games);
  }
  const baseline = new Map();
  for (const [key, samples] of buckets) {
    samples.sort((a, b) => a - b);
    baseline.set(key, {
      median: samples[Math.floor(samples.length / 2)],
      n: samples.length,
    });
  }
  return baseline;
};

// ---------------------------------------------------------------------------
// play-by-play: where a touch happened, and what a team likes to do
//
// Two things no aggregate can answer. A running back's carry count does not say
// how many came from the two-yard line, and a receiver's target count does not
// say whether his offense throws at all. Both decide what a player is worth,
// and both need the plays themselves.
// ---------------------------------------------------------------------------

const PBP_COLUMNS = [
  'game_id',
  'posteam',
  'play_type',
  'yardline_100',
  'rusher_player_id',
  'receiver_player_id',
  'pass_attempt',
  'rush_attempt',
  'sack',
  'pass_oe',
  'score_differential',
  'qtr',
  'fixed_drive',
  'game_seconds_remaining',
  'epa',
];

const RED_ZONE = 20;
const GOAL_LINE = 5;

const readPlayByPlay = (path) => {
  /** gsis -> red-zone and goal-line touches */
  const players = new Map();
  /** team -> play-calling and tempo */
  const teams = new Map();

  const playerEntry = (id) => {
    let entry = players.get(id);
    if (!entry) {
      entry = { rzCarries: 0, rzTargets: 0, goalLineCarries: 0, goalLineTargets: 0 };
      players.set(id, entry);
    }
    return entry;
  };

  const teamEntry = (abbr) => {
    let entry = teams.get(abbr);
    if (!entry) {
      entry = {
        plays: 0,
        passPlays: 0,
        dropbacks: 0,
        sacks: 0,
        neutralPlays: 0,
        neutralPass: 0,
        passOeSum: 0,
        passOeCount: 0,
        paceSum: 0,
        paceCount: 0,
        epaSum: 0,
        rzCarries: 0,
        rzTargets: 0,
        games: new Set(),
        drives: new Set(),
        rzDrives: new Set(),
      };
      teams.set(abbr, entry);
    }
    return entry;
  };

  // Pace is the gap between one snap and the next inside a single drive. Across
  // a drive boundary the clock stops for the change of possession, so those gaps
  // measure the broadcast and not the offense.
  let lastDrive = '';
  let lastClock = 0;

  for (const row of readCsv(path, PBP_COLUMNS)) {
    const type = row.play_type;
    if (type !== 'run' && type !== 'pass') continue;
    const team = canonicalTeam(row.posteam);
    if (!team) continue;

    const entry = teamEntry(team);
    const driveKey = `${row.game_id}:${row.fixed_drive}`;
    const yardline = num(row.yardline_100);
    const isPass = type === 'pass';
    const sacked = num(row.sack) === 1;

    entry.plays += 1;
    entry.games.add(row.game_id);
    entry.drives.add(driveKey);
    entry.epaSum += num(row.epa);
    if (isPass) {
      entry.passPlays += 1;
      entry.dropbacks += 1;
      if (sacked) entry.sacks += 1;
    }

    // Trailing by three scores, a team throws because it has to. Play-calling
    // identity only shows up while the game is still in the balance.
    if (Math.abs(num(row.score_differential)) <= 7 && num(row.qtr) <= 3) {
      entry.neutralPlays += 1;
      if (isPass) entry.neutralPass += 1;
    }

    const passOe = Number.parseFloat(row.pass_oe);
    if (Number.isFinite(passOe)) {
      entry.passOeSum += passOe;
      entry.passOeCount += 1;
    }

    const clock = num(row.game_seconds_remaining);
    if (driveKey === lastDrive) {
      const delta = lastClock - clock;
      if (delta > 0 && delta <= 60) {
        entry.paceSum += delta;
        entry.paceCount += 1;
      }
    }
    lastDrive = driveKey;
    lastClock = clock;

    if (yardline > 0 && yardline <= RED_ZONE) {
      entry.rzDrives.add(driveKey);
      const rusher = row.rusher_player_id;
      const receiver = row.receiver_player_id;
      if (rusher) {
        entry.rzCarries += 1;
        const p = playerEntry(rusher);
        p.rzCarries += 1;
        if (yardline <= GOAL_LINE) p.goalLineCarries += 1;
      }
      if (receiver) {
        entry.rzTargets += 1;
        const p = playerEntry(receiver);
        p.rzTargets += 1;
        if (yardline <= GOAL_LINE) p.goalLineTargets += 1;
      }
    }
  }

  const environment = new Map();
  for (const [team, e] of teams) {
    const games = e.games.size || 17;
    environment.set(team, {
      playsPerGame: Math.round((e.plays / games) * 10) / 10,
      // Seconds between snaps inside a drive: low is fast.
      secondsPerPlay: e.paceCount ? Math.round((e.paceSum / e.paceCount) * 10) / 10 : null,
      passRate: e.plays ? Math.round((e.passPlays / e.plays) * 1000) / 10 : null,
      neutralPassRate: e.neutralPlays
        ? Math.round((e.neutralPass / e.neutralPlays) * 1000) / 10
        : null,
      // Pass rate over expected: how much more a team throws than its game
      // situations call for. Positive is a pass-first identity, not a scoreboard.
      passRateOverExpected: e.passOeCount
        ? Math.round((e.passOeSum / e.passOeCount) * 10) / 10
        : null,
      // Sacks per dropback is the cleanest free proxy for pass protection.
      sackRateAllowed: e.dropbacks ? Math.round((e.sacks / e.dropbacks) * 1000) / 10 : null,
      epaPerPlay: e.plays ? Math.round((e.epaSum / e.plays) * 1000) / 1000 : null,
      redZoneTripsPerGame: Math.round((e.rzDrives.size / games) * 10) / 10,
      redZoneCarries: e.rzCarries,
      redZoneTargets: e.rzTargets,
      games,
    });
  }

  return { players, environment };
};

// ---------------------------------------------------------------------------

const main = async () => {
  console.log('Draft Vault — building the player pool from real data\n');

  const paths = {};
  for (const name of Object.keys(SOURCES)) paths[name] = await cached(name);

  // --- identity ------------------------------------------------------------
  const byGsis = new Map();
  const gsisByEspn = new Map();
  const gsisByPfr = new Map();
  for (const row of readCsv(paths['players.csv'])) {
    if (!row.gsis_id) continue;
    byGsis.set(row.gsis_id, row);
    if (row.espn_id) gsisByEspn.set(String(row.espn_id).split('.')[0], row.gsis_id);
    if (row.pfr_id) gsisByPfr.set(row.pfr_id, row.gsis_id);
  }

  // --- who is actually on a roster for the coming season --------------------
  const rostered = new Map();
  for (const row of readCsv(paths['roster_2026.csv'])) {
    if (!row.gsis_id) continue;
    rostered.set(row.gsis_id, {
      team: row.team,
      position: row.position,
      depthPosition: row.depth_chart_position || row.position,
      jersey: row.jersey_number || null,
      status: row.status,
      yearsExp: num(row.years_exp),
    });
  }

  // --- weekly production, both schemas -------------------------------------
  const seasonsByPlayer = new Map(); // gsis -> Map(season -> totals)
  /** `TEAM:season` -> team-wide carries, so a back's share has a denominator. */
  const teamTouches = new Map();
  const addWeek = (week) => {
    if (week.seasonType && week.seasonType !== 'REG') return;
    if (!week.playerId) return;
    let seasons = seasonsByPlayer.get(week.playerId);
    if (!seasons) seasonsByPlayer.set(week.playerId, (seasons = new Map()));
    let totals = seasons.get(week.season);
    if (!totals) {
      totals = {
        season: week.season,
        team: week.team,
        games: 0,
        pprPoints: 0,
        targets: 0,
        receptions: 0,
        receivingYards: 0,
        receivingTds: 0,
        carries: 0,
        rushingYards: 0,
        rushingTds: 0,
        passingYards: 0,
        passingTds: 0,
        interceptions: 0,
        airYards: 0,
        yac: 0,
        targetShareSum: 0,
        targetShareWeeks: 0,
        airYardsShareSum: 0,
        woprSum: 0,
        shareWeeks: 0,
        receivingEpa: 0,
        rushingEpa: 0,
        passingEpa: 0,
        firstDowns: 0,
        weekly: [],
      };
      seasons.set(week.season, totals);
    }
    if (week.team) {
      const key = `${canonicalTeam(week.team)}:${week.season}`;
      const touches = teamTouches.get(key) ?? { carries: 0, targets: 0 };
      touches.carries += week.carries;
      touches.targets += week.targets;
      teamTouches.set(key, touches);
    }
    totals.games += 1;
    totals.weekly.push(week.fantasyPointsPpr);
    totals.team = week.team || totals.team;
    totals.pprPoints += week.fantasyPointsPpr;
    totals.targets += week.targets;
    totals.receptions += week.receptions;
    totals.receivingYards += week.receivingYards;
    totals.receivingTds += week.receivingTds;
    totals.carries += week.carries;
    totals.rushingYards += week.rushingYards;
    totals.rushingTds += week.rushingTds;
    totals.passingYards += week.passingYards;
    totals.passingTds += week.passingTds;
    totals.interceptions += week.interceptions;
    totals.airYards += week.receivingAirYards;
    totals.yac += week.yardsAfterCatch;
    totals.receivingEpa += week.receivingEpa;
    totals.rushingEpa += week.rushingEpa;
    totals.passingEpa += week.passingEpa;
    totals.firstDowns += week.receivingFirstDowns + week.rushingFirstDowns;
    if (week.targetShare > 0) {
      totals.targetShareSum += week.targetShare;
      totals.targetShareWeeks += 1;
      totals.airYardsShareSum += week.airYardsShare;
      totals.woprSum += week.wopr;
      totals.shareWeeks += 1;
    }
  };

  for (const row of readCsv(paths['player_stats.csv'])) addWeek(normalizeWeek(row));
  for (const row of readCsv(paths['stats_2025.csv'])) addWeek(normalizeWeek(row));

  // --- snap share (keyed by pro-football-reference id) ----------------------
  const snapsByGsis = new Map();
  for (const row of readCsv(paths['snaps_2025.csv'])) {
    const gsis = gsisByPfr.get(row.pfr_player_id);
    if (!gsis) continue;
    const entry = snapsByGsis.get(gsis) ?? { pctSum: 0, weeks: 0 };
    const pct = num(row.offense_pct);
    if (pct > 0) {
      entry.pctSum += pct;
      entry.weeks += 1;
    }
    snapsByGsis.set(gsis, entry);
  }

  // --- games missed to injury, three seasons deep ---------------------------
  // One season says whether a player was hurt; three say whether he is the kind
  // of player who gets hurt. The report is weekly, so an 'Out' row is a game.
  const missedBySeason = new Map(); // gsis -> Map(season -> games missed)
  const injuryBodyParts = new Map(); // gsis -> Map(part -> weeks reported)
  for (const season of INJURY_SEASONS) {
    for (const row of readCsv(paths[`injuries_${season}.csv`])) {
      const gsis = row.gsis_id;
      if (!gsis) continue;
      const part = (row.report_primary_injury || row.practice_primary_injury || '').trim();
      // The report is also where teams log veterans' rest days, which is not an
      // injury and must not read as one on a durability tab.
      if (part && !/not injury related|resting|coach|personal|illness/i.test(part)) {
        if (!injuryBodyParts.has(gsis)) injuryBodyParts.set(gsis, new Map());
        const parts = injuryBodyParts.get(gsis);
        parts.set(part, (parts.get(part) ?? 0) + 1);
      }
      if (row.report_status !== 'Out' && row.game_status !== 'Out') continue;
      if (!missedBySeason.has(gsis)) missedBySeason.set(gsis, new Map());
      const bySeason = missedBySeason.get(gsis);
      bySeason.set(season, (bySeason.get(season) ?? 0) + 1);
    }
  }
  const missedByGsis = new Map();
  for (const [gsis, bySeason] of missedBySeason) missedByGsis.set(gsis, bySeason.get(2025) ?? 0);

  // --- play-by-play: red-zone usage and team play-calling --------------------
  process.stdout.write('  reading play-by-play… ');
  const { players: redZoneByGsis, environment: teamEnvironment } = readPlayByPlay(
    paths['pbp_2025.csv.gz']
  );
  console.log(`${teamEnvironment.size} offenses, ${redZoneByGsis.size} players with red-zone work`);

  // --- draft capital --------------------------------------------------------
  const draftPicks = [...readCsv(paths['draft_picks.csv'])];
  const draftByGsis = new Map();
  for (const pick of draftPicks) if (pick.gsis_id) draftByGsis.set(pick.gsis_id, pick);
  const rookieCurve = rookieBaselines(draftPicks, seasonsByPlayer);

  // --- the fantasy-side id crosswalk ----------------------------------------
  // Sleeper carries a gsis_id for only 3,893 of its 12,224 players, and almost
  // none of the ones who matter — Ja'Marr Chase and Jahmyr Gibbs both have a
  // null. Joining on it directly resolved 61 of 567. This map is the fix, and
  // it also unlocks FantasyPros, which has no nflverse id at all.
  const fantasyIds = new Map(); // gsis -> { sleeper, fantasypros }
  for (const row of readCsv(paths['db_playerids.csv'])) {
    if (!row.gsis_id) continue;
    fantasyIds.set(row.gsis_id, {
      sleeper: row.sleeper_id || null,
      fantasypros: row.fantasypros_id || null,
    });
  }

  // --- Sleeper: what the casual room is looking up --------------------------
  const sleeper = JSON.parse(readFileSync(paths['sleeper.json'], 'utf8'));
  const sleeperById = new Map(Object.entries(sleeper));
  const sleeperByGsis = new Map();
  for (const entry of Object.values(sleeper)) {
    if (entry?.gsis_id) sleeperByGsis.set(entry.gsis_id, entry);
  }
  for (const [gsis, ids] of fantasyIds) {
    if (sleeperByGsis.has(gsis) || !ids.sleeper) continue;
    const entry = sleeperById.get(ids.sleeper);
    if (entry) sleeperByGsis.set(gsis, entry);
  }

  console.log(
    `\n  ${byGsis.size} players indexed · ${rostered.size} on ${CURRENT_SEASON} rosters · ` +
      `${seasonsByPlayer.size} with production history`
  );

  // --- positional baselines, needed before anyone can be shrunk toward them --
  const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
  const ppgSamples = new Map();
  for (const [gsis, roster] of rostered) {
    if (!FANTASY_POSITIONS.has(roster.position)) continue;
    const seasons = seasonsByPlayer.get(gsis);
    const recent = seasons?.get(2025);
    if (!recent || recent.games < 6) continue;
    if (!ppgSamples.has(roster.position)) ppgSamples.set(roster.position, []);
    ppgSamples.get(roster.position).push(recent.pprPoints / recent.games);
  }
  const positionBaseline = new Map();
  for (const [position, samples] of ppgSamples) {
    samples.sort((a, b) => b - a);
    // The baseline is what a startable-but-unremarkable player at the position
    // produces, not the mean of everyone who took a snap.
    const index = Math.min(samples.length - 1, Math.floor(samples.length * 0.5));
    positionBaseline.set(position, samples[index]);
  }

  const age = (birthDate) => {
    if (!birthDate) return null;
    const born = new Date(birthDate);
    if (Number.isNaN(born.getTime())) return null;
    return CURRENT_SEASON - born.getFullYear();
  };

  const project = (gsis, roster) => {
    const seasons = seasonsByPlayer.get(gsis);
    const identity = byGsis.get(gsis);
    const playerAge = age(identity?.birth_date);
    const baseline = positionBaseline.get(roster.position) ?? 6;

    let weighted = 0;
    let weight = 0;
    let games = 0;
    for (const season of SEASONS) {
      const totals = seasons?.get(season);
      if (!totals || !totals.games) continue;
      const w = SEASON_WEIGHTS[season] * totals.games;
      weighted += (totals.pprPoints / totals.games) * w;
      weight += w;
      games += totals.games;
    }

    let ppg;
    let basis;
    if (weight > 0) {
      const observed = weighted / weight;
      const prior = SHRINKAGE_GAMES[roster.position] ?? 8;
      ppg = (games * observed + prior * baseline) / (games + prior);
      basis = 'production';
    } else {
      // No tape: fall back to what players drafted in this slot have produced.
      const pick = draftByGsis.get(gsis);
      const key = `${roster.position}:${Math.min(7, num(pick?.round) || 7)}`;
      ppg = rookieCurve.get(key)?.median ?? baseline * 0.45;
      basis = pick ? `draft round ${pick.round}` : 'undrafted baseline';
    }

    const multiplier = ageMultiplier(roster.position, playerAge);
    const missed = missedByGsis.get(gsis) ?? 0;
    const expectedGames = Math.max(10, 17 - Math.min(6, missed));
    const points = ppg * multiplier * expectedGames;

    return { ppg, points, expectedGames, ageMultiplier: multiplier, basis, playerAge, games };
  };

  // --- build the candidate list --------------------------------------------
  const candidates = [];
  for (const [gsis, roster] of rostered) {
    if (!FANTASY_POSITIONS.has(roster.position) && roster.position !== 'K') continue;
    if (roster.status && !['ACT', 'RES', 'DEV'].includes(roster.status)) continue;

    const identity = byGsis.get(gsis);
    if (!identity) continue;

    const projection = project(gsis, roster);
    const seasons = seasonsByPlayer.get(gsis);
    const snaps = snapsByGsis.get(gsis);
    const history = SEASONS.map((season) => {
      const totals = seasons?.get(season);
      if (!totals || !totals.games) return null;
      return {
        season,
        team: totals.team,
        games: totals.games,
        pprPoints: Math.round(totals.pprPoints * 10) / 10,
        pointsPerGame: Math.round((totals.pprPoints / totals.games) * 10) / 10,
        targets: totals.targets,
        receptions: totals.receptions,
        receivingYards: totals.receivingYards,
        receivingTds: totals.receivingTds,
        carries: totals.carries,
        rushingYards: totals.rushingYards,
        rushingTds: totals.rushingTds,
        passingYards: totals.passingYards,
        passingTds: totals.passingTds,
        interceptions: totals.interceptions,
        targetShare: totals.targetShareWeeks
          ? Math.round((totals.targetShareSum / totals.targetShareWeeks) * 1000) / 10
          : null,
        // Week-by-week scoring, so the profile can draw the real shape of a
        // season instead of three season totals pretending to be a trend.
        weekly: totals.weekly.map((points) => Math.round(points * 10) / 10),
        airYards: Math.round(totals.airYards),
        yardsAfterCatch: Math.round(totals.yac),
      };
    }).filter(Boolean);

    // The whole arc, not just the tape that feeds the projection. Three seasons
    // answer "is he good now"; the career answers "what shape is he on" — a
    // twenty-eight-year-old's third straight decline reads differently from a
    // second-year jump, and the projection alone cannot show either.
    const birthYear = identity.birth_date ? new Date(identity.birth_date).getFullYear() : null;
    const career = [...(seasons?.values() ?? [])]
      .filter((totals) => totals.games > 0)
      .sort((a, b) => a.season - b.season)
      .map((totals) => ({
        season: totals.season,
        team: totals.team,
        games: totals.games,
        pprPoints: Math.round(totals.pprPoints * 10) / 10,
        pointsPerGame: Math.round((totals.pprPoints / totals.games) * 10) / 10,
        age: birthYear ? totals.season - birthYear : null,
      }));

    // A real trend, from real points per game, replacing the invented arrow.
    let trend = 'STABLE';
    if (history.length >= 2) {
      const [previous, latest] = [history[history.length - 2], history[history.length - 1]];
      const delta = latest.pointsPerGame - previous.pointsPerGame;
      if (delta > 1.5) trend = 'RISING';
      else if (delta < -1.5) trend = 'DECLINING';
    } else if (history.length === 0) {
      trend = 'UNPROVEN';
    }

    candidates.push({
      gsis,
      espnId: identity.espn_id ? String(identity.espn_id).split('.')[0] : null,
      name: identity.display_name,
      position: roster.position,
      team: canonicalTeam(roster.team),
      jersey: roster.jersey,
      age: projection.playerAge,
      college: identity.college_name || null,
      experience: roster.yearsExp,
      draft: draftByGsis.get(gsis)
        ? {
            year: num(draftByGsis.get(gsis).season),
            round: num(draftByGsis.get(gsis).round),
            pick: num(draftByGsis.get(gsis).pick),
            team: draftByGsis.get(gsis).team,
          }
        : null,
      snapShare: snaps?.weeks ? Math.round((snaps.pctSum / snaps.weeks) * 1000) / 10 : null,
      gamesMissed2025: missedByGsis.get(gsis) ?? 0,
      trend,
      projection: {
        points: Math.round(projection.points * 10) / 10,
        pointsPerGame: Math.round(projection.ppg * 10) / 10,
        expectedGames: projection.expectedGames,
        ageMultiplier: Math.round(projection.ageMultiplier * 100) / 100,
        basis: projection.basis,
        gamesObserved: projection.games,
      },
      history,
      career,
      breakoutSeason: career.find((row) => row.games >= 8 && row.pointsPerGame >= 12)?.season ?? null,
      sleeperId: sleeperByGsis.get(gsis)?.player_id ?? null,
    });
  }

  candidates.sort((a, b) => b.projection.points - a.projection.points);

  // How many of each position to keep.
  //
  // Ranking purely by projected points would fill the pool with quarterbacks,
  // who out-score everyone in raw PPR terms while only one of them starts, so
  // each position is capped. The caps used to be typed numbers tuned for a
  // twelve-team league, and quarterback sat at 40 — under the 53 that the
  // largest league the client permits would roster, which silently dropped
  // replacement level to the worst quarterback in the pool.
  //
  // They are now derived from the biggest league the valuation supports, with
  // headroom for the bench nobody starts. Deepening is safe by construction:
  // candidates are sorted by projected points, so everything an increase adds
  // is worse than everything already in, which cannot move replacement level
  // or a top-192 auction value for any smaller league.
  const MAX_ROSTERED = rosteredForTeams(LEAGUE_LIMITS.teams.max);
  const BENCH_HEADROOM = { QB: 1.2, RB: 1.4, WR: 1.6, TE: 1.35, K: 1 };
  const CAPS = Object.fromEntries(
    Object.entries(BENCH_HEADROOM).map(([position, headroom]) => [
      position,
      Math.round(MAX_ROSTERED[position] * headroom),
    ])
  );
  const chosen = [];
  const counts = new Map();
  for (const player of candidates) {
    const cap = CAPS[player.position] ?? 0;
    const count = counts.get(player.position) ?? 0;
    if (count >= cap) continue;
    chosen.push(player);
    counts.set(player.position, count + 1);
  }

  // --- bye weeks, from the season's published schedule ----------------------
  const playedWeeks = new Map();
  let lastWeek = 0;
  for (const game of readCsv(paths['games.csv'])) {
    if (num(game.season) !== CURRENT_SEASON) continue;
    if ((game.game_type ?? game.season_type) !== 'REG') continue;
    const week = num(game.week);
    lastWeek = Math.max(lastWeek, week);
    for (const side of [game.home_team, game.away_team]) {
      const team = canonicalTeam(side);
      if (!playedWeeks.has(team)) playedWeeks.set(team, new Set());
      playedWeeks.get(team).add(week);
    }
  }
  const byeWeek = new Map();
  for (const [team, weeks] of playedWeeks) {
    for (let week = 1; week <= lastWeek; week++) {
      if (!weeks.has(week)) {
        byeWeek.set(team, week);
        break;
      }
    }
  }

  // --- distributional and risk fields, all derived from real observations ---
  for (const player of chosen) {
    const seasons = seasonsByPlayer.get(player.gsis);
    // Prefer the most recent season with a real sample for shape statistics.
    let sample = null;
    for (const season of [...SEASONS].reverse()) {
      const totals = seasons?.get(season);
      if (totals && totals.games >= 8) {
        sample = totals;
        break;
      }
    }

    if (sample) {
      const mean = sample.pprPoints / sample.games;
      const variance =
        sample.weekly.reduce((total, points) => total + (points - mean) ** 2, 0) / sample.games;
      const weeklyDeviation = Math.sqrt(variance);
      const cv = mean > 0 ? weeklyDeviation / mean : 1.2;
      // A tighter week-to-week spread is a more dependable starter.
      player.consistency = Math.max(1, Math.min(10, Math.round(10 - (cv - 0.3) * 10)));

      // A season is a sum of games, so its spread grows with the square root of
      // the number of them — not linearly. Multiplying a good week by seventeen
      // would describe a season where every week is a good week, which is not a
      // ceiling anyone reaches.
      const games = player.projection.expectedGames;
      const seasonDeviation = weeklyDeviation * Math.sqrt(games);
      player.floor = Math.max(0, Math.round(player.projection.points - seasonDeviation));
      player.ceiling = Math.round(player.projection.points + seasonDeviation);
    } else {
      player.consistency = null;
      player.floor = Math.round(player.projection.points * 0.65);
      player.ceiling = Math.round(player.projection.points * 1.45);
    }

    player.byeWeek = byeWeek.get(player.team) ?? null;
    player.targetShare = sample?.targetShareWeeks
      ? Math.round((sample.targetShareSum / sample.targetShareWeeks) * 1000) / 10
      : null;
    player.lastSeasonGames = sample?.games ?? 0;

    const missed = player.gamesMissed2025;
    player.injuryRisk = missed >= 5 ? 'HIGH' : missed >= 2 ? 'MEDIUM' : 'LOW';

    const multiplier = player.projection.ageMultiplier;
    player.ageRisk = multiplier >= 0.98 ? 'LOW' : multiplier >= 0.88 ? 'MEDIUM' : 'HIGH';

    const share = player.snapShare;
    player.role =
      share == null
        ? player.draft && player.draft.round <= 2
          ? 'MINOR_COMPETITION'
          : 'COMMITTEE'
        : share >= 80
          ? 'LOCKED_STARTER'
          : share >= 60
            ? 'MINOR_COMPETITION'
            : share >= 40
              ? 'TIMESHARE'
              : 'COMMITTEE';

    // --- how the touches were earned ---------------------------------------
    // Volume is the projection; this is the shape of it. A back with 200 carries
    // and no goal-line work is a different asset from one with 160 and all of it,
    // and the point totals do not distinguish them until December.
    const redZone = redZoneByGsis.get(player.gsis);
    const environment = teamEnvironment.get(player.team);
    if (sample) {
      const denominator = teamTouches.get(`${sample.team ? canonicalTeam(sample.team) : player.team}:${sample.season}`);
      const rate = (value, per) => (per ? Math.round((value / per) * 1000) / 10 : null);
      const perGame = (value) => Math.round((value / sample.games) * 10) / 10;
      const rzTouches = (redZone?.rzCarries ?? 0) + (redZone?.rzTargets ?? 0);
      const teamRzTouches = (environment?.redZoneCarries ?? 0) + (environment?.redZoneTargets ?? 0);

      player.usage = {
        season: sample.season,
        games: sample.games,
        targetShare: sample.shareWeeks
          ? Math.round((sample.targetShareSum / sample.shareWeeks) * 1000) / 10
          : null,
        airYardsShare: sample.shareWeeks
          ? Math.round((sample.airYardsShareSum / sample.shareWeeks) * 1000) / 10
          : null,
        // Weighted opportunity: targets and air yards in the proportion that
        // actually predicts receiving points.
        wopr: sample.shareWeeks
          ? Math.round((sample.woprSum / sample.shareWeeks) * 100) / 100
          : null,
        // Average depth of target — a slot receiver and a field-stretcher can
        // share a target count and share nothing else.
        adot: sample.targets ? Math.round((sample.airYards / sample.targets) * 10) / 10 : null,
        yacPerReception: sample.receptions
          ? Math.round((sample.yac / sample.receptions) * 10) / 10
          : null,
        carryShare: rate(sample.carries, denominator?.carries),
        touchesPerGame: perGame(sample.carries + sample.receptions),
        targetsPerGame: perGame(sample.targets),
        redZoneTouches: rzTouches,
        redZoneShare: teamRzTouches ? Math.round((rzTouches / teamRzTouches) * 1000) / 10 : null,
        goalLineTouches: (redZone?.goalLineCarries ?? 0) + (redZone?.goalLineTargets ?? 0),
        firstDownsPerGame: perGame(sample.firstDowns),
        epaPerTouch:
          sample.carries + sample.targets > 0
            ? Math.round(
                ((sample.rushingEpa + sample.receivingEpa) / (sample.carries + sample.targets)) *
                  1000
              ) / 1000
            : null,
        passingEpa: sample.passingEpa ? Math.round(sample.passingEpa * 10) / 10 : null,
      };
    } else {
      player.usage = null;
    }

    // --- the offense he plays in -------------------------------------------
    // Opportunity is granted by a team before it is earned by a player: the same
    // target share is worth more on an offense that runs 68 plays a game.
    player.context = environment
      ? {
          playsPerGame: environment.playsPerGame,
          secondsPerPlay: environment.secondsPerPlay,
          neutralPassRate: environment.neutralPassRate,
          passRateOverExpected: environment.passRateOverExpected,
          sackRateAllowed: environment.sackRateAllowed,
          epaPerPlay: environment.epaPerPlay,
          redZoneTripsPerGame: environment.redZoneTripsPerGame,
        }
      : null;

    // --- durability, three seasons of it ------------------------------------
    const missedSeasons = missedBySeason.get(player.gsis);
    const missedByYear = INJURY_SEASONS.map((season) => ({
      season,
      missed: missedSeasons?.get(season) ?? 0,
    }));
    const totalMissed = missedByYear.reduce((total, row) => total + row.missed, 0);
    const parts = injuryBodyParts.get(player.gsis);
    player.durability = {
      seasons: missedByYear,
      totalMissed,
      // Weeks spent on the injury report, which is not the same as games missed:
      // a player can be listed all season and start every game. Shown as what it
      // is — what he has been treated for — never as a count of absences.
      reported: parts
        ? [...parts.entries()]
            .filter(([, weeks]) => weeks >= 4)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([part, weeks]) => ({ part, weeks }))
        : [],
    };
  }

  // --- team defenses -------------------------------------------------------
  const pointsAllowedScore = (allowed) => {
    if (allowed === 0) return 10;
    if (allowed <= 6) return 7;
    if (allowed <= 13) return 4;
    if (allowed <= 20) return 1;
    if (allowed <= 27) return 0;
    if (allowed <= 34) return -1;
    return -4;
  };

  const allowedByTeam = new Map();
  for (const game of readCsv(paths['games.csv'])) {
    if (num(game.season) !== 2025) continue;
    if ((game.game_type ?? game.season_type) !== 'REG') continue;
    if (game.home_score === '' || game.away_score === '') continue;
    const home = canonicalTeam(game.home_team);
    const away = canonicalTeam(game.away_team);
    if (!allowedByTeam.has(home)) allowedByTeam.set(home, []);
    if (!allowedByTeam.has(away)) allowedByTeam.set(away, []);
    allowedByTeam.get(home).push(num(game.away_score));
    allowedByTeam.get(away).push(num(game.home_score));
  }

  const defenses = [];
  for (const row of readCsv(paths['team_2025.csv'])) {
    const team = canonicalTeam(row.team);
    const allowed = allowedByTeam.get(team) ?? [];
    // Standard DST scoring: turnovers and pressure, plus the points-allowed tier
    // applied game by game the way a real league scores it.
    const takeaways = num(row.def_interceptions) * 2 + num(row.def_fumbles) * 2;
    const pressure = num(row.def_sacks) * 1;
    const scores = num(row.def_tds) * 6 + num(row.def_safeties) * 2;
    const blocks = (num(row.def_fg_blocks) + num(row.def_punt_blocks) + num(row.def_pat_blocks)) * 2;
    const tiers = allowed.reduce((total, pa) => total + pointsAllowedScore(pa), 0);
    const points = takeaways + pressure + scores + blocks + tiers;
    const games = allowed.length || num(row.games) || 17;

    defenses.push({
      gsis: `DST-${team}`,
      espnId: null,
      name: `${team} Defense`,
      position: 'DST',
      team,
      jersey: null,
      age: null,
      college: null,
      experience: null,
      draft: null,
      snapShare: null,
      gamesMissed2025: 0,
      trend: 'STABLE',
      projection: {
        points: Math.round(points * 10) / 10,
        pointsPerGame: Math.round((points / games) * 10) / 10,
        expectedGames: 17,
        ageMultiplier: 1,
        basis: '2025 defensive production',
        gamesObserved: games,
      },
      defense: {
        sacks: num(row.def_sacks),
        interceptions: num(row.def_interceptions),
        fumbleRecoveries: num(row.def_fumbles),
        touchdowns: num(row.def_tds),
        safeties: num(row.def_safeties),
        pointsAllowedPerGame: allowed.length
          ? Math.round((allowed.reduce((a, b) => a + b, 0) / allowed.length) * 10) / 10
          : null,
      },
      history: [],
      career: [],
      breakoutSeason: null,
      sleeperId: null,
    });
  }
  // Team defense is even noisier than kicking year to year, so each defense is
  // pulled most of the way to the league average before it is priced.
  const defenseMean =
    defenses.reduce((total, d) => total + d.projection.points, 0) / (defenses.length || 1);
  for (const defense of defenses) {
    const regressed = defense.projection.points * 0.35 + defenseMean * 0.65;
    defense.projection.points = Math.round(regressed * 10) / 10;
    defense.projection.pointsPerGame = Math.round((regressed / 17) * 10) / 10;
  }
  defenses.sort((a, b) => b.projection.points - a.projection.points);
  chosen.push(...defenses);
  counts.set('DST', defenses.length);

  // --- the season each team actually faces ---------------------------------
  // Difficulty is the opponent's 2025 points allowed per game: the only
  // forward-looking read available before a snap has been played in 2026, and
  // labelled as last season's defense wherever it is shown.
  const allowedPerGame = new Map();
  for (const [team, scores] of allowedByTeam) {
    if (scores.length) allowedPerGame.set(team, scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const allowedValues = [...allowedPerGame.values()].sort((a, b) => a - b);
  const difficultyOf = (opponent) => {
    const pa = allowedPerGame.get(opponent);
    if (pa == null) return null;
    // Rank among the 32 defenses: 0 is the stingiest, 1 the most generous.
    const rank = allowedValues.filter((value) => value < pa).length / (allowedValues.length - 1);
    return Math.round(rank * 100) / 100;
  };

  const schedule = {};
  for (const game of readCsv(paths['games.csv'])) {
    if (num(game.season) !== CURRENT_SEASON) continue;
    if ((game.game_type ?? game.season_type) !== 'REG') continue;
    const week = num(game.week);
    const home = canonicalTeam(game.home_team);
    const away = canonicalTeam(game.away_team);
    (schedule[home] ??= []).push({ week, opponent: away, home: true, difficulty: difficultyOf(away) });
    (schedule[away] ??= []).push({ week, opponent: home, home: false, difficulty: difficultyOf(home) });
  }
  for (const weeks of Object.values(schedule)) weeks.sort((a, b) => a.week - b.week);

  // --- auction values ------------------------------------------------------
  // Value over replacement, converted to dollars, by the shared module the
  // draft room runs too. The numbers written below are what a default league
  // sees; the client re-prices from `projection.points` for any other shape.
  const { replacement: replacementLevel, priced } = pricePool(
    chosen.map((player) => ({ position: player.position, points: player.projection.points })),
    LEAGUE
  );
  chosen.forEach((player, index) => {
    player.vorp = priced[index].vorp;
    player.auctionValue = priced[index].auctionValue;
  });
  const replacement = new Map(Object.entries(replacementLevel));

  console.log(`\n  pool: ${chosen.length} skill players`);
  console.log('  by position:', Object.fromEntries([...counts].sort()));

  // --- how good a number is for the position -------------------------------
  // A raw stat means little on its own: 60% snap share is a bench role for a
  // running back and heavy usage for a tight end. Every headline number gets a
  // percentile among the players it should be compared with.
  const PERCENTILE_FIELDS = [
    ['points', (p) => p.projection.points],
    ['pointsPerGame', (p) => p.projection.pointsPerGame],
    ['snapShare', (p) => p.snapShare],
    ['targetShare', (p) => p.usage?.targetShare ?? p.targetShare],
    ['consistency', (p) => p.consistency],
    ['ceiling', (p) => p.ceiling],
    ['floor', (p) => p.floor],
    ['airYardsShare', (p) => p.usage?.airYardsShare],
    ['wopr', (p) => p.usage?.wopr],
    ['adot', (p) => p.usage?.adot],
    ['yacPerReception', (p) => p.usage?.yacPerReception],
    ['carryShare', (p) => p.usage?.carryShare],
    ['touchesPerGame', (p) => p.usage?.touchesPerGame],
    ['targetsPerGame', (p) => p.usage?.targetsPerGame],
    ['redZoneTouches', (p) => p.usage?.redZoneTouches],
    ['redZoneShare', (p) => p.usage?.redZoneShare],
    ['goalLineTouches', (p) => p.usage?.goalLineTouches],
    ['firstDownsPerGame', (p) => p.usage?.firstDownsPerGame],
    ['epaPerTouch', (p) => p.usage?.epaPerTouch],
  ];

  const byPositionForRanking = new Map();
  for (const player of chosen) {
    if (!byPositionForRanking.has(player.position)) byPositionForRanking.set(player.position, []);
    byPositionForRanking.get(player.position).push(player);
  }
  for (const [, group] of byPositionForRanking) {
    for (const [field, read] of PERCENTILE_FIELDS) {
      const values = group.map(read).filter((value) => value != null && Number.isFinite(value));
      if (values.length < 4) continue;
      values.sort((a, b) => a - b);
      // A field every player at the position shares — targets for quarterbacks,
      // carries for tight ends — has no distribution to rank within. Emitting a
      // percentile there would print a confident 0 next to a meaningless number.
      if (values[0] === values[values.length - 1]) continue;
      for (const player of group) {
        const value = read(player);
        if (value == null || !Number.isFinite(value)) continue;
        const below = values.filter((other) => other < value).length;
        (player.percentiles ??= {})[field] = Math.round((below / (values.length - 1)) * 100);
      }
    }
  }

  // Rank and tier come from the model's own dollar values, so they cannot drift
  // away from the prices shown next to them.
  const ranked = [...chosen].sort((a, b) => b.auctionValue - a.auctionValue || b.vorp - a.vorp);
  ranked.forEach((player, index) => {
    player.rank = index + 1;
    const value = player.auctionValue;
    player.tier = value >= 35 ? 1 : value >= 15 ? 2 : value >= 5 ? 3 : 4;
    if (player.byeWeek == null) player.byeWeek = byeWeek.get(player.team) ?? null;
    if (player.consistency == null) player.consistency = 5;
    if (!player.injuryRisk) player.injuryRisk = 'LOW';
    if (!player.ageRisk) player.ageRisk = 'LOW';
    if (!player.role) player.role = 'COMMITTEE';
  });

  // --- depth chart competition ---------------------------------------------
  // A projection already accounts for the touches a player is expected to get.
  // What it cannot show is how contested they are: the same 12 points a game is
  // a very different bet behind a healthy starter than in front of nobody.
  const teammates = new Map();
  for (const player of chosen) {
    const key = `${player.team}:${player.position}`;
    if (!teammates.has(key)) teammates.set(key, []);
    teammates.get(key).push(player);
  }
  for (const group of teammates.values()) {
    group.sort((a, b) => b.projection.points - a.projection.points);
    group.forEach((player, index) => {
      const next = group[index + 1];
      const ahead = group[index - 1];
      player.competition = {
        depth: index + 1,
        roomSize: group.length,
        // The gap to the man behind is how safe the role is; the gap to the man
        // ahead is how far there is to climb if it opens up.
        aheadBy: next
          ? Math.round((player.projection.pointsPerGame - next.projection.pointsPerGame) * 10) / 10
          : null,
        behindBy: ahead
          ? Math.round((ahead.projection.pointsPerGame - player.projection.pointsPerGame) * 10) / 10
          : null,
        nextUp: next?.name ?? null,
        starterAhead: ahead?.name ?? null,
      };
    });
  }

  // --- what the market thinks ----------------------------------------------
  // Two independent reads, because they answer different questions. FantasyPros'
  // expert consensus is where a player is actually being drafted, and it ships
  // its own disagreement — best, worst and the spread between them — which is a
  // measure of consensus no single rank can carry. Sleeper's search rank is
  // popularity: what the casual room is looking up this week.
  const ecrByFpId = new Map();
  const ecrByTeam = new Map();
  for (const row of readCsv(paths['db_fpecr_latest.csv'])) {
    if (row.ecr_type !== 'ro') continue; // redraft, overall
    const record = {
      ecr: num(row.ecr),
      spread: Number.parseFloat(row.sd),
      best: num(row.best),
      worst: num(row.worst),
      ownership: Number.parseFloat(row.player_owned_avg),
      scrapedAt: row.scrape_date,
    };
    if (row.pos === 'DST') ecrByTeam.set(canonicalTeam(row.tm), record);
    else if (row.id) ecrByFpId.set(String(row.id), record);
  }

  const marketOf = (player) => {
    if (player.position === 'DST') return ecrByTeam.get(player.team) ?? null;
    const ids = fantasyIds.get(player.gsis);
    return ids?.fantasypros ? (ecrByFpId.get(ids.fantasypros) ?? null) : null;
  };

  const withEcr = chosen.map((player) => ({ player, ecr: marketOf(player) })).filter((row) => row.ecr);
  withEcr.sort((a, b) => a.ecr.ecr - b.ecr.ecr);
  const marketPositionCount = new Map();
  withEcr.forEach((row, index) => {
    const positionRank = (marketPositionCount.get(row.player.position) ?? 0) + 1;
    marketPositionCount.set(row.player.position, positionRank);
    const sleeperEntry = sleeperByGsis.get(row.player.gsis);
    row.player.market = {
      // Rank among this pool, not FantasyPros' own numbering, so it is directly
      // comparable to the model's rank sitting next to it.
      consensusRank: index + 1,
      positionRank,
      rawEcr: row.ecr.ecr,
      // How much the experts disagree. A wide band is a player the room has not
      // made its mind up about, which is where an auction is won.
      best: row.ecr.best,
      worst: row.ecr.worst,
      spread: Number.isFinite(row.ecr.spread) ? Math.round(row.ecr.spread * 10) / 10 : null,
      ownership: Number.isFinite(row.ecr.ownership) ? Math.round(row.ecr.ownership * 10) / 10 : null,
      searchRank: Number.isFinite(sleeperEntry?.search_rank) ? sleeperEntry.search_rank : null,
      depthChartOrder: sleeperEntry?.depth_chart_order ?? null,
      source: 'FantasyPros expert consensus',
      asOf: row.ecr.scrapedAt,
    };
  });
  for (const player of chosen) {
    if (!player.market) {
      const sleeperEntry = sleeperByGsis.get(player.gsis);
      player.market = {
        consensusRank: null,
        positionRank: null,
        rawEcr: null,
        best: null,
        worst: null,
        spread: null,
        ownership: null,
        searchRank: Number.isFinite(sleeperEntry?.search_rank) ? sleeperEntry.search_rank : null,
        depthChartOrder: sleeperEntry?.depth_chart_order ?? null,
        source: 'FantasyPros expert consensus',
        asOf: null,
      };
    }
    // Positive means the room is drafting him later than the model ranks him:
    // our edge, and the number the bargain board sorts on.
    player.market.edge =
      player.market.consensusRank != null ? player.market.consensusRank - player.rank : null;
  }
  console.log(
    `  market: ${withEcr.length}/${chosen.length} matched to FantasyPros consensus (${
      withEcr[0]?.ecr.scrapedAt ?? 'n/a'
    })`
  );


  mkdirSync(OUT, { recursive: true });
  const meta = {
    source: 'nflverse + Sleeper + ESPN + FantasyPros',
    // Emitted rather than re-declared in the client: replacement level falls out
    // of LEAGUE.rostered, and CLAUDE.md's warning about those two copies drifting
    // applies just as much to a third one in the UI.
    replacement: Object.fromEntries([...replacement].map(([pos, points]) => [pos, Math.round(points)])),
    league: LEAGUE,
    seasons: SEASONS,
    projectionModel: 'recency-weighted PPR points per game, shrunk toward positional baseline, age-adjusted',
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(OUT, 'pool.json'),
    JSON.stringify(
      { ...meta, players: chosen.map(({ history, career, ...rest }) => rest) },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(OUT, 'schedule.json'),
    JSON.stringify({ ...meta, season: CURRENT_SEASON, teams: schedule }, null, 2) + '\n'
  );
  writeFileSync(
    join(OUT, 'player-history.json'),
    JSON.stringify(
      {
        ...meta,
        history: Object.fromEntries(chosen.map((p) => [p.gsis, p.history])),
        // The full arc lives beside the recent tape, in the same lazy chunk: it
        // is only ever read when a profile is open, and it would double the
        // board's payload for a number no board column shows.
        career: Object.fromEntries(chosen.filter((p) => p.career?.length).map((p) => [p.gsis, p.career])),
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(OUT, 'team-context.json'),
    JSON.stringify({ ...meta, season: 2025, teams: Object.fromEntries(teamEnvironment) }, null, 2) +
      '\n'
  );

  const priciest = ranked;
  console.log('\n  most expensive by the model:');
  for (const player of priciest.slice(0, 18)) {
    console.log(
      `    $${String(player.auctionValue).padStart(3)}  ${String(player.projection.points).padStart(6)} pts  ` +
        `vorp ${String(player.vorp).padStart(5)}  ${player.position.padEnd(3)} ` +
        `${player.name.padEnd(22)} ${String(player.team).padEnd(4)} ${player.trend.toLowerCase()}`
    );
  }
  // The players a league of this shape actually rosters, which is what the
  // budget has to cover. `pricePool` decides this internally; here it is only
  // being reported, so it is re-derived from the values it returned.
  const rosterSlots = LEAGUE.teams * LEAGUE.rosterSize;
  const draftable = [...ranked].sort((a, b) => b.vorp - a.vorp).slice(0, rosterSlots);
  const draftableSpend = draftable.reduce((total, p) => total + p.auctionValue, 0);
  console.log(
    `\n  replacement level: ` +
      [...replacement].map(([p, v]) => `${p} ${Math.round(v)}`).join('  ')
  );
  console.log(
    `  the ${draftable.length} draftable players price out at $${draftableSpend}; ` +
      `the league has $${LEAGUE.teams * LEAGUE.budget} to spend`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
