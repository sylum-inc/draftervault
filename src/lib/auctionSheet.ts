/**
 * The commissioner's auction sheet, as it actually arrives.
 *
 * The engine used to know only a sheet *size*, and priced the best N players by
 * surplus as though the commissioner had picked ours. He did not: the sheet is
 * a specific list of fifty to a hundred names taken off somebody's consensus
 * rankings, and it will not match our top N. A player we price at $2 who is on
 * that sheet gets bid on with no guidance at all, and anything measured over
 * "what is still for sale" has no denominator until the list is known.
 *
 * It arrives as an email, a Slack message, a column pasted out of Google
 * Sheets, or somebody reading a screenshot out loud — so pasting has to work,
 * not only a file, and the shapes below are the ones that actually turn up.
 *
 * `parseRankings` in rankingsCsv.ts is deliberately not extended to cover them.
 * It reads exactly one cell per line through a column map, which is right for a
 * spreadsheet export and silently wrong for a sheet: "Chase, Gibbs, Robinson"
 * pasted out of Slack yields one row and loses two players. Losing a player off
 * the sheet is the worst failure this file can have, so parsing is its own.
 * Matching is not: `resolveRankings` already refuses to guess, and that rule is
 * the reason it exists.
 *
 * Nothing here reads the DOM or the engine — text and a roster in, rows out.
 */

import { normaliseName, resolveRankings, splitCsvLine } from './rankingsCsv';
import type { Candidate, RankingRow, Resolution } from './rankingsCsv';

/**
 * One line of the sheet.
 *
 * A sheet says who is being auctioned and nothing about what they are worth: a
 * "$54" beside a name is the source's price, not ours, and importing it would
 * quietly turn a list of names into a rankings import. It is parsed off the
 * line so it cannot be mistaken for part of the name, and then dropped.
 *
 * `team` is the addition over `RankingRow`. Position alone cannot separate
 * Bijan Robinson from Brian Robinson — both are backs — and the pool holds 27
 * names that collide on first-initial-plus-surname, so "B. Robinson RB ATL" is
 * resolvable exactly where "B. Robinson" is not.
 */
export interface SheetRow extends RankingRow {
  team?: string;
  /**
   * Unique per row, unlike `line`.
   *
   * A comma run puts several players on one line — which is the whole reason
   * this parser exists — so keying a hand-made binding by line number makes two
   * ambiguous names on one line share a slot. Answering the second overwrites
   * the first, both rows then resolve to the same player, and the deduplication
   * quietly drops one of them. `line` is for showing the operator where to look;
   * this is for telling two rows apart.
   */
  id: number;
}

export interface ParsedSheet {
  /** One per row that was kept, in the order the sheet listed them. */
  resolutions: Array<Resolution<SheetRow>>;
  /** Rows naming somebody an earlier row already claimed. */
  duplicates: Array<{ line: number; name: string }>;
  /**
   * Lines that were not players at all — headers, section titles, junk.
   *
   * Carries the text, not just a count. Every other way a name can be lost
   * names the row; a bare "1 line skipped" cannot be checked against the sheet
   * in your hand, which is precisely when you need to check it.
   */
  skipped: Array<{ line: number; text: string; reason: string }>;
}

const POSITION_TOKENS: Record<string, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  K: 'K',
  PK: 'K',
  DST: 'DST',
  DEF: 'DST',
  'D/ST': 'DST',
  DEFENSE: 'DST',
  DEFENCE: 'DST',
};

/**
 * The 32 clubs, plus the spellings other sources use for them.
 *
 * Hardcoded rather than read off the pool because classification happens before
 * any roster is in hand: a token has to be recognised as a club to be dropped
 * out of a name, and "Bijan Robinson (ATL)" has to parse the same way whether
 * or not anybody has passed a pool in. The aliases are the codes that differ
 * between sources — a sheet built off ESPN says WSH where one built off
 * nflverse says WAS, and neither is wrong.
 */
const TEAM_ALIASES: Record<string, string> = {
  JAC: 'JAX',
  WAS: 'WSH',
  LA: 'LAR',
  STL: 'LAR',
  SD: 'LAC',
  OAK: 'LV',
  LVR: 'LV',
  ARZ: 'ARI',
  // How people actually type Arizona and Philadelphia. Worth adding because an
  // unrecognised trailing token blocks the position token before it: "Trey
  // McBride TE AZ" failed to resolve a correctly-spelled name, since "AZ" was
  // not a club and so "TE" stopped being a trailing label.
  //
  // Deliberately not here: PHIL, JACK, WASH, PITT and the rest of the
  // human-typed forms that are also somebody's name. A club token is stripped
  // out of the name, so admitting PHIL would turn "Phil Dorsett" into
  // "Dorsett" of Philadelphia. AZ and PHL are nobody's name.
  AZ: 'ARI',
  PHL: 'PHI',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  TAM: 'TB',
  GNB: 'GB',
  KAN: 'KC',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
};

