/**
 * Micro-instruments: small enough to sit inside a card, shaped by what they
 * measure.
 *
 * These started as bars and then as dials, and both were wrong the same way: a
 * bar and a dial are *containers*. Any number goes in one. Nothing about the
 * glyph says what kind of thing you are looking at, so the reader takes that
 * from the label and the instrument contributes only a magnitude — a magnitude
 * already printed as a numeral an inch to the left.
 *
 * An instrument earns its space by being the shape of its own data:
 *
 *   A season is seventeen discrete Sundays, not a continuous line. Drawn as a
 *   line it asserts that something happened between week four and week five,
 *   and it hides the weeks he was not there at all.
 *
 *   A projection is a distribution, so draw a distribution — with the part that
 *   loses to a free player visibly the part that loses.
 *
 *   A role is two shares at once, and "is he the guy" is a question about the
 *   pair, which two separate readings cannot answer.
 *
 * Every glyph carries its own reference mark, because a reading you cannot
 * compare to anything is not a reading. Wherever it can, that reference is the
 * one the whole app is built on: the man the snake hands you for nothing.
 *
 * Hand-drawn SVG with no library, for the reason the rest of `charts/` is: the
 * published artifact's CSP blocks every external host, and a chart nobody can
 * render on the night is worse than a number.
 */

const INK = 'var(--dr-ink)';
const FAINT = 'var(--dr-line-strong)';
const TRACK = 'var(--dr-raised)';
const GOOD = 'var(--dr-good)';
const WARN = 'var(--dr-warn)';

/** A full season, which is the frame every game log is drawn in. */
const SEASON_GAMES = 17;

interface GameLogProps {
  /** Points in each game he played, in order. Games missed are not in here. */
  weeks: number[];
  /** Points per game the freely available player at his position scores. */
  replacement: number;
  /** Full height: a strong week at this position, so cards compare. */
  strongWeek: number;
  label: string;
  width?: number;
  height?: number;
}

/**
 * A season as seventeen Sundays, against the man you get for nothing.
 *
 * This replaced a sparkline, and the sparkline was wrong three ways. It drew a
 * line between games, which asserts something happened in between and makes a
 * nine-game season and a seventeen-game season the same width — so the most
 * important fact about an injured player was invisible. It scaled to his own
 * best week, so every card's squiggle filled its box and no two could be
 * compared. And it drew a mean, which is the one summary the card already
 * prints elsewhere.
 *
 * What a drafter asks of a season is not "what shape was the line" but **how
 * many weeks did he win me, and how many did he cost me?** So: one column per
 * game, seventeen slots whether or not he filled them, and a rule across the
 * strip at what a free player at his position scores per game. Columns above
 * the rule are weeks he beat the alternative; columns below it are weeks
 * somebody off the waiver wire would have done as well. The empty sockets are
 * the weeks he was not available.
 *
 * The scale comes from the *position* rather than from the player, and that is
 * the decision that makes this an instrument rather than a picture: two strips
 * in the same column are drawn in the same frame, so they can be read against
 * each other. Scaling to his own best week — which a sparkline does by
 * construction — fills every box on the board and compares nothing.
 *
 * Full height is a strong week at his position, not the biggest week anybody
 * ever had; a monster game pins at the top and reads as off the scale, which is
 * true and is what you want to know. Anchoring it on replacement was tried and
 * was wrong the other way: a replacement running back scores about five points
 * a game and a starter scores fifteen, so at two and a half times replacement
 * every column on every card pinned and the strip said nothing at all.
 */
export const GameLog = ({
  weeks,
  replacement,
  strongWeek,
  label,
  width = 232,
  height = 30,
}: GameLogProps) => {
  if (!weeks.length) return null;

  const bar = 3;
  const slot = width / SEASON_GAMES;
  const scale = Math.max(strongWeek, replacement * 1.5, 1);
  const base = height - 1;
  const rule = base - (replacement / scale) * (height - 2);
  const at = (points: number) =>
    Math.min(height - 2, Math.max(0.5, (points / scale) * (height - 2)));

  return (
    <svg
      className="dr-micro dr-micro-gamelog"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {/* What a free player scores. Everything under this line is a week he was
          not worth what you paid for him. */}
      <line
        x1={0}
        x2={width}
        y1={rule}
        y2={rule}
        stroke={WARN}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.5}
      />
      {Array.from({ length: SEASON_GAMES }, (_, index) => {
        const x = index * slot + (slot - bar) / 2;
        const points = weeks[index];
        if (points == null) {
          // A week he was not there. An empty socket at the baseline, because
          // "no game" and "a bad game" are different facts and a line could not
          // tell them apart.
          return (
            <rect
              key={index}
              x={x}
              y={base - 1.5}
              width={bar}
              height={1.5}
              rx={0.75}
              fill={FAINT}
              opacity={0.5}
            />
          );
        }
        const tall = at(points);
        const beat = points >= replacement;
        return (
          <rect
            key={index}
            x={x}
            y={base - tall}
            width={bar}
            height={tall}
            rx={1}
            fill={beat ? GOOD : FAINT}
            opacity={beat ? 0.9 : 0.75}
          />
        );
      })}
    </svg>
  );
};

