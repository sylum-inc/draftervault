#!/usr/bin/env node
/**
 * Builds the draft pool from real NFL data.
 *
 *   node scripts/build-player-pool.mjs [--cache <dir>] [--offline] [--size 600]
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
 *   Sleeper   players/nfl                 trending adds/drops
 *
 * Writes src/data/nfl/pool.json and src/data/nfl/player-history.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/nfl');
const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const cacheDir = flag('cache', join(ROOT, '.cache/nfl'));
const offline = args.includes('--offline');
const POOL_SIZE = Number(flag('size', 600));

/** The seasons that inform a projection. Older tape exists but stops mattering. */
const SEASONS = [2023, 2024, 2025];
const CURRENT_SEASON = 2026;

const SOURCES = {
  'players.csv': `${NFLVERSE}/players/players.csv`,
  'roster_2026.csv': `${NFLVERSE}/rosters/roster_${CURRENT_SEASON}.csv`,
  'player_stats.csv': `${NFLVERSE}/player_stats/player_stats.csv`,
  'stats_2025.csv': `${NFLVERSE}/stats_player/stats_player_week_2025.csv`,
  'snaps_2025.csv': `${NFLVERSE}/snap_counts/snap_counts_2025.csv`,
  'injuries_2025.csv': `${NFLVERSE}/injuries/injuries_2025.csv`,
  'draft_picks.csv': `${NFLVERSE}/draft_picks/draft_picks.csv`,
  'team_2025.csv': `${NFLVERSE}/stats_team/stats_team_reg_2025.csv`,
  'games.csv': `${NFLVERSE}/schedules/games.csv`,
  'sleeper.json': 'https://api.sleeper.app/v1/players/nfl',
};

/** nflverse spells a few teams differently from ESPN. */
const TEAM_ALIASES = { LA: 'LAR', JAC: 'JAX', AZ: 'ARI', WAS: 'WSH', SD: 'LAC', OAK: 'LV', STL: 'LAR' };
const canonicalTeam = (abbr) => TEAM_ALIASES[abbr] ?? abbr;

/**
 * League shape the valuations assume. Twelve teams, $200 each, sixteen roster
 * spots. Change these and the dollar values change with them.
 */
const LEAGUE = {
  teams: 12,
  budget: 200,
  rosterSize: 16,
  /** How many of each position the league actually rosters, which sets replacement level. */
  rostered: { QB: 20, RB: 48, WR: 60, TE: 18, K: 12, DST: 12 },
};

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
 * college names and injury descriptions both do — so splitting on commas
 * silently corrupts rows.
 */