const TEAM_CODES = new Set([
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LAC',
  'LAR',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WSH',
]);

/** Words that mean "this line is a column header", not a player. */
const HEADER_WORDS = new Set([
  'name',
  'player',
  'players',
  'pos',
  'position',
  'team',
  'tm',
  'nfl',
  'rank',
  'rk',
  'overall',
  'ovr',
  'adp',
  'tier',
  'value',
  'price',
  'cost',
  '$',
  'auction',
  'bye',
  'notes',
  'note',
]);

/**
 * Words that only ever appear in a title.
 *
 * A sheet pasted out of an email carries its own heading — "2026 AUCTION SHEET
 * — TOP 100" — and a title reported as a player nobody can find is noise on the
 * one screen that has to be readable at a glance. None of these is a word in
 * anybody's name.
 */
const HEADING_WORDS = new Set([
  'auction',
  'sheet',
  'rankings',
  'ranking',
  'commissioner',
  'commish',
  'draft',
  'tier',
  'round',
  'top',
  'list',
  'board',
  'updated',
  'nomination',
  'nominations',
  'auction',
  'players',
  'pool',
]);

/** Bare noise beside a name: a price, a rank, a bye week, a dash. */
const NOISE_WORDS = new Set(['BYE', 'B', 'ADP', 'RK', 'ECR', 'TIER', 'NA', 'N/A', '-', '–', '—']);

type TokenKind =
  | { kind: 'position'; value: string }
  | { kind: 'team'; value: string }
  | { kind: 'noise' };

/** A token stripped of the punctuation a sheet wraps it in: "(ATL)," -> "ATL". */
/**
 * A single letter is always part of a name, never a label.
 *
 * "B" is in the noise list and "K" is a position, so "B Robinson" and "K Walker"
 * had their initial stripped and came back unmatched — losing exactly the
 * abbreviated names the stated-club narrowing exists to rescue. Every label that
 * matters is two or three letters, so this costs nothing.
 */
const isInitial = (token: string): boolean => /^[A-Z]\.?$/.test(bare(token));

