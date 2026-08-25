/**
 * Reading somebody else's rankings.
 *
 * The pool is joined on ids the whole way — no name matching anywhere — but a
 * CSV a person exports from their own spreadsheet carries names and nothing
 * else, so names are all there is to match on here. The rule that survives is
 * the important half of it: **never guess**. A row that matches two players
 * matches neither, and is reported for the person to fix rather than bound to
 * whichever one happened to sort first.
 *
 * Nothing in this file reads the DOM or the engine; it takes text and a roster
 * and returns what it could and could not resolve.
 */

export interface RankingRow {
  /** 1-based line in the source, for pointing at the row that went wrong. */
  line: number;
  name: string;
  position?: string;
  rank?: number;
  value?: number;
  tier?: number;
  notes?: string;
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  team: string;
}

export type Resolution =
  | { status: 'matched'; row: RankingRow; player: Candidate }
  | { status: 'unmatched'; row: RankingRow }
  /** Two or more players answer to this name; the person has to say which. */
  | { status: 'ambiguous'; row: RankingRow; options: Candidate[] };

export interface ParsedRankings {
  resolutions: Resolution[];
  /** Rows that were not rankings at all — blank, headers, malformed. */
  skipped: Array<{ line: number; reason: string }>;
}

/**
 * Split one CSV line, honouring quoted fields.
 *
 * The app's own export quotes every cell and doubles embedded quotes, so a
 * naive `split(',')` cannot read back what Draft Vault just wrote — nor any
 * note containing a comma, which the shipped template invites.
 */
export const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else cell += char;
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
};

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * Reduce a name to what two spellings of the same person share.
 *
 * Punctuation and generational suffixes vary between sources — Ja'Marr and
 * JaMarr, Kenneth Walker III and Kenneth Walker — and none of it distinguishes
 * two actual people.
 */
export const normaliseName = (name: string): string => {
  const words = name
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(' ');
};

/** "Jahmyr Gibbs" -> "j gibbs", the form abbreviated sources publish. */
const initialForm = (normalised: string): string | null => {
  const words = normalised.split(' ');
  if (words.length < 2) return null;
  return `${words[0][0]} ${words.slice(1).join(' ')}`;
};

const asNumber = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const HEADER_WORDS = ['name', 'player', 'rank', 'value', 'tier', 'position', 'pos'];

/** Whether a line is a header row rather than a ranking. */
const looksLikeHeader = (cells: string[]): boolean => {
  const lowered = cells.map((cell) => cell.toLowerCase());
  const named = lowered.some((cell) => cell === 'name' || cell === 'player');
  const hasNumber = cells.some((cell) => Number.isFinite(Number.parseFloat(cell)));
  return named && !hasNumber && lowered.some((cell) => HEADER_WORDS.includes(cell));
};

/**
 * Work out which column is which from the header, falling back to the order the
 * shipped template uses. A file exported from somewhere else rarely puts its
 * columns in our order, and asking people to rearrange a spreadsheet before
 * importing it is how an import feature goes unused.
 */
const columnMap = (header: string[] | null): Record<string, number> => {
  const fallback = { name: 0, position: 1, rank: 2, value: 3, tier: 4, notes: 5 };
  if (!header) return fallback;

  const map: Record<string, number> = {};
  header.forEach((cell, index) => {
    const key = cell.toLowerCase().trim();
    if (key === 'name' || key === 'player') map.name ??= index;
    else if (key === 'position' || key === 'pos') map.position ??= index;
    else if (key === 'rank' || key === 'overall' || key === 'ovr') map.rank ??= index;
    else if (key === 'value' || key === 'price' || key === 'auction' || key === '$')
      map.value ??= index;
    else if (key === 'tier') map.tier ??= index;
    else if (key === 'notes' || key === 'note' || key === 'comment') map.notes ??= index;
  });
  return { ...fallback, ...map };
};