interface OutcomeProps {
  floor: number;
  projection: number;
  ceiling: number;
  /** What a freely available player at the position scores over a season. */
  replacement?: number | null;
  label: string;
  width?: number;
  height?: number;
}

/**
 * The season he might have, drawn as the distribution it is.
 *
 * Floor and ceiling are one standard deviation of the season total either side
 * of the projection, so the honest picture is a bell, not a bar. A bar says
 * "somewhere in here" with every point equally likely; a curve says what is
 * actually being claimed, which is that the middle is far likelier than the
 * ends.
 *
 * The mass to the left of replacement level is shaded as a loss, because that
 * region *is* the risk: it is how much of his range finishes below a player you
 * could have had for nothing. A receiver with a huge ceiling and a third of his
 * mass under the free man is a different bid from one with the same projection
 * and none of it, and "floor 253" never said so.
 */
export const Outcome = ({
  floor,
  projection,
  ceiling,
  replacement,
  label,
  width = 104,
  height = 22,
}: OutcomeProps) => {
  const sigma = Math.max((ceiling - floor) / 2, 1);
  /*
   * The domain is the curve's own, and deliberately does not stretch to include
   * replacement level. Including it squashed the bell into the right-hand third
   * of the box for every good player on the board — a replacement running back
   * scores seventy points a season and a starting one is projected two hundred
   * and eighty, so most of the width was empty axis. Where replacement falls
   * off the left there is simply no amber, which is the correct reading: none
   * of his range loses to a free player.
   */
  const min = Math.max(0, floor - sigma * 0.9);
  const max = ceiling + sigma * 0.9;
  const span = max - min || 1;
  const at = (value: number) => ((value - min) / span) * width;
  const base = height - 1;

  // Sampled rather than solved: forty points is smooth at this size and costs
  // nothing beside resolving a normal by hand.
  const steps = 40;
  const bell = (value: number) => Math.exp(-0.5 * ((value - projection) / sigma) ** 2);
  const curve = Array.from({ length: steps + 1 }, (_, index) => {
    const value = min + (span * index) / steps;
    return `${at(value).toFixed(1)},${(base - bell(value) * (height - 3)).toFixed(1)}`;
  }).join(' ');
  const area = `0,${base} ${curve} ${width},${base}`;
  const clip = `dr-loss-${Math.round(projection)}-${Math.round(floor)}-${Math.round(ceiling)}`;
  const cut = replacement != null && replacement > min ? at(Math.min(replacement, max)) : null;

  return (
    <svg
      className="dr-micro dr-micro-outcome"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={Math.max(0, cut ?? 0)} height={height} />
        </clipPath>
      </defs>
      <polygon points={area} fill={GOOD} opacity={0.22} />
      {cut != null && cut > 0 && (
        <polygon points={area} fill={WARN} opacity={0.5} clipPath={`url(#${clip})`} />
      )}
      <polyline points={curve} fill="none" stroke={GOOD} strokeWidth={1} opacity={0.7} />
      {cut != null && (
        <line x1={cut} x2={cut} y1={1} y2={base} stroke={WARN} strokeWidth={1} opacity={0.9} />
      )}
      <line
        x1={at(projection)}
        x2={at(projection)}
        y1={base - (height - 3)}
        y2={base}
        stroke={INK}
        strokeWidth={1.25}
        opacity={0.85}
      />
    </svg>
  );
};

interface RoleFieldProps {
  /** Share of the offence's snaps he is on the field for. */
  snap: number;
  snapMedian: number;
  snapTop: number;
  /** Share of the touches or targets he takes. */
  share: number;
  shareMedian: number;
  shareTop: number;
  /** Red-zone touches, which set the size of the mark. */
  redZone: number;
  redZoneTop: number;
  label: string;
  size?: number;
}

