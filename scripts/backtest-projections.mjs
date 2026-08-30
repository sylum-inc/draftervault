#!/usr/bin/env node
/**
 * Does the projection model actually beat the cheat sheet?
 *
 *   node scripts/backtest-projections.mjs [--season 2025] [--cache <dir>]
 *                                         [--offline] [--json <file>]
 *
 * Every dollar this app prints is a linear function of projected points, so if
 * the model is worse than the things a manager would otherwise use, the edge
 * runs backwards and the right answer is to draft off consensus. Nobody had
 * ever checked. This checks.
 *
 * WHAT IT DOES. It holds out the most recent complete season, rebuilds the
 * projections for it out of data that existed before a snap of it was played,
 * and scores them against what happened — against the same measures applied to
 * the baselines the model has to beat.
 *
 * The projections come from `src/lib/projection.ts`, the same module
 * `build-player-pool.mjs` imports. That is the entire reason the model was
 * moved out of the builder: a backtest that reimplemented the arithmetic would
 * measure a copy, and a copy scoring well is evidence about the copy. The
 * weekly-stat plumbing and the kicker scoring come from `scripts/nflverse.mjs`
 * for the same reason one layer down — a kicker's *actual* season has to be
 * added up the way his projection was, or the error is partly the difference
 * between two scoring systems and there is no way to tell how much.
 *
 * WHAT COUNTS AS BEFORE. The projection for season S sees weekly production
 * from seasons before S only (enforced by filtering, not by trusting which file
 * a row came from), injuries from S-1, the draft classes the model's own window
 * admits, and birth dates. The universe of players is the week-1 roster of S,
 * which is a pre-season fact. Nothing else about S is visible until the
 * scoring step.
 *
 * THE BASELINES.
 *   last-season    what he scored the year before. The cheapest real model
 *                  there is, and the one the model has to clear to justify
 *                  existing.
 *   position-mean  everyone at a position gets that position's average. A
 *                  floor: it can only order positions, never players.
 *   ADP            what 8,000-odd real drafts were doing in the week before
 *                  the season, from Fantasy Football Calculator's public
 *                  archive. This is the comparison that matters, because it is
 *                  approximately what the other eleven managers are holding.
 *
 * WHAT IT FOUND, so that nobody has to run it to know. On surplus over
 * replacement — the thing an auction actually buys, and what `auctionValue` is a
 * linear function of — the market's board beat this one in all three seasons,
 * and beat it in 11 of the 12 position-seasons. An earlier version of this
 * script led with Spearman on raw points pooled across positions, on which the
 * model wins; that measure is dominated by positional ordering, which every
 * board gets right and no bid pays for, and the `position mean` floor scoring a
 * third on it is the proof. The pooled table is still printed, underneath, so
 * that nobody recomputes it and is encouraged. CLAUDE.md carries the full
 * finding and what to do about it on draft night.
 *
 * TWO LIMITATIONS IT DOES NOT HIDE. The universe filter is week-one roster
 * status, which is set after drafts happen — a player cut in the final week is
 * out of every board's scoring alike, so it cannot favour one, but it is not a
 * draft-day universe. And ADP is a draft position with no points behind it, so
 * it can be ranked and never scored for error: the MAE and bias columns are
 * blank for it and compare only the boards that emit points.
 *
 * ON CONSENSUS, HONESTLY. FantasyPros' expert consensus rank — the market
 * number the pool itself carries — is published by DynastyProcess as a single
 * *latest* snapshot (`db_fpecr_latest.csv`, currently stamped 2026-08-21).
 * There is no dated archive of it in that feed, so there is no way to recover
 * what FantasyPros said before the backtested season, and this script does not
 * pretend otherwise. What it uses instead is real drafts rather than expert
 * opinion: ADP is a market, not a ranking panel. It is the better proxy for
 * "what the room does" and the worse proxy for "what FantasyPros said", and it
 * is labelled as ADP everywhere it appears.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NFLVERSE, canonicalTeam, makeCache, normalizeWeek, num, readCsv } from './nflverse.mjs';
import {
  positionBaselines,
  projectPlayer,
  projectionSeasons,
  rookieBaselines,
  rookieCurveThrough,
  seasonAge,
} from '../src/lib/projection.ts';
import { leagueShape, pointsFor, pricePool, replacementLevels } from '../src/lib/valuation.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
/**
 * Which seasons to hold out.
 *
 * One is a story and three are evidence. A single held-out season can flatter
 * or damn a model by the accident of one year's injuries, so the default runs
 * every season the data supports and prints the three side by side; a finding
 * that does not repeat across all three is not a finding.
 */
const SEASONS = String(flag('season', '2023,2024,2025'))
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));
const cacheDir = flag('cache', join(ROOT, '.cache/nfl'));
const offline = args.includes('--offline');
const jsonOut = flag('json', null);
const cache = makeCache({ dir: cacheDir, offline });

/**
 * The league the answer is for.
 *
 * Half PPR, because that is what the owner plays and because a point a catch
 * is the single biggest lever in fantasy scoring — an error measured at full
 * PPR is an error in somebody else's league. Points are therefore restated
 * through `pointsFor` on both sides, projection and outcome alike, so the two
 * are always being compared under one scoring.
 */
const LEAGUE = leagueShape({ teams: 12, budget: 200, rosterSize: 16, receptionPoints: 0.5 });