/** A token stripped of the punctuation a sheet wraps it in: "(ATL)," -> "ATL". */
const bare = (token: string): string =>
  token
    .replace(/^[([{"']+/, '')
    .replace(/[)\]}"',;:]+$/, '')
    .toUpperCase();

/**
 * What a token is, if it is not part of a name.
 *
 * A trailing period is what separates "K." — Kenneth Walker's initial — from
 * "K", the position. Both read as a kicker otherwise, and the name loses its
 * first letter.
 */
const classify = (token: string): TokenKind | null => {
  const cleaned = bare(token);
  if (!cleaned) return { kind: 'noise' };
  if (/^\$?-?\d+(?:[.,]\d+)?%?$/.test(cleaned)) return { kind: 'noise' };
  if (/^#\d+$/.test(cleaned)) return { kind: 'noise' };
  if (isInitial(token)) return null;
  if (NOISE_WORDS.has(cleaned)) return { kind: 'noise' };
  // A heading word sitting beside a name is an annotation on it — "Chase — Tier
  // 1", "Gibbs (top 5)". It comes off the ends like any other label, while a
  // line made only of them is a section title and never gets this far.
  if (HEADING_WORDS.has(cleaned.toLowerCase())) return { kind: 'noise' };

  const hasPeriod = /\./.test(token.replace(/\.$/, '')) || /^[A-Za-z]\.$/.test(token);
  if (!hasPeriod && POSITION_TOKENS[cleaned])
    return { kind: 'position', value: POSITION_TOKENS[cleaned] };
  const team = TEAM_ALIASES[cleaned] ?? cleaned;
  if (!hasPeriod && TEAM_CODES.has(team)) return { kind: 'team', value: team };
  return null;
};

/** Tokens that could be somebody's name, as opposed to a label beside it. */
const hasName = (tokens: string[]): boolean => tokens.some((token) => !classify(token));

interface Cell {
  words: string[];
  position?: string;
  team?: string;
}

/**
 * Read one cell: the name in it, and whatever labels sit around the name.
 *
 * Labels are taken off the ends rather than filtered out of the middle, because
 * the middle of a name is where an initial lives. "K. Walker III" keeps all
 * three tokens; "Ja'Marr Chase WR CIN" gives up two.
 *
 * Nothing is ever stripped down to nothing: "DEN Defense" is a team defence,
 * and a rule that reads "Defense" as a position label and "DEN" as a club would
 * leave the row with no name at all.
 */
const readCell = (cell: string): Cell => {
  const tokens = cell.split(/\s+/).filter(Boolean);

  /*
   * A team defence is the one player whose whole name is labels.
   *
   * "DEN Defense", "DEN DST" and "DEN D/ST" all name somebody; "WR CIN" beside
   * a name is only a label, and the two are the same shape. What separates them
   * is that a defence carries a club *and* the DST position, so those are
   * rebuilt into the form the pool uses — every defence in it is "<CLUB>
   * Defense" — rather than being stripped down to nothing to match on.
   */
  if (tokens.length === 2 && !hasName(tokens)) {
    const kinds = tokens.map(classify);
    const club = kinds.find((kind) => kind?.kind === 'team');
    const unit = kinds.find((kind) => kind?.kind === 'position' && kind.value === 'DST');
    if (club?.kind === 'team' && unit) {
      return { words: [club.value, 'Defense'], position: 'DST', team: club.value };
    }
  }

  const out: Cell = { words: tokens };

  const take = (token: string): void => {
    const kind = classify(token);
    if (kind?.kind === 'position') out.position ??= kind.value;
    if (kind?.kind === 'team') out.team ??= kind.value;
  };

  if (!hasName(tokens)) {
    // A cell that is only labels — "WR", "CIN", "$54" — belongs to the name
    // beside it rather than being one.
    tokens.forEach(take);
    out.words = [];
    return out;
  }

  const words = [...tokens];
  while (words.length > 1 && classify(words[words.length - 1]) && hasName(words.slice(0, -1))) {
    take(words.pop()!);
  }
  // A leading label — "RB Bijan Robinson", "1. TE Brock Bowers" — is the same
  // fact on the other side of the name.
  while (words.length > 1 && classify(words[0]) && hasName(words.slice(1))) {
    take(words.shift()!);
  }

  out.words = words;
  return out;
};

/**
 * Rejoin a surname-first export: "Robinson, Bijan" is one player, not two.
 *
 * A spreadsheet exported "Last, First" is split by the comma exactly like a
 * Slack run of names, and every row then arrives as two unmatchable fragments —
 * a 60-line sheet becomes 120 unmatched rows and an empty auction. The shape is
 * distinguishable: exactly two cells, each a single word, neither of them a
 * label. A run of full names never looks like that, because each cell carries
 * at least a forename and a surname.
 */
const joinSurnameFirst = (cells: string[]): string[] => {
  if (cells.length !== 2) return cells;
  const [last, first] = cells;
  const single = (cell: string) => cell.split(/\s+/).filter(Boolean).length === 1;
  if (!single(last) || !single(first)) return cells;
  if (classify(last) || classify(first)) return cells;
  return [`${first} ${last}`];
};

/** "1. ", "12) ", "- ", "• " — the shapes a list arrives numbered in. */
const stripBullet = (line: string): string =>
  line.replace(/^\s*(?:[-–—*•·▪]+\s*|\d{1,3}[.):]\s*|\d{1,3}\s+)(?=\S)/, '').trim();

const looksLikeHeader = (cells: string[]): boolean =>
  cells.length > 0 &&
  cells.every((cell) =>
    cell
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => HEADER_WORDS.has(word.toLowerCase().replace(/[.:]+$/, '')))
  );

/**
 * Whether a line is a section title rather than a player.
 *
 * Every word has to be a heading word, exactly as `looksLikeHeader` requires it.
 * Asking whether *some* word is one was the trap: a commissioner writes
 * "Ja'Marr Chase — Tier 1", "Bijan Robinson (top 5)", "Jahmyr Gibbs - draft day
 * board", and each carries a heading word beside a real name. Under `some` the
 * whole line was deleted and reported as a count, which silently takes the most
 * expensive player in the auction off the sheet.
 *
 * The two failures are not symmetrical, which is what settles the rule. A title
 * mistaken for a player comes back as an unmatched row with its text on screen,
 * and the operator ignores it. A player mistaken for a title is gone, and there
 * is nothing on screen to notice.
 */
const looksLikeHeading = (cells: string[]): boolean => {
  if (cells.length !== 1) return false;
  const words = cells[0]
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/[^a-z]/gi, ''))
    .filter(Boolean);
  return words.length > 0 && words.every((word) => HEADING_WORDS.has(word));
};

/**
 * Split a pasted blob into rows.
 *
 * Five shapes, all of them real: one name a line; a numbered list; bullets; a
 * column pasted out of a spreadsheet, which arrives tab-separated; and a run of
 * names separated by commas on one line, which is what a Slack message looks
 * like. The last is the only one that can put several players on a line, so a
 * line is only split into several rows when more than one of its cells actually
 * carries a name — "Ja'Marr Chase, WR, CIN" is one player, not three.
 */
export const parseAuctionSheet = (
  text: string
): {
  rows: SheetRow[];
  duplicates: ParsedSheet['duplicates'];
  skipped: ParsedSheet['skipped'];
} => {
  const rows: SheetRow[] = [];
  let nextId = 0;
  const duplicates: ParsedSheet['duplicates'] = [];
  const skipped: ParsedSheet['skipped'] = [];
  const seen = new Set<string>();

  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, index) => {
      const line = stripBullet(raw);
      if (!line) return;

      const cells = (line.includes('\t') ? line.split('\t') : splitCsvLine(line))
        .map((cell) => cell.trim())
        .filter(Boolean);

      if (!cells.length) return;
      if (looksLikeHeader(cells)) {
        skipped.push({ line: index + 1, text: line, reason: 'column headings, not a player' });
        return;
      }
      if (looksLikeHeading(cells)) {
        skipped.push({ line: index + 1, text: line, reason: 'a title, not a player' });
        return;
      }

      const read = joinSurnameFirst(cells).map(readCell);
      if (!read.some((cell) => cell.words.length)) {
        skipped.push({
          line: index + 1,
          text: line,
          reason: 'nothing on this line reads as a name',
        });
        return;
      }

      // Labels attach to the name they follow, which is what makes
      // "Chase, WR, CIN, Gibbs, RB, DET" two players rather than six.
      let current: SheetRow | null = null;
      const flush = () => {
        if (!current) return;
        const key = normaliseName(current.name);
        if (key && seen.has(key)) duplicates.push({ line: current.line, name: current.name });
        else {
          if (key) seen.add(key);
          rows.push(current);
        }
        current = null;
      };

      for (const cell of read) {
        if (cell.words.length) {
          flush();
          current = {
            id: nextId++,
            line: index + 1,
            name: cell.words.join(' '),
            position: cell.position,
            team: cell.team,
          };
        } else if (current) {
          current.position ??= cell.position;
          current.team ??= cell.team;
        }
      }
      flush();
    });

  return { rows, duplicates, skipped };
};