/** Read a ranking file into rows, without yet deciding who they refer to. */
export const parseRankings = (
  text: string
): { rows: RankingRow[]; skipped: ParsedRankings['skipped'] } => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const rows: RankingRow[] = [];
  const skipped: ParsedRankings['skipped'] = [];

  let columns = columnMap(null);
  let headerSeen = false;

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;

    const cells = splitCsvLine(line);
    if (!headerSeen && looksLikeHeader(cells)) {
      columns = columnMap(cells);
      headerSeen = true;
      return;
    }

    const at = (key: string): string | undefined => {
      const position = columns[key];
      return position === undefined ? undefined : cells[position];
    };

    const name = at('name');
    if (!name) {
      skipped.push({ line: index + 1, reason: 'no player name in this row' });
      return;
    }

    const position = at('position')?.toUpperCase();
    rows.push({
      line: index + 1,
      name,
      position:
        position && /^(QB|RB|WR|TE|K|DST|DEF|D\/ST)$/.test(position)
          ? position === 'DEF' || position === 'D/ST'
            ? 'DST'
            : position
          : undefined,
      rank: asNumber(at('rank')),
      value: asNumber(at('value')),
      tier: asNumber(at('tier')),
      notes: at('notes') || undefined,
    });
  });

  return { rows, skipped };
};

/**
 * Bind rows to players, refusing to guess.
 *
 * Matching runs in two passes over progressively looser name forms, and each
 * pass only accepts a name that resolves to exactly one player. A position in
 * the file narrows the field first, which is what lets "J. Smith, WR" resolve
 * where "J. Smith" alone cannot.
 */
export const resolveRankings = (rows: RankingRow[], roster: readonly Candidate[]): Resolution[] => {
  const byName = new Map<string, Candidate[]>();
  const byInitial = new Map<string, Candidate[]>();

  for (const player of roster) {
    const normalised = normaliseName(player.name);
    const push = (map: Map<string, Candidate[]>, key: string) => {
      const list = map.get(key);
      if (list) list.push(player);
      else map.set(key, [player]);
    };
    push(byName, normalised);
    const initial = initialForm(normalised);
    if (initial) push(byInitial, initial);
  }

  return rows.map((row): Resolution => {
    const normalised = normaliseName(row.name);

    for (const index of [byName, byInitial]) {
      const all = index.get(normalised) ?? [];
      // A stated position is a filter, never a tie-break applied after the fact.
      const candidates = row.position ? all.filter((p) => p.position === row.position) : all;
      if (candidates.length === 1) return { status: 'matched', row, player: candidates[0] };
      if (candidates.length > 1) return { status: 'ambiguous', row, options: candidates };
    }

    return { status: 'unmatched', row };
  });
};

export const parseAndResolve = (text: string, roster: readonly Candidate[]): ParsedRankings => {
  const { rows, skipped } = parseRankings(text);
  return { resolutions: resolveRankings(rows, roster), skipped };
};

/** What an import actually changes about a player. */
export interface RankingOverride {
  value?: number;
  rank?: number;
  tier?: number;
  notes?: string;
}

/** Collapse resolved rows into the overrides the engine applies. */
export const toOverrides = (
  resolutions: readonly Resolution[]
): Record<string, RankingOverride> => {
  const overrides: Record<string, RankingOverride> = {};
  for (const resolution of resolutions) {
    if (resolution.status !== 'matched') continue;
    const { row } = resolution;
    const override: RankingOverride = {};
    // A value of zero is a real opinion ("worth nothing"); only absence is absent.
    if (row.value !== undefined) override.value = Math.max(1, Math.round(row.value));
    if (row.rank !== undefined && row.rank > 0) override.rank = Math.round(row.rank);
    if (row.tier !== undefined && row.tier > 0) override.tier = Math.round(row.tier);
    if (row.notes) override.notes = row.notes;
    if (Object.keys(override).length) overrides[resolution.player.id] = override;
  }
  return overrides;
};

/** The template the import dialog offers, in the order the parser expects. */
export const RANKINGS_TEMPLATE = [
  'Name,Position,Rank,Value,Tier,Notes',
  'Ja’Marr Chase,WR,1,62,1,"Target share, red zone"',
  'Jahmyr Gibbs,RB,2,55,1,',
  'Bijan Robinson,RB,3,54,1,Workhorse',
  'Malik Nabers,WR,4,48,2,',
].join('\n');