function* readCsv(path) {
  const text = readFileSync(path, 'utf8');
  const header = [];
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
    } else if (row.length > 1) {
      const record = {};
      for (let i = 0; i < header.length; i++) record[header[i]] = row[i] ?? '';
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
        weekly: [],
      };
      seasons.set(week.season, totals);
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
    if (week.targetShare > 0) {
      totals.targetShareSum += week.targetShare;
      totals.targetShareWeeks += 1;
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

  // --- games missed to injury ----------------------------------------------
  const missedByGsis = new Map();
  for (const row of readCsv(paths['injuries_2025.csv'])) {
    if (row.report_status !== 'Out' && row.game_status !== 'Out') continue;
    const gsis = row.gsis_id;
    if (!gsis) continue;
    missedByGsis.set(gsis, (missedByGsis.get(gsis) ?? 0) + 1);
  }

  // --- draft capital --------------------------------------------------------
  const draftPicks = [...readCsv(paths['draft_picks.csv'])];
  const draftByGsis = new Map();
  for (const pick of draftPicks) if (pick.gsis_id) draftByGsis.set(pick.gsis_id, pick);
  const rookieCurve = rookieBaselines(draftPicks, seasonsByPlayer);

  // --- Sleeper: what the market is doing right now --------------------------
  const sleeper = JSON.parse(readFileSync(paths['sleeper.json'], 'utf8'));
  const sleeperByGsis = new Map();
  for (const entry of Object.values(sleeper)) {
    if (entry?.gsis_id) sleeperByGsis.set(entry.gsis_id, entry);
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
        airYards: Math.round(totals.airYards),
        yardsAfterCatch: Math.round(totals.yac),
      };
    }).filter(Boolean);

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
      sleeperId: sleeperByGsis.get(gsis)?.player_id ?? null,
    });
  }

  candidates.sort((a, b) => b.projection.points - a.projection.points);

  // Keep the pool draftable: enough of each position to fill twelve rosters,
  // then the best of the rest up to the requested size.
  // Hard caps per position. Ranking purely by projected points would fill the
  // pool with quarterbacks, who out-score everyone in raw PPR terms while only
  // twelve of them start. These are roughly three times what the league rosters.
  const CAPS = { QB: 40, RB: 175, WR: 255, TE: 65, K: 32 };
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
  const percentile = (sorted, p) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

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
      const weekly = [...sample.weekly].sort((a, b) => a - b);
      const mean = sample.pprPoints / sample.games;
      const variance =
        sample.weekly.reduce((total, points) => total + (points - mean) ** 2, 0) / sample.games;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1.2;
      // A tighter week-to-week spread is a more dependable starter.
      player.consistency = Math.max(1, Math.min(10, Math.round(10 - (cv - 0.3) * 10)));
      player.floor = Math.round(percentile(weekly, 0.2) * player.projection.expectedGames);
      player.ceiling = Math.round(percentile(weekly, 0.8) * player.projection.expectedGames);
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

  // --- auction values ------------------------------------------------------
  // Value over replacement, converted to dollars. Replacement level is the
  // last player at each position the league actually rosters; the budget left
  // after every roster spot is covered by a dollar is shared out in proportion
  // to each player's VORP.
  const byPosition = new Map();
  for (const player of chosen) {
    if (!byPosition.has(player.position)) byPosition.set(player.position, []);
    byPosition.get(player.position).push(player);
  }
  const replacement = new Map();
  for (const [position, list] of byPosition) {
    list.sort((a, b) => b.projection.points - a.projection.points);
    const index = Math.min(list.length - 1, (LEAGUE.rostered[position] ?? 12) - 1);
    replacement.set(position, list[index]?.projection.points ?? 0);
  }
  for (const player of chosen) {
    player.vorp = Math.round(
      Math.max(0, player.projection.points - (replacement.get(player.position) ?? 0)) * 10
    ) / 10;
  }

  const rosterSlots = LEAGUE.teams * LEAGUE.rosterSize;
  const discretionary = LEAGUE.teams * LEAGUE.budget - rosterSlots;
  const drafted = [...chosen].sort((a, b) => b.vorp - a.vorp).slice(0, rosterSlots);
  const totalVorp = drafted.reduce((total, player) => total + player.vorp, 0) || 1;
  const draftedIds = new Set(drafted.map((player) => player.gsis));
  for (const player of chosen) {
    player.auctionValue = draftedIds.has(player.gsis) && player.vorp > 0
      ? Math.max(1, Math.round(1 + (player.vorp / totalVorp) * discretionary))
      : 1;
  }

  console.log(`\n  pool: ${chosen.length} skill players`);
  console.log('  by position:', Object.fromEntries([...counts].sort()));

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


  mkdirSync(OUT, { recursive: true });
  const meta = {
    source: 'nflverse + Sleeper + ESPN',
    seasons: SEASONS,
    projectionModel: 'recency-weighted PPR points per game, shrunk toward positional baseline, age-adjusted',
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(OUT, 'pool.json'),
    JSON.stringify({ ...meta, players: chosen.map(({ history, ...rest }) => rest) }, null, 2) + '\n'
  );
  writeFileSync(
    join(OUT, 'player-history.json'),
    JSON.stringify(
      { ...meta, history: Object.fromEntries(chosen.map((p) => [p.gsis, p.history])) },
      null,
      2
    ) + '\n'
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
  const draftableSpend = drafted.reduce((total, p) => total + p.auctionValue, 0);
  console.log(
    `\n  replacement level: ` +
      [...replacement].map(([p, v]) => `${p} ${Math.round(v)}`).join('  ')
  );
  console.log(
    `  the ${drafted.length} draftable players price out at $${draftableSpend}; ` +
      `the league has $${LEAGUE.teams * LEAGUE.budget} to spend`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