const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
/**
 * Kickers and defenses are left out, for two different reasons, and neither is
 * an oversight.
 *
 * A defense never goes through `projectPlayer` at all: it is one season of
 * scoring regressed most of the way to the league mean, a separate model with a
 * separate input file per season.
 *
 * A kicker does go through the model, but cannot be backtested with this data.
 * nflverse's weekly asset for 1999-2024 carries no kickers whatsoever — WR, RB,
 * TE, QB, FB and a scattering of defenders, and not one K — so every kicker in
 * a held-out 2025 arrives with no tape and falls down the no-tape path. What
 * that would measure is the undrafted fallback, not the model, and it would
 * report it as if it were the model's kicker accuracy. Kickers were scored in
 * an earlier pass and came out at rho 0.25 on exactly that fallback, which is a
 * number about nothing.
 *
 * Both price at a dollar or two in any case, so neither can move an auction.
 */
const SCORED_POSITIONS = FANTASY_POSITIONS;

// ---------------------------------------------------------------------------
// statistics
// ---------------------------------------------------------------------------

/** Ranks, ties averaged, so a field of equal projections cannot fake a signal. */
const rank = (values) => {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    const shared = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].index] = shared;
    i = j + 1;
  }
  return ranks;
};

const pearson = (xs, ys) => {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
};

const spearman = (xs, ys) => pearson(rank(xs), rank(ys));

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/**
 * Of the top N a model named, how many finished top N.
 *
 * The measure a drafter actually cares about, and the one a correlation hides:
 * a model can rank the whole field respectably and still miss every player
 * worth owning.
 */
const hitRate = (predicted, actual, n) => {
  const top = (values) =>
    new Set(
      values
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n)
        .map((entry) => entry.index)
    );
  const wanted = top(actual);
  let hits = 0;
  for (const index of top(predicted)) if (wanted.has(index)) hits++;
  return { hits, of: Math.min(n, predicted.length) };
};

// ---------------------------------------------------------------------------
// names, for the one source that carries no id
// ---------------------------------------------------------------------------

/**
 * ADP arrives as names, and the rule the rest of this codebase lives by
 * applies: a name that matches two players matches neither. `rankingsCsv.ts`
 * refuses to guess for an owner's imported sheet; refusing here costs a handful
 * of unmatched rows and buys the certainty that no player's draft position was
 * quietly written onto somebody else.
 */
const normaliseName = (name) =>
  String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z]/g, '');

// ---------------------------------------------------------------------------
// the data, all of it from before the season being projected
// ---------------------------------------------------------------------------

/**
 * One held-out season, start to finish. Everything the season number touches is
 * inside, so running three seasons cannot leave one bleeding into the next.
 */