/**
 * Bind rows to players, refusing to guess.
 *
 * `resolveRankings` does the matching, unchanged: two passes over looser name
 * forms, a stated position used as a filter rather than a tie-break, and a name
 * that fits two players bound to neither.
 *
 * The one thing added here is the club, and only where the name has already
 * failed. "B. Robinson" is Bijan ($54) or Brian (a bench back) and both are
 * backs, so position cannot separate them and the row comes back ambiguous;
 * "B. Robinson RB ATL" carries a fact that leaves exactly one of them, and
 * narrowing an ambiguity by a stated fact is the same rule position already
 * follows. It can only ever shrink the candidates a match was refused over — it
 * never turns an unmatched name into a match, because a club is not a name.
 */
export const resolveAuctionSheet = (
  rows: readonly SheetRow[],
  roster: readonly Candidate[]
): { resolutions: Array<Resolution<SheetRow>>; duplicates: ParsedSheet['duplicates'] } => {
  const resolutions: Array<Resolution<SheetRow>> = [];
  const duplicates: ParsedSheet['duplicates'] = [];
  const claimed = new Set<string>();

  resolveRankings([...rows], roster).forEach((resolution, index) => {
    const row = rows[index];
    let settled = resolution;

    if (settled.status === 'ambiguous' && row.team) {
      const narrowed = settled.options.filter((option) => option.team === row.team);
      if (narrowed.length === 1)
        settled = { status: 'matched', row: settled.row, player: narrowed[0] };
      else if (narrowed.length > 1) settled = { ...settled, options: narrowed };
    }

    if (settled.status === 'matched') {
      if (claimed.has(settled.player.id)) {
        duplicates.push({ line: row.line, name: row.name });
        return;
      }
      claimed.add(settled.player.id);
    }
    resolutions.push(settled);
  });

  return { resolutions, duplicates };
};

