/**
 * Reading nflverse, without a second opinion about what the numbers mean.
 *
 * Two scripts now read these files: `build-player-pool.mjs`, which projects the
 * season about to be played, and `backtest-projections.mjs`, which projects a
 * season that has already happened and scores the result. The projection model
 * itself is shared through `src/lib/projection.ts` for the obvious reason — a
 * backtest of a copy proves nothing about the original — and the same argument
 * applies one layer down, to how a week of production becomes a number of
 * points.
 *
 * Kickers make that concrete. nflverse publishes no PPR total for a kicker, so
 * `kickerPoints` invents one out of the made-field-goal buckets. If the
 * backtest scored a kicker's *actual* season with different arithmetic from the
 * one the builder used to project him, the error it reported would be partly
 * the difference between two scoring systems and there would be no way to tell
 * how much. So the scoring lives here, once, and both scripts import it.
 *
 * The CSV reader is here for the duller reason: it is forty lines of quoting
 * rules that no one should write twice.
 */
import { mkdirSync, readFileSync, existsSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gunzipSync } from 'node:zlib';

export const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download';

/**
 * A file, downloaded once and kept.
 *
 * These assets run to tens of megabytes and do not change between runs of a
 * script, so a rebuild that re-downloaded them would cost minutes to learn
 * nothing. `offline` refuses to reach the network at all, which is what makes
 * a build reproducible from a checkout of the cache.
 */
export const makeCache = ({ dir, offline = false }) => {
  return async (name, url) => {
    const path = join(dir, name);
    if (existsSync(path)) return path;
    if (offline) throw new Error(`--offline and ${name} is not cached`);
    mkdirSync(dir, { recursive: true });
    process.stdout.write(`  fetching ${name}… `);
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
    console.log('done');
    return path;
  };
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
export function* readCsv(path, wanted) {
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

export const num = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** nflverse spells a few teams differently from ESPN. */
export const TEAM_ALIASES = {
  LA: 'LAR',
  JAC: 'JAX',
  AZ: 'ARI',
  WAS: 'WSH',
  SD: 'LAC',
  OAK: 'LV',
  STL: 'LAR',
};
export const canonicalTeam = (abbr) => TEAM_ALIASES[abbr] ?? abbr;

/** Scoring for kickers, who carry no PPR value in the source data. */
export const kickerPoints = (row) => {
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
// weekly stats: two schema generations, one shape
//
// The 1999-2024 asset carries 53 columns; the 2025 asset carries 150 and renamed
// several of them. Everything downstream reads this normalized row instead.
// ---------------------------------------------------------------------------

export const normalizeWeek = (row) => ({
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