const backtest = async (SEASON) => {
  const load = async () => {
    const priorSeasons = projectionSeasons(SEASON);
    const paths = {};
    const want = {
      'players.csv': `${NFLVERSE}/players/players.csv`,
      'player_stats.csv': `${NFLVERSE}/player_stats/player_stats.csv`,
      'draft_picks.csv': `${NFLVERSE}/draft_picks/draft_picks.csv`,
      [`stats_${SEASON}.csv`]: `${NFLVERSE}/stats_player/stats_player_week_${SEASON}.csv`,
      [`roster_weekly_${SEASON}.csv`]: `${NFLVERSE}/weekly_rosters/roster_weekly_${SEASON}.csv`,
      [`injuries_${SEASON - 1}.csv`]: `${NFLVERSE}/injuries/injuries_${SEASON - 1}.csv`,
      // Real drafts from the week before the season, which is what the eleven
      // other managers in the room were reading.
      //
      // Half PPR, not full, because everything else here is scored at the
      // owner's league and a full-PPR board over-ranks pass-catchers relative
      // to the room being modelled. It costs sample — the half-PPR feed carries
      // a few hundred to a few thousand drafts a season where the PPR feed
      // carries eight thousand-odd — and that is the right trade, because a
      // noisier measure of the right thing beats a precise measure of a
      // different league. Both were run; the answer below is the same either
      // way, which is itself worth knowing.
      [`adp_half_${SEASON}.json`]: `https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year=${SEASON}&position=all`,
    };
    console.log(`backtesting ${SEASON}, projected from ${priorSeasons.join(', ')}`);
    for (const [name, url] of Object.entries(want)) paths[name] = await cache(name, url);
    return { paths, priorSeasons };
  };

  /**
   * Season totals per player: every season strictly before the backtested one on
   * one side, the backtested season itself on the other.
   *
   * The split is enforced on the season number rather than on which file a row
   * came from. nflverse's legacy asset happens to stop at 2024 today; a future
   * refresh that extended it would silently hand the model the answer, and a leak
   * that only shows up as an unusually good score is the worst kind of leak.
   *
   * Reading the same season out of two overlapping assets is the other hazard —
   * the legacy file and the per-season file both carry 2024, and summing both
   * would double every 2024 total — so the target season is taken from exactly
   * one source, whichever of the two has it.
   */
  const readProduction = (paths) => {
    const before = new Map(); // gsis -> Map(season -> totals)
    const modern = new Map(); // gsis -> totals for SEASON, from the per-season asset
    const legacy = new Map(); // gsis -> totals for SEASON, from the 1999- asset
    const add = (bucket, key, week) => {
      let totals = bucket.get(key);
      if (!totals) {
        totals = { games: 0, pprPoints: 0, receptions: 0, carries: 0, targets: 0 };
        bucket.set(key, totals);
      }
      totals.games += 1;
      totals.pprPoints += week.fantasyPointsPpr;
      totals.receptions += week.receptions;
      totals.carries += week.carries;
      totals.targets += week.targets;
    };
    const consume = (row, during) => {
      const week = normalizeWeek(row);
      if (week.seasonType && week.seasonType !== 'REG') return;
      if (!week.playerId) return;
      if (week.season < SEASON) {
        let seasons = before.get(week.playerId);
        if (!seasons) before.set(week.playerId, (seasons = new Map()));
        add(seasons, week.season, week);
      } else if (week.season === SEASON) {
        add(during, week.playerId, week);
      }
    };
    for (const row of readCsv(paths['player_stats.csv'])) consume(row, legacy);
    for (const row of readCsv(paths[`stats_${SEASON}.csv`])) consume(row, modern);
    return { before, outcome: modern.size ? modern : legacy };
  };

  const run = async () => {
    const { paths } = await load();
    const { before, outcome } = readProduction(paths);

    // --- identity -------------------------------------------------------------
    const birthByGsis = new Map();
    for (const row of readCsv(paths['players.csv'], ['gsis_id', 'birth_date', 'display_name'])) {
      if (row.gsis_id) birthByGsis.set(row.gsis_id, row);
    }

    // --- the universe: who was on a roster in week one ------------------------
    // A pre-season fact, unlike a season-long roster file, which knows who
    // survived the year. The status filter mirrors the builder's.
    const universe = new Map();
    for (const row of readCsv(paths[`roster_weekly_${SEASON}.csv`])) {
      if (num(row.week) !== 1) continue;
      if (row.game_type && row.game_type !== 'REG') continue;
      if (!row.gsis_id || universe.has(row.gsis_id)) continue;
      if (!SCORED_POSITIONS.has(row.position)) continue;
      if (row.status && !['ACT', 'RES', 'DEV'].includes(row.status)) continue;
      universe.set(row.gsis_id, {
        gsis: row.gsis_id,
        name: row.full_name,
        position: row.position,
        team: canonicalTeam(row.team),
      });
    }

    // --- games missed the season before --------------------------------------
    const missed = new Map();
    for (const row of readCsv(paths[`injuries_${SEASON - 1}.csv`])) {
      if (!row.gsis_id) continue;
      if (row.report_status !== 'Out' && row.game_status !== 'Out') continue;
      missed.set(row.gsis_id, (missed.get(row.gsis_id) ?? 0) + 1);
    }

    // --- the model's own inputs, built exactly as the builder builds them -----
    const draftPicks = [...readCsv(paths['draft_picks.csv'])];
    const draftByGsis = new Map();
    for (const pick of draftPicks) if (pick.gsis_id) draftByGsis.set(pick.gsis_id, pick);
    const rookieCurve = rookieBaselines(
      draftPicks.map((pick) => ({
        playerId: pick.gsis_id,
        season: num(pick.season),
        round: num(pick.round),
        position: pick.position,
      })),
      before,
      { through: rookieCurveThrough(SEASON) }
    );

    const baselineSamples = [];
    for (const [gsis, player] of universe) {
      if (!FANTASY_POSITIONS.has(player.position)) continue;
      const recent = before.get(gsis)?.get(SEASON - 1);
      if (!recent) continue;
      baselineSamples.push({ position: player.position, ...recent });
    }
    const baselines = positionBaselines(baselineSamples);

    // --- project, and score --------------------------------------------------
    const rows = [];
    for (const [gsis, player] of universe) {
      const pick = draftByGsis.get(gsis);
      const projection = projectPlayer(
        {
          position: player.position,
          age: seasonAge(birthByGsis.get(gsis)?.birth_date, SEASON),
          seasons: before.get(gsis),
          gamesMissed: missed.get(gsis) ?? 0,
          draftRound: pick ? num(pick.round) : null,
        },
        baselines,
        rookieCurve,
        SEASON
      );
      const prior = before.get(gsis)?.get(SEASON - 1) ?? null;
      const actual = outcome.get(gsis) ?? { games: 0, pprPoints: 0, receptions: 0 };
      rows.push({
        gsis,
        name: player.name,
        position: player.position,
        team: player.team,
        age: seasonAge(birthByGsis.get(gsis)?.birth_date, SEASON),
        tape: projection.games,
        priorGames: prior?.games ?? 0,
        // Touches a game the season before: the closest thing to "what was his
        // job" that is available without a snap-count join, and the axis a
        // drafter thinks in — a bell cow, a committee back, a bench body.
        priorTouches: prior && prior.games ? (prior.carries + prior.targets) / prior.games : 0,
        model: { points: projection.points, receptions: projection.receptions },
        lastSeason: { points: prior?.pprPoints ?? 0, receptions: prior?.receptions ?? 0 },
        actual: { points: actual.pprPoints, receptions: actual.receptions, games: actual.games },
      });
    }

    // --- the position-mean floor ---------------------------------------------
    // Everyone at a position gets that position's average of the season before,
    // over the players who actually played. It can order positions and nothing
    // else, which is the point of including it: any model that fails to beat it
    // is not ranking players at all.
    const priorByPosition = new Map();
    for (const row of rows) {
      if (row.priorGames === 0) continue;
      if (!priorByPosition.has(row.position)) priorByPosition.set(row.position, []);
      priorByPosition.get(row.position).push(row.lastSeason);
    }
    const positionMean = new Map();
    for (const [position, samples] of priorByPosition) {
      positionMean.set(position, {
        points: mean(samples.map((s) => s.points)),
        receptions: mean(samples.map((s) => s.receptions)),
      });
    }
    for (const row of rows) {
      row.positionMean = positionMean.get(row.position) ?? { points: 0, receptions: 0 };
    }

    // --- ADP, matched by name because it carries no id -----------------------
    const adpFile = JSON.parse(readFileSync(paths[`adp_half_${SEASON}.json`], 'utf8'));
    const byName = new Map();
    for (const row of rows) {
      const key = `${normaliseName(row.name)}|${row.position}`;
      if (byName.has(key)) byName.set(key, 'ambiguous');
      else byName.set(key, row);
    }
    let adpMatched = 0;
    let adpAmbiguous = 0;
    let adpMissing = 0;
    for (const entry of adpFile.players ?? []) {
      const key = `${normaliseName(entry.name)}|${entry.position}`;
      const found = byName.get(key);
      if (found === 'ambiguous') {
        adpAmbiguous++;
        continue;
      }
      if (!found) {
        adpMissing++;
        continue;
      }
      found.adp = entry.adp;
      adpMatched++;
    }
    console.log(
      `  ADP: ${adpMatched} of ${(adpFile.players ?? []).length} matched into the universe ` +
        `(${adpAmbiguous} ambiguous, ${adpMissing} not on a week-1 roster), ` +
        `from ${adpFile.meta?.total_drafts ?? '?'} drafts ${adpFile.meta?.start_date} to ${adpFile.meta?.end_date}`
    );
    console.log(
      `  universe: ${rows.length} players on week-1 rosters at ${[...SCORED_POSITIONS].join('/')}`
    );

    // --- everything from here is scored at the owner's league -----------------
    const scored = (side) => (row) => pointsFor({ position: row.position, ...row[side] }, LEAGUE);
    const actualPoints = scored('actual');
    const MODELS = [
      { key: 'model', label: 'the model', value: scored('model') },
      { key: 'lastSeason', label: 'last season', value: scored('lastSeason') },
      { key: 'positionMean', label: 'position mean', value: scored('positionMean') },
      // ADP is a draft position: lower is better, and there is no point figure
      // behind it, so it can be ranked and never scored for error.
      { key: 'adp', label: 'ADP (market)', value: (row) => -row.adp, rankOnly: true },
    ];

    const report = { season: SEASON, league: LEAGUE, universe: rows.length, tables: {} };

    const measure = (subset, models, label, sizes) => {
      const actuals = subset.map(actualPoints);
      const lines = [];
      for (const model of models) {
        const predicted = subset.map(model.value);
        const rho = spearman(predicted, actuals);
        const errors = model.rankOnly ? null : subset.map((row, i) => predicted[i] - actuals[i]);
        const hits = sizes.map((n) => ({ n, ...hitRate(predicted, actuals, n) }));
        lines.push({
          key: model.key,
          label: model.label,
          n: subset.length,
          spearman: rho,
          mae: errors ? mean(errors.map(Math.abs)) : null,
          bias: errors ? mean(errors) : null,
          hits,
        });
      }
      report.tables[label] = lines;
      return lines;
    };

    const show = (title, lines, note) => {
      console.log(`\n${title}`);
      if (note) console.log(`  ${note}`);
      const sizes = lines[0].hits.map((h) => h.n);
      console.log(
        `    ${'model'.padEnd(15)}${'n'.padStart(5)}${'rho'.padStart(8)}${'MAE'.padStart(8)}${'bias'.padStart(8)}` +
          sizes.map((n) => `  top${n}`.padStart(9)).join('')
      );
      for (const line of lines) {
        console.log(
          `    ${line.label.padEnd(15)}${String(line.n).padStart(5)}` +
            `${(line.spearman == null ? '—' : line.spearman.toFixed(3)).padStart(8)}` +
            `${(line.mae == null ? '—' : line.mae.toFixed(1)).padStart(8)}` +
            `${(line.bias == null ? '—' : (line.bias >= 0 ? '+' : '') + line.bias.toFixed(1)).padStart(8)}` +
            line.hits.map((h) => `${h.hits}/${h.of}`.padStart(9)).join('')
        );
      }
    };

    // 1. the whole rostered universe
    show(
      'EVERY PLAYER ON A WEEK-1 ROSTER',
      measure(rows, MODELS.slice(0, 3), 'all', [24, 60, 120, 192]),
      'rho = Spearman against actual half-PPR points; MAE and bias in points; topN = named/finished'
    );

    // 2. the players the room was actually drafting
    const drafted = rows.filter((row) => row.adp != null);
    show(
      'THE PLAYERS THE ROOM WAS DRAFTING (had an ADP)',
      measure(drafted, MODELS, 'drafted', [24, 60, 120]),
      'the only set ADP can be scored on, so every model is re-scored on it too'
    );

    // 2b. the same players, scored on what an auction is actually buying
    //
    // The table above pools every position together and ranks on raw points,
    // and in half PPR a quarterback outscores a running back by a hundred and
    // fifty of them. So a large part of that correlation is not "did this board
    // sort the players" at all — it is "does this board know quarterbacks score
    // more", which every board knows and no auction pays for. The `position
    // mean` row is the proof: it cannot tell two receivers apart by
    // construction, and it still scores in the thirties.
    //
    // What a bid is buying is points above the man you could have had for a
    // dollar at the same position. `auctionValue` is a linear function of
    // `vorp`, so the board's own ordering IS the ordering by surplus — which
    // makes this, and not the pooled table, the measure of the thing being
    // sold. Replacement is taken from the whole universe rather than the
    // drafted subset, exactly as `pricePool` takes it, and from each model's
    // own predictions, because a model is entitled to be judged on the board it
    // would have printed.
    const asProjected = (value) => (row) => ({ position: row.position, ...value(row) });
    const surplusValue = (side) => {
      const levels = replacementLevels(rows.map(asProjected((row) => row[side])), LEAGUE);
      return (row) => pointsFor({ position: row.position, ...row[side] }, LEAGUE) - (levels[row.position] ?? 0);
    };
    const actualSurplus = surplusValue('actual');
    const SURPLUS_MODELS = [
      { key: 'model', label: 'the model', value: surplusValue('model') },
      { key: 'lastSeason', label: 'last season', value: surplusValue('lastSeason') },
      { key: 'positionMean', label: 'position mean', value: surplusValue('positionMean') },
      { key: 'adp', label: 'ADP (market)', value: (row) => -row.adp, rankOnly: true },
    ];
    {
      const truth = drafted.map(actualSurplus);
      const lines = [];
      for (const model of SURPLUS_MODELS) {
        const predicted = drafted.map(model.value);
        lines.push({
          key: model.key,
          label: model.label,
          n: drafted.length,
          spearman: spearman(predicted, truth),
          hits: [24, 60].map((n) => ({ n, ...hitRate(predicted, truth, n) })),
        });
      }
      report.tables.draftedSurplus = lines;
      console.log('\nTHE SAME PLAYERS, SCORED ON SURPLUS OVER REPLACEMENT');
      console.log(
        '  what a bid is actually buying; the pooled table above is part positional ordering'
      );
      console.log(
        `    ${'model'.padEnd(15)}${'n'.padStart(5)}${'rho'.padStart(8)}` +
          [24, 60].map((n) => `  top${n}`.padStart(9)).join('')
      );
      for (const line of lines) {
        console.log(
          `    ${line.label.padEnd(15)}${String(line.n).padStart(5)}` +
            `${(line.spearman == null ? '—' : line.spearman.toFixed(3)).padStart(8)}` +
            line.hits.map((h) => `${h.hits}/${h.of}`.padStart(9)).join('')
        );
      }
    }

    // 3. by position
    console.log('\nBY POSITION');
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      const subset = rows.filter((row) => row.position === position);
      const draftedHere = drafted.filter((row) => row.position === position);
      const lines = measure(subset, MODELS.slice(0, 3), `position:${position}`, [12, 24]);
      const withAdp = measure(draftedHere, MODELS, `position-drafted:${position}`, [12, 24]);
      const cell = (line) => (line.spearman == null ? '   —  ' : line.spearman.toFixed(3));
      console.log(
        `    ${position.padEnd(4)} n=${String(subset.length).padStart(3)}   ` +
          lines.map((l) => `${l.label} ${cell(l)}`).join('   ') +
          `   |  drafted only (n=${draftedHere.length}): ` +
          withAdp.map((l) => `${l.label} ${cell(l)}`).join('  ')
      );
    }

    // 4. where the model is worst
    //
    // An average over the whole field is not actionable: "the model is fine" and
    // "the model is excellent at receivers and useless at backs" produce the same
    // number, and only one of them tells the owner what to do on the night.
    const buckets = [
      {
        title: 'BY AGE',
        of: (row) =>
          row.age == null
            ? null
            : row.age <= 23
              ? '≤23'
              : row.age <= 26
                ? '24-26'
                : row.age <= 29
                  ? '27-29'
                  : '30+',
        order: ['≤23', '24-26', '27-29', '30+'],
      },
      {
        title: 'BY GAMES OF TAPE THE PROJECTION SAW',
        of: (row) =>
          row.tape === 0
            ? 'none (rookie)'
            : row.tape <= 16
              ? '1-16'
              : row.tape <= 33
                ? '17-33'
                : '34+',
        order: ['none (rookie)', '1-16', '17-33', '34+'],
      },
      {
        title: 'BY ROLE THE SEASON BEFORE (touches per game)',
        of: (row) =>
          row.priorGames === 0
            ? 'did not play'
            : row.priorTouches < 4
              ? 'bench (<4)'
              : row.priorTouches < 10
                ? 'rotation (4-10)'
                : row.priorTouches < 17
                  ? 'committee (10-17)'
                  : 'feature (17+)',
        order: [
          'did not play',
          'bench (<4)',
          'rotation (4-10)',
          'committee (10-17)',
          'feature (17+)',
        ],
      },
    ];
    for (const bucket of buckets) {
      console.log(`\n${bucket.title}`);
      console.log(
        `    ${'bucket'.padEnd(18)}${'n'.padStart(5)}${'rho'.padStart(8)}${'MAE'.padStart(8)}${'bias'.padStart(8)}   vs last season`
      );
      const rowsFor = new Map();
      for (const row of rows) {
        const key = bucket.of(row);
        if (key == null) continue;
        if (!rowsFor.has(key)) rowsFor.set(key, []);
        rowsFor.get(key).push(row);
      }
      const table = [];
      for (const key of bucket.order) {
        const subset = rowsFor.get(key) ?? [];
        if (subset.length < 3) continue;
        const lines = measure(subset, MODELS.slice(0, 2), `${bucket.title}:${key}`, [12]);
        const [m, last] = lines;
        table.push({ key, ...m, lastSeasonMae: last.mae, lastSeasonSpearman: last.spearman });
        console.log(
          `    ${key.padEnd(18)}${String(subset.length).padStart(5)}` +
            `${(m.spearman == null ? '—' : m.spearman.toFixed(3)).padStart(8)}` +
            `${m.mae.toFixed(1).padStart(8)}` +
            `${((m.bias >= 0 ? '+' : '') + m.bias.toFixed(1)).padStart(8)}` +
            `   rho ${last.spearman == null ? '—' : last.spearman.toFixed(3)}, MAE ${last.mae.toFixed(1)}`
        );
      }
      report.tables[bucket.title] = table;
    }

    // ---------------------------------------------------------------------------
    // 5. dollars
    //
    // A correlation is not a decision. The same projections go through the same
    // `pricePool` the board uses, at the owner's league, and the question becomes
    // the one he actually faces: what would this have cost.
    // ---------------------------------------------------------------------------
    const priceBy = (value) =>
      pricePool(
        rows.map((row) => ({ position: row.position, points: value(row), receptions: 0 })),
        LEAGUE
      ).priced;
    // Points are already restated to half PPR by `scored`, so receptions are
    // zeroed going into the pricer — subtracting them twice would charge the
    // league for catches nobody was paid for.
    const modelPrice = priceBy(scored('model'));
    const lastPrice = priceBy(scored('lastSeason'));
    const truePrice = priceBy(actualPoints);

    const priced = rows.map((row, i) => ({
      ...row,
      modelPrice: modelPrice[i].auctionValue,
      lastPrice: lastPrice[i].auctionValue,
      truePrice: truePrice[i].auctionValue,
    }));

    const dollarError = (list, key) => mean(list.map((row) => Math.abs(row[key] - row.truePrice)));
    const worthOwning = [...priced].sort((a, b) => b.truePrice - a.truePrice).slice(0, 192);
    console.log('\nDOLLARS, AT 12 TEAMS / $200 / 16 SPOTS / HALF PPR');
    console.log(
      `    over the 192 players who turned out to be worth owning: ` +
        `model off by $${dollarError(worthOwning, 'modelPrice').toFixed(2)} a man, ` +
        `last season off by $${dollarError(worthOwning, 'lastPrice').toFixed(2)}`
    );
    const modelBoard = [...priced].sort((a, b) => b.modelPrice - a.modelPrice).slice(0, 192);
    const lastBoard = [...priced].sort((a, b) => b.lastPrice - a.lastPrice).slice(0, 192);
    console.log(
      `    over the 192 each board would have you buy: ` +
        `model off by $${dollarError(modelBoard, 'modelPrice').toFixed(2)} a man, ` +
        `last season off by $${dollarError(lastBoard, 'lastPrice').toFixed(2)}`
    );
    report.dollars = {
      hindsightTop192: {
        model: dollarError(worthOwning, 'modelPrice'),
        lastSeason: dollarError(worthOwning, 'lastPrice'),
      },
      ownBoardTop192: {
        model: dollarError(modelBoard, 'modelPrice'),
        lastSeason: dollarError(lastBoard, 'lastPrice'),
      },
    };

    // Where the two boards actually disagreed, and who was right.
    const disagreements = priced
      .filter((row) => row.modelPrice > 1 || row.lastPrice > 1)
      .map((row) => ({ ...row, gap: row.modelPrice - row.lastPrice }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
      .slice(0, 20);
    console.log('\n    the twenty biggest disagreements between the model and last season');
    console.log(
      `      ${'player'.padEnd(24)}${'pos'.padEnd(4)}${'model'.padStart(7)}${'last'.padStart(7)}${'truth'.padStart(7)}   who was closer`
    );
    let modelCloser = 0;
    let lastCloser = 0;
    for (const row of disagreements) {
      const dm = Math.abs(row.modelPrice - row.truePrice);
      const dl = Math.abs(row.lastPrice - row.truePrice);
      if (dm < dl) modelCloser++;
      else if (dl < dm) lastCloser++;
      console.log(
        `      ${String(row.name).slice(0, 23).padEnd(24)}${row.position.padEnd(4)}` +
          `${('$' + row.modelPrice).padStart(7)}${('$' + row.lastPrice).padStart(7)}${('$' + row.truePrice).padStart(7)}` +
          `   ${dm === dl ? 'tie' : dm < dl ? `model, by $${dl - dm}` : `last season, by $${dm - dl}`}`
      );
    }
    console.log(`      model closer on ${modelCloser}, last season closer on ${lastCloser}`);
    report.dollars.disagreements = disagreements.map((row) => ({
      name: row.name,
      position: row.position,
      model: row.modelPrice,
      lastSeason: row.lastPrice,
      truth: row.truePrice,
    }));

    // The individual misses, because a mean error is not a lesson. These are the
    // players a manager would remember, and they are where the shape of the
    // model's failure is legible.
    const draftedPriced = priced.filter((row) => row.adp != null);
    const missBy = (sign) =>
      [...draftedPriced]
        .map((row) => ({ row, error: sign * (scored('model')(row) - actualPoints(row)) }))
        .sort((a, b) => b.error - a.error)
        .slice(0, 8);
    const missLine = ({ row, error }) =>
      `${String(row.name).slice(0, 20).padEnd(21)}${row.position.padEnd(4)}` +
      `proj ${scored('model')(row).toFixed(0).padStart(4)}  actual ${actualPoints(row).toFixed(0).padStart(4)}` +
      `  off by ${error.toFixed(0).padStart(4)}   ADP ${String(row.adp).padStart(5)}  hindsight $${row.truePrice}`;
    console.log('\n    the model over-projected these most, among players the room was drafting');
    for (const miss of missBy(1)) console.log(`      ${missLine(miss)}`);
    console.log('\n    and under-projected these most');
    for (const miss of missBy(-1)) console.log(`      ${missLine(miss)}`);
    report.misses = {
      over: missBy(1).map(({ row, error }) => ({ name: row.name, position: row.position, error })),
      under: missBy(-1).map(({ row, error }) => ({
        name: row.name,
        position: row.position,
        error,
      })),
    };

    // The comparison that decides whether to trust the board over the room: where
    // the model and the market ranked a player very differently, whose side was
    // the money on? Measured in hindsight dollars, since that is the unit the
    // disagreement is settled in.
    const withAdp = priced.filter((row) => row.adp != null);
    const modelRankByGsis = new Map(
      [...withAdp].sort((a, b) => b.modelPrice - a.modelPrice).map((row, i) => [row.gsis, i + 1])
    );
    const adpRankByGsis = new Map(
      [...withAdp].sort((a, b) => a.adp - b.adp).map((row, i) => [row.gsis, i + 1])
    );
    const marketGap = withAdp
      .map((row) => ({
        ...row,
        modelRank: modelRankByGsis.get(row.gsis),
        adpRank: adpRankByGsis.get(row.gsis),
        gap: adpRankByGsis.get(row.gsis) - modelRankByGsis.get(row.gsis),
      }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const modelHigher = marketGap.filter((row) => row.gap > 0).slice(0, 15);
    const marketHigher = marketGap.filter((row) => row.gap < 0).slice(0, 15);
    const finish = (row) => row.truePrice;
    console.log('\n    the model against the market: fifteen biggest disagreements each way');
    console.log(
      `      model liked them more:  mean hindsight value $${mean(modelHigher.map(finish)).toFixed(1)}  ` +
        `(${modelHigher
          .map((r) => `${r.name} ${r.modelRank}v${r.adpRank}→$${r.truePrice}`)
          .slice(0, 5)
          .join(', ')})`
    );
    console.log(
      `      market liked them more: mean hindsight value $${mean(marketHigher.map(finish)).toFixed(1)}  ` +
        `(${marketHigher
          .map((r) => `${r.name} ${r.modelRank}v${r.adpRank}→$${r.truePrice}`)
          .slice(0, 5)
          .join(', ')})`
    );
    // Mean hindsight value says which side of a disagreement the money was on. It
    // does not say who was closer, which is a different question and the one a
    // drafter is really asking, so it is answered separately: over the same
    // disagreements, was the player's actual finish nearer the model's rank or
    // the market's? Both sets are drawn from one universe and the gap is
    // symmetric in rank units, so neither measure is loaded toward a side.
    const actualRankByGsis = new Map(
      [...withAdp]
        .sort((a, b) => actualPoints(b) - actualPoints(a))
        .map((row, i) => [row.gsis, i + 1])
    );
    const contested = [...modelHigher, ...marketHigher];
    let modelNearer = 0;
    let marketNearer = 0;
    for (const row of contested) {
      const truth = actualRankByGsis.get(row.gsis);
      const dm = Math.abs(truth - row.modelRank);
      const da = Math.abs(truth - row.adpRank);
      if (dm < da) modelNearer++;
      else if (da < dm) marketNearer++;
    }
    console.log(
      `      on those ${contested.length} disagreements the finish was nearer the model on ${modelNearer} ` +
        `and nearer the market on ${marketNearer}`
    );

    report.dollars.versusMarket = {
      modelHigher: modelHigher.map((r) => ({
        name: r.name,
        position: r.position,
        modelRank: r.modelRank,
        adpRank: r.adpRank,
        truth: r.truePrice,
      })),
      marketHigher: marketHigher.map((r) => ({
        name: r.name,
        position: r.position,
        modelRank: r.modelRank,
        adpRank: r.adpRank,
        truth: r.truePrice,
      })),
      meanHindsight: {
        modelHigher: mean(modelHigher.map(finish)),
        marketHigher: mean(marketHigher.map(finish)),
      },
      nearer: { model: modelNearer, market: marketNearer },
    };

    return report;
  };

  return run();
};

/**
 * The three seasons on one screen.
 *
 * Everything above prints one season in detail; this is the line the owner
 * reads, and what it leads with was got wrong once in a way worth recording.
 *
 * The first version of this summary led with Spearman against raw fantasy
 * points over the players the room was drafting, and on that number the model
 * beat the market in all three seasons. The number is real and the conclusion
 * drawn from it was not. Pooling every position and ranking on raw points means
 * a large part of the correlation is just "quarterbacks outscore running
 * backs", which is true, which every board knows, and which no auction pays a
 * dollar for — the `position mean` row, which cannot tell two receivers apart
 * by construction, scored in the thirties on it. Score the same boards on
 * surplus over replacement, which is what `auctionValue` is a linear function
 * of and therefore what the board is actually claiming, and the position-mean
 * row scores nothing at all, and the market beats the model in every season.
 *
 * So the surplus table leads and the pooled table is printed underneath it with
 * that explanation attached, rather than deleted: it is the number somebody
 * will otherwise recompute and be encouraged by.
 */
const summarise = (reports) => {
  const cell = (value, digits = 3) => (value == null ? '—' : value.toFixed(digits));
  const line = (report, table, key) => report.tables[table]?.find((l) => l.key === key);

  console.log(`\n${'='.repeat(78)}\nSUMMARY`);

  console.log('\n  1. SURPLUS OVER REPLACEMENT — what a bid is buying');
  console.log('     the players the room was drafting, ranked by points above the man you');
  console.log('     could have had for a dollar at the same position');
  console.log(
    `\n    ${'season'.padEnd(8)}${'n'.padStart(5)}` +
      ['model', 'last season', 'position mean', 'ADP (market)'].map((l) => l.padStart(15)).join('')
  );
  for (const report of reports) {
    const rows = report.tables.draftedSurplus;
    console.log(
      `    ${String(report.season).padEnd(8)}${String(rows[0].n).padStart(5)}` +
        rows.map((l) => cell(l.spearman).padStart(15)).join('')
    );
  }
  console.log('    (Spearman; higher is better. The position-mean floor scores nothing here,');
  console.log('     which is the point: it orders positions, and an auction does not buy that.)');

  console.log('\n  2. WITHIN EACH POSITION — the same question asked one position at a time');
  console.log(
    `\n    ${'season'.padEnd(8)}` +
      ['QB', 'RB', 'WR', 'TE'].map((p) => `${p} model / ADP`.padStart(18)).join('')
  );
  let modelWins = 0;
  let marketWins = 0;
  for (const report of reports) {
    const cells = [];
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      const table = `position-drafted:${position}`;
      const model = line(report, table, 'model')?.spearman;
      const adp = line(report, table, 'adp')?.spearman;
      if (model != null && adp != null) (model > adp ? modelWins++ : marketWins++);
      cells.push(`${cell(model)} / ${cell(adp)}`.padStart(18));
    }
    console.log(`    ${String(report.season).padEnd(8)}${cells.join('')}`);
  }
  console.log(
    `    the market's board sorted the position better in ${marketWins} of the ` +
      `${modelWins + marketWins} position-seasons`
  );

  console.log('\n  3. WHERE THE TWO BOARDS DISAGREE MOST — who was right');
  for (const report of reports) {
    const { nearer, meanHindsight } = report.dollars.versusMarket;
    console.log(
      `    ${String(report.season).padEnd(8)}   nearer the model on ${String(nearer.model).padStart(2)}, ` +
        `nearer the market on ${String(nearer.market).padStart(2)}   ` +
        `(what they were worth in hindsight: the model's picks $${meanHindsight.modelHigher.toFixed(1)}, ` +
        `the market's $${meanHindsight.marketHigher.toFixed(1)})`
    );
  }
  console.log('    This is the practical finding. A sharp disagreement with consensus is more');
  console.log('    often the board being wrong than a bargain being found.');

  console.log('\n  4. DOLLARS — mean error per man over the 192 worth owning');
  for (const report of reports) {
    const d = report.dollars.hindsightTop192;
    console.log(
      `    ${String(report.season).padEnd(8)}   model $${d.model.toFixed(2)}` +
        `   last season $${d.lastSeason.toFixed(2)}`
    );
  }

  console.log('\n  5. FOR REFERENCE — raw points, every position pooled');
  console.log('     Not the headline, and printed so that nobody recomputes it and is');
  console.log('     encouraged. Much of this is the positional ordering, which no bid buys.');
  console.log(
    `\n    ${'season'.padEnd(8)}${'n'.padStart(5)}` +
      ['model', 'last season', 'position mean', 'ADP (market)'].map((l) => l.padStart(15)).join('')
  );
  for (const report of reports) {
    const rows = report.tables.drafted;
    console.log(
      `    ${String(report.season).padEnd(8)}${String(rows[0].n).padStart(5)}` +
        rows.map((l) => cell(l.spearman).padStart(15)).join('')
    );
  }
};

const main = async () => {
  const reports = [];
  for (const season of SEASONS) {
    console.log(`\n${'='.repeat(78)}`);
    reports.push(await backtest(season));
  }
  if (reports.length > 1) summarise(reports);
  if (jsonOut) {
    const out = resolve(ROOT, jsonOut);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(reports, null, 2));
    console.log(`\nwrote ${out}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