/**
 * Where he sits in the two questions that decide a role, at once.
 *
 * Three dials in a row could not answer the question the three numbers exist to
 * answer. "Is he the guy?" is not about how big any one of snap share, touch
 * share or red-zone work is — it is about the combination, and a reader
 * comparing three needles across two cards is doing a join in their head with
 * money on the table.
 *
 * One field, two axes, and the crosshair is the median player at his position.
 * The answer becomes a location rather than three magnitudes:
 *
 *   top right — on the field and taking the work. The bell cow.
 *   top left — takes the work in limited snaps. A specialist or a closer.
 *   bottom right — out there and not being fed. A blocker or a decoy.
 *   bottom left — a backup.
 *
 * Red-zone work is the size of the mark rather than a third axis, because it is
 * a premium on the other two rather than an independent question: touches near
 * the goal line are the same touches, worth more.
 *
 * Every card draws the same field with the same crosshair for a position, so
 * the dot's position is comparable straight down a column — which is the whole
 * argument for small multiples, and the thing three self-scaled dials could
 * never do.
 */
export const RoleField = ({
  snap,
  snapMedian,
  snapTop,
  share,
  shareMedian,
  shareTop,
  redZone,
  redZoneTop,
  label,
  size = 54,
}: RoleFieldProps) => {
  const pad = 4;
  const inner = size - pad * 2;
  const across = (value: number, top: number) =>
    pad + Math.max(0, Math.min(1, value / (top || 1))) * inner;
  const up = (value: number, top: number) =>
    size - pad - Math.max(0, Math.min(1, value / (top || 1))) * inner;

  const cx = across(snap, snapTop);
  const cy = up(share, shareTop);
  const mx = across(snapMedian, snapTop);
  const my = up(shareMedian, shareTop);
  // Two to five pixels: enough range to read, never enough to swamp the field.
  const r = 2 + Math.max(0, Math.min(1, redZone / (redZoneTop || 1))) * 3;
  // The quadrant sets the tone, which states the reading a second way for
  // anybody scanning a column rather than studying one card.
  const strong = cx >= mx && cy <= my;

  return (
    <svg
      className="dr-micro dr-micro-role"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
    >
      <rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size - 1}
        rx={3}
        fill={TRACK}
        stroke={FAINT}
        strokeWidth={0.5}
        opacity={0.9}
      />
      {/* The median player at his position, in both dimensions. */}
      <line
        x1={mx}
        x2={mx}
        y1={pad}
        y2={size - pad}
        stroke={INK}
        strokeWidth={0.75}
        opacity={0.3}
      />
      <line
        x1={pad}
        x2={size - pad}
        y1={my}
        y2={my}
        stroke={INK}
        strokeWidth={0.75}
        opacity={0.3}
      />
      <circle cx={cx} cy={cy} r={r + 1.8} fill={strong ? GOOD : WARN} opacity={0.18} />
      <circle cx={cx} cy={cy} r={r} fill={strong ? GOOD : WARN} opacity={0.95} />
    </svg>
  );
};

interface SeasonsProps {
  /** Most recent last, as the pool stores them. */
  seasons: ReadonlyArray<{ season: number; missed: number }>;
  label: string;
  width?: number;
  height?: number;
}

/**
 * Availability, season by season, as a column apiece.
 *
 * "6 games missed" is a total, and a total hides the only thing that matters
 * about it: whether it was one bad year or a pattern. A player with one red
 * column and two full ones is a different bet from one with three amber
 * columns, and the sum is identical.
 */
export const Seasons = ({ seasons, label, width = 26, height = 14 }: SeasonsProps) => {
  if (!seasons.length) return null;
  const shown = seasons.slice(-3);
  const gap = 2;
  const barWidth = (width - gap * (shown.length - 1)) / shown.length;

  return (
    <svg
      className="dr-micro dr-micro-seasons"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {shown.map((entry, index) => {
        const missed = Math.max(0, Math.min(SEASON_GAMES, entry.missed));
        const played = (SEASON_GAMES - missed) / SEASON_GAMES;
        const x = index * (barWidth + gap);
        const tone = missed >= 6 ? 'var(--dr-bad)' : missed >= 3 ? WARN : GOOD;
        return (
          <g key={entry.season}>
            <rect x={x} y={0} width={barWidth} height={height} rx={1} fill={TRACK} />
            <rect
              x={x}
              y={height * (1 - played)}
              width={barWidth}
              height={height * played}
              rx={1}
              fill={tone}
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
};