/** Read a pasted sheet end to end. */
export const readAuctionSheet = (text: string, roster: readonly Candidate[]): ParsedSheet => {
  const { rows, duplicates, skipped } = parseAuctionSheet(text);
  const resolved = resolveAuctionSheet(rows, roster);
  return {
    resolutions: resolved.resolutions,
    duplicates: [...duplicates, ...resolved.duplicates],
    skipped,
  };
};

/**
 * The player ids a sheet names, in sheet order.
 *
 * `bindings` is how a person answers an ambiguity by hand, keyed by the line it
 * was on: the parser will not choose between two Robinsons, but the one holding
 * the sheet knows which one is on it.
 */
export const sheetPlayerIds = (
  resolutions: ReadonlyArray<Resolution<SheetRow>>,
  /** Hand-made choices for ambiguous rows, keyed by `SheetRow.id`, not by line. */
  bindings: Readonly<Record<number, string>> = {}
): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const resolution of resolutions) {
    const id = resolution.status === 'matched' ? resolution.player.id : bindings[resolution.row.id];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

/** What the paste box shows when it is empty: the shapes that all work. */
export const AUCTION_SHEET_EXAMPLE = [
  '1. Ja’Marr Chase WR CIN',
  '2. Bijan Robinson (ATL) BYE 8',
  'Jahmyr Gibbs, Malik Nabers, Brock Bowers',
  'Puka Nacua\tWR\tLAR',
].join('\n');

/**
 * What a paste lost, and how alarmed to be about it.
 *
 * The panel already names every failure, and the price check already refuses a
 * list too concentrated to bid on. Between them sits the failure this exists
 * for: a paste that loses a chunk out of the *middle* of a sheet. Sixty names
 * become forty, the top twenty still price perfectly sensibly, every check
 * passes — and `auctionSheetSize` is now forty, so the whole board has been
 * re-priced for an auction the room is not holding.
 *
 * A count cannot carry that. Twelve lost out of four hundred is a commissioner
 * listing some defences by nickname; twelve lost out of thirty is a broken
 * paste, and the two need to read differently at a glance. So this reports the
 * share and bands it, and hands back the actual text of every row that fell
 * out — because the only useful thing to do with a broken paste is fix it, and
 * fixing it means knowing which lines to look at.
 */
export interface SheetLoss {
  /** Rows that named nobody: ambiguous, unmatched, duplicated or skipped. */
  lost: number;
  /** Every row the paste produced, kept or not. */
  of: number;
  /** `lost / of`, or zero when there was nothing to lose. */
  share: number;
  /**
   * `some` below one row in eight, `much` at or above it.
   *
   * Banded rather than one alarm because a warning that shouts at the first
   * lost defence means nothing by the fortieth — the same reasoning the export
   * counter's colours already live by. One in eight is where it stops being
   * housekeeping: eight names off a sixty-name sheet are eight players the
   * room will now snake rather than buy, and `auctionSheetSize` drops with
   * them, which re-prices every player on the board.
   */
  severity: 'none' | 'some' | 'much';
  /** The raw text of each lost row, `line: text`, ready to be copied out. */
  lines: string[];
}

export const sheetLoss = (
  parsed: ParsedSheet,
  /** Ambiguous rows the operator has since bound by hand, keyed by `SheetRow.id`. */
  bindings: Record<number, string> = {}
): SheetLoss => {
  const lines: string[] = [];
  for (const resolution of parsed.resolutions) {
    if (resolution.status === 'matched') continue;
    // An ambiguity somebody has answered is not a loss; it is the mechanism
    // working. Only one still sitting unanswered costs a name.
    if (resolution.status === 'ambiguous' && bindings[resolution.row.id]) continue;
    const why = resolution.status === 'ambiguous' ? 'fits more than one player' : 'not in the pool';
    lines.push(`${resolution.row.line}: ${resolution.row.name} — ${why}`);
  }
  for (const duplicate of parsed.duplicates) {
    lines.push(`${duplicate.line}: ${duplicate.name} — already on the sheet`);
  }
  for (const skipped of parsed.skipped) {
    lines.push(`${skipped.line}: ${skipped.text} — ${skipped.reason}`);
  }

  const of = parsed.resolutions.length + parsed.duplicates.length + parsed.skipped.length;
  const lost = lines.length;
  const share = of ? lost / of : 0;
  return {
    lost,
    of,
    share,
    severity: lost === 0 ? 'none' : share >= 1 / 8 ? 'much' : 'some',
    lines,
  };
};
