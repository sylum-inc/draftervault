import { memo } from 'react';

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
 *
 * The four that describe a *player* are memoised; the four that describe the
 * *draft* are not, and the split is deliberate. A pick moves what every team
 * can pay, so the live half of every card on the board is genuinely stale the
 * moment anybody buys anybody — but a player's season, range and role are not,
 * and reconciling sixty of each on every sale cost three hundred milliseconds
 * for a picture that had not changed. Their props are numbers, strings and two
 * arrays that come from module caches, so the bail-out is exact.
 */

/*
 * The palette every instrument here draws in, exported because the profile's
 * larger instruments draw in the same one. Two copies of five colour tokens is
 * two answers to "what does a reference mark look like", and the divergence
 * would show up as one chart's median notch being a different grey from
 * another's directly beneath it.
 */
export const INK = 'var(--dr-ink)';
export const FAINT = 'var(--dr-line-strong)';
export const TRACK = 'var(--dr-raised)';
/* What an instrument fills "above the bar" with. Not the verdict green: twelve
   elements on one card in that green left the price and the gain — the two
   things a bid is decided on — with nothing to stand out against. */
export const GOOD = 'var(--dr-mark)';
/* The verdict green itself, for the one mark on an instrument that is *him*. */
export const HOT = 'var(--dr-good)';
export const WARN = 'var(--dr-warn)';

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
const GameLogView = ({
  weeks,
  replacement,
  strongWeek,
  label,
  width = 232,
  height = 30,
}: GameLogProps) => {
  if (!weeks.length) return null;

  const slot = width / SEASON_GAMES;
  // Was a fixed three pixels, which is right at the card's 232 and wrong at the
  // profile's 480: the columns stayed hairlines while the gaps doubled, and
  // seventeen Sundays read as a comb rather than as a season. Proportional to
  // the slot, with a floor so a narrow strip still has columns.
  const bar = Math.max(3, Math.min(slot * 0.55, 14));
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
const OutcomeView = ({
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
  /**
   * Name the four corners.
   *
   * Off on a card, where the field is 54px and four labels would be four
   * illegible smudges over the reading — the caption carries them there. On at
   * profile size, where the field is twice as wide and the tab's own heading is
   * the question the corners answer.
   */
  quadrants?: boolean;
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
const RoleFieldView = ({
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
  quadrants = false,
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
      {quadrants && (
        <g className="dr-role-corners" fill={INK} opacity={0.4}>
          <text x={pad + 1} y={pad + 7}>
            specialist
          </text>
          <text x={size - pad - 1} y={pad + 7} textAnchor="end">
            bell cow
          </text>
          <text x={pad + 1} y={size - pad - 2}>
            backup
          </text>
          <text x={size - pad - 1} y={size - pad - 2} textAnchor="end">
            decoy
          </text>
        </g>
      )}
      <circle cx={cx} cy={cy} r={r + 1.8} fill={strong ? GOOD : WARN} opacity={0.18} />
      <circle cx={cx} cy={cy} r={r} fill={strong ? GOOD : WARN} opacity={0.95} />
    </svg>
  );
};

/* ==========================================================================
   The live half.

   Everything above is a fact about the player and reads the same at pick one
   and at pick a hundred and fifty. These four move as the room drafts, and
   between them they are the reason an auction is played rather than
   calculated: what is left, how fast it is going, whether you still need one,
   and who can still take him off you.
   ========================================================================== */

interface ShelfProps {
  /** Projected points of the best undrafted men here, best first. */
  shelf: readonly number[];
  /** Where in that list he is, or -1 when he is already gone. */
  mine: number;
  /** Replacement level, drawn as the line worth clearing. */
  replacement: number;
  label: string;
  width?: number;
  height?: number;
}

/**
 * What is left at his position, and what the fall is after him.
 *
 * The question an auction actually turns on is not what a player is worth, it
 * is *what happens if I do not buy him* — and the answer is standing right
 * next to him on the shelf. One column per undrafted man at his position, best
 * first, with him lit and a rule at replacement level. The step down from his
 * column to the next one is the thing you are paying for, and it is the only
 * number here nobody at the table is computing.
 *
 * It empties. Columns vanish as the room drafts, so a position going hollow is
 * something you watch happen rather than something you are told about after
 * the fact. Supply counts both halves of a hybrid draft: a receiver taken in
 * the snake is exactly as unavailable as one bought for forty dollars, and
 * waiting for him is exactly as impossible.
 *
 * **The baseline is replacement level, not zero**, and that is what makes the
 * cliff visible. Drawn from zero, the sixteen best backs left are two hundred
 * and seventy points down to a hundred and ninety and the shelf is sixteen
 * near-identical columns — a picture of a position rather than a reading of
 * one. Drawn from replacement the columns are *surplus*, which is the only
 * part anybody is bidding on, and a two-man position with a chasm behind them
 * looks like a two-man position with a chasm behind them.
 */
const ShelfView = ({ shelf, mine, replacement, label, width = 150, height = 22 }: ShelfProps) => {
  if (!shelf.length) return null;
  const surplus = (points: number) => Math.max(0, points - replacement);
  const scale = Math.max(surplus(shelf[0]), 1);
  const slot = width / Math.max(shelf.length, 8);
  const bar = Math.max(2, Math.min(6, slot - 1.6));
  const base = height - 1;

  return (
    <svg
      className="dr-micro dr-micro-shelf"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {/* Replacement level is the floor of the picture, so it needs no line:
          a column of no height is a player worth nothing over a free one. */}
      <line x1={0} x2={width} y1={base} y2={base} stroke={FAINT} strokeWidth={0.75} opacity={0.5} />
      {shelf.map((points, index) => {
        const tall = Math.max(1, (surplus(points) / scale) * (height - 2));
        const above = points > replacement;
        const isHim = index === mine;
        return (
          <rect
            key={index}
            x={index * slot + (slot - bar) / 2}
            y={base - tall}
            width={bar}
            height={tall}
            rx={1}
            fill={isHim ? INK : above ? GOOD : FAINT}
            opacity={isHim ? 1 : above ? 0.55 : 0.4}
          />
        );
      })}
    </svg>
  );
};

interface RunTapeProps {
  /** How many of the window's picks were at this position. */
  gone: number;
  /** How many picks the window holds — ten once the draft is running. */
  window: number;
  label: string;
  cells?: number;
  width?: number;
  height?: number;
}

/**
 * How fast his position is going, as a tape of the last ten picks.
 *
 * A run is the one thing in an auction that is genuinely urgent, and it is
 * invisible in any static number: four backs off the board in ten picks means
 * the room has decided backs are scarce, and the price of the next one has
 * already moved whatever the board says. Ten cells, lit for the picks that were
 * this position.
 *
 * Deliberately not a percentage. "Forty per cent" is a rate and invites the
 * question over what; ten cells with four lit is a count of things that
 * happened, which is what it is.
 */
const RunTapeView = ({
  gone,
  window,
  label,
  cells = 10,
  width = 150,
  height = 5,
}: RunTapeProps) => {
  const slot = width / cells;
  const bar = Math.max(2, slot - 2.5);
  // Loud once a third of the room's recent business has been at this position;
  // below that it is noise, and a tape that shouts at one pick means nothing at
  // four — the same banding the export counter already lives by.
  const hot = window > 0 && gone / window >= 0.3;

  return (
    <svg
      className="dr-micro dr-micro-runtape"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {Array.from({ length: cells }, (_, index) => (
        <rect
          key={index}
          x={index * slot + (slot - bar) / 2}
          y={0}
          width={bar}
          height={height}
          rx={1}
          fill={index < gone ? (hot ? WARN : GOOD) : TRACK}
          opacity={index < gone ? 0.9 : 0.7}
        />
      ))}
    </svg>
  );
};

interface SlotFitProps {
  /** Starting slots the league fields at his position. */
  total: number;
  /** How many of them you have already filled. */
  filled: number;
  /** Whether a flex seat is still open to this position. */
  flexOpen: boolean;
  label: string;
  size?: number;
}

/**
 * Whether you still need one, drawn as the seats themselves.
 *
 * The most expensive mistake available in this format is buying a third
 * running back at starter money, and the board will happily quote a big number
 * for him because the number is about the player. This is about the player
 * *and your roster*: one pip per starting seat at his position, filled for the
 * ones you have bought, and the seat he would take outlined. When they are all
 * full the flex pip is the seat, and when that is gone too there is no seat and
 * the row says so.
 *
 * A count in words — "2 of 2 filled" — needs reading. Seats are countable at a
 * glance, and the outlined one is the answer to the only question being asked.
 */
const SlotFitView = ({ total, filled, flexOpen, label, size = 9 }: SlotFitProps) => {
  const seats = Math.max(0, total);
  const takes = filled < seats ? filled : flexOpen ? seats : -1;
  const gap = 4;
  const count = seats + (seats > 0 || flexOpen ? 1 : 0);
  const width = count * size + (count - 1) * gap;

  return (
    <svg
      className="dr-micro dr-micro-slotfit"
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: seats }, (_, index) => {
        const taken = index < filled;
        const next = index === takes;
        return (
          <circle
            key={index}
            cx={index * (size + gap) + size / 2}
            cy={size / 2}
            r={size / 2 - 1}
            fill={taken ? GOOD : 'none'}
            stroke={next ? GOOD : taken ? GOOD : FAINT}
            strokeWidth={next ? 1.75 : 1}
            opacity={taken ? 0.85 : 1}
          />
        );
      })}
      {/* The flex, drawn as a different shape because it is a different kind of
          seat: any of three positions may sit in it, so it is a slot he
          competes for rather than one he owns. */}
      {(seats > 0 || flexOpen) && (
        <rect
          x={seats * (size + gap) + 1}
          y={1}
          width={size - 2}
          height={size - 2}
          rx={1.5}
          transform={`rotate(45 ${seats * (size + gap) + size / 2} ${size / 2})`}
          fill="none"
          stroke={takes === seats ? WARN : FAINT}
          strokeWidth={takes === seats ? 1.75 : 1}
          opacity={flexOpen ? 1 : 0.35}
        />
      )}
    </svg>
  );
};

interface MoneyBiteProps {
  /** What the board says he costs. */
  price: number;
  /** The most you may legally bid, from the engine's own ceiling. */
  mine: number;
  /** What every opponent with room here could go to, highest first. */
  rivals: readonly number[];
  label: string;
  width?: number;
  height?: number;
}

/**
 * What he costs against what you have, and who can still go past it.
 *
 * Two facts that are only meaningful together. A forty-dollar player is cheap
 * with ninety in your pocket and unbuyable with thirty, and neither of those is
 * on a card that prints a price. And the ceilings above the track are the
 * answer to the question that actually loses players: **how many of them can
 * still beat me.** In this format that number is higher than the room expects,
 * because there is no reserve to hold money back — believing an opponent is
 * tapped out when they are not is how a board loses the players it wanted.
 *
 * The scale is dollars throughout, so the price, your ceiling and theirs are
 * all the same axis and can be read off against each other without arithmetic.
 * The price is the list price rather than tonight's inflated one, deliberately:
 * the adjusted figure moves on every pick, and putting it here would re-render
 * every card on the board for a number the nomination stage already carries at
 * the moment it decides anything.
 */
const MoneyBiteView = ({
  price,
  mine,
  rivals,
  label,
  width = 150,
  height = 12,
}: MoneyBiteProps) => {
  const scale = Math.max(mine, rivals[0] ?? 0, price, 1);
  const at = (value: number) => (value / scale) * width;
  const trackY = height - 5;
  const beat = rivals.filter((ceiling) => ceiling > price).length;

  return (
    <svg
      className="dr-micro dr-micro-money"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {/* Your money, as the track. */}
      <rect x={0} y={trackY} width={at(mine)} height={4} rx={2} fill={TRACK} />
      {/* What he takes out of it. Amber once he costs more than you can pay,
          which is a different situation from expensive. */}
      <rect
        x={0}
        y={trackY}
        width={Math.min(at(price), width)}
        height={4}
        rx={2}
        fill={price > mine ? WARN : GOOD}
        opacity={0.85}
      />
      {/* Every opponent who can still outbid you, at the dollar they stop. */}
      {rivals.slice(0, 11).map((ceiling, index) => (
        <line
          key={index}
          x1={at(ceiling)}
          x2={at(ceiling)}
          y1={0}
          y2={trackY - 1.5}
          stroke={ceiling > price ? WARN : FAINT}
          strokeWidth={1}
          opacity={ceiling > price ? 0.7 : 0.35}
        />
      ))}
      {/* Where your own money runs out, drawn over the ticks so it is never
          lost among them. */}
      <line
        x1={Math.min(at(mine), width - 0.5)}
        x2={Math.min(at(mine), width - 0.5)}
        y1={0}
        y2={height}
        stroke={INK}
        strokeWidth={1.25}
        opacity={0.8}
      />
      {beat === 0 && <circle cx={at(price)} cy={trackY + 2} r={2} fill={GOOD} />}
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
const SeasonsView = ({ seasons, label, width = 26, height = 14 }: SeasonsProps) => {
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

/*
 * A player's own instruments do not change when somebody else is bought.
 *
 * `weeks` and `seasons` are the only object props here and both come from
 * caches — the history file's own arrays and the player's own durability — so
 * they are the same reference on every render and the comparison holds. The
 * label strings are rebuilt each time and compare by value, which costs a
 * string compare and saves reconciling thirty SVG nodes apiece.
 */
/**
 * Contents, not reference.
 *
 * The live readings arrive as fresh arrays on every pick, because a pulse is
 * rebuilt whenever anybody buys anybody — but a running back going takes
 * nothing off the receiver shelf, and reconciling sixteen columns that have not
 * moved, for every position, on every sale, is the whole cost of having the
 * band at all. A twelve-number comparison is cheaper than a DOM diff by a wide
 * margin, so the comparison goes here rather than the reference being
 * laundered upstream — this is the place that knows the arrays are short, flat
 * and numeric.
 */
const sameNumbers = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const Shelf = memo(
  ShelfView,
  (a, b) => a.mine === b.mine && a.replacement === b.replacement && sameNumbers(a.shelf, b.shelf)
);
export const RunTape = memo(RunTapeView);
export const SlotFit = memo(SlotFitView);
/* Money is the one that genuinely does move on every sale: what a team spends
   on a back is money it cannot spend on a receiver either. It re-renders, and
   that is the reading being correct rather than the instrument being wasteful. */
export const MoneyBite = memo(
  MoneyBiteView,
  (a, b) => a.price === b.price && a.mine === b.mine && sameNumbers(a.rivals, b.rivals)
);
export const GameLog = memo(GameLogView);
export const Outcome = memo(OutcomeView);
export const RoleField = memo(RoleFieldView);
export const Seasons = memo(SeasonsView);

/* ==========================================================================
   The second page.

   Everything above answers the two questions an auction asks out loud — what is
   he, and what is happening to his position right now. These answer the ones
   asked second and which decide as many bids: what offence feeds him, who else
   is in his room, where his career is on its own curve, how much the experts
   disagree with each other rather than with us, how far downfield the ball
   actually reaches him, and what the eighteen weeks in front of him look like.

   They live on the back of the card rather than the front for a reason of
   space rather than importance: a front face with nineteen readings on it is
   already at the limit of what can be scanned while a name is being called,
   and a twentieth would cost the nineteen. Turning the card over is a
   deliberate act — it happens between nominations, not during one — so the
   back is allowed to be dense in a way the front may not be.

   None of them is memoised, and that is not an oversight: exactly one card is
   ever turned over, so there is no board of sixty to protect. The memo
   discipline on the front exists because sixty of it mount at once.
   ========================================================================== */

interface PlayMixProps {
  /** Snaps a game, which sets the length: a fast offence is a long bar. */
  plays: number;
  playsTop: number;
  playsMedian: number;
  /** Share of neutral downs thrown, which sets the split. */
  passRate: number;
  /** How far that is from what the situations called for. */
  passRateOverExpected: number | null;
  label: string;
  width?: number;
  height?: number;
}

/**
 * How much this offence runs, and what it does with it.
 *
 * Two facts that are one question — *is there enough of the ball here, and is
 * it going the way he catches it* — drawn as one shape rather than two
 * readings. The bar's **length** is plays a game against the league's fastest;
 * the **split** inside it is pass against run. A fast pass-happy offence is a
 * long bar mostly one colour; a slow, run-heavy one is short and mostly the
 * other, and the two are told apart at a glance rather than by reading two
 * numerals and doing the join.
 *
 * The notch on the split is the rate the *situations* called for — pass rate
 * minus pass rate over expected. A proportion with no reference is a fact
 * about a scheme; a proportion beside its counterfactual is a claim about a
 * coach, and it is the second one that moves a bid: an offence throwing five
 * points more than its game scripts demand is choosing to, and will keep
 * choosing to.
 *
 * The faint rule is the median offence's length, so short and long are claims
 * about the league rather than about the pixels available.
 */
const PlayMixView = ({
  plays,
  playsTop,
  playsMedian,
  passRate,
  passRateOverExpected,
  label,
  width = 150,
  height = 18,
}: PlayMixProps) => {
  // Never shorter than a fifth: a length is a reading and a sliver is not one.
  const span = (value: number) => Math.max(0.2, Math.min(1, value / (playsTop || 1))) * width;
  const bar = span(plays);
  const median = span(playsMedian);
  const passWidth = bar * Math.max(0, Math.min(1, passRate / 100));
  const expected =
    passRateOverExpected == null
      ? null
      : bar * Math.max(0, Math.min(1, (passRate - passRateOverExpected) / 100));

  return (
    <svg
      className="dr-micro dr-micro-mix"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <rect
        x={0}
        y={2}
        width={bar}
        height={height - 6}
        rx={2}
        fill={TRACK}
        stroke={FAINT}
        strokeWidth={0.75}
      />
      <rect x={0} y={2} width={passWidth} height={height - 6} rx={2} fill="var(--dr-accent-lift)" />
      {/* The seam between throwing it and handing it off. Without it the two
          halves are one bar in two shades, which is a magnitude again. */}
      <line
        x1={passWidth}
        x2={passWidth}
        y1={2}
        y2={height - 4}
        stroke="var(--dr-surface)"
        strokeWidth={1.5}
      />
      {/* Where the situations said the split should have been. */}
      {expected != null && (
        <line
          x1={expected}
          x2={expected}
          y1={0}
          y2={height - 3}
          stroke={INK}
          strokeWidth={1.25}
          strokeDasharray="2.5 2"
          opacity={0.85}
        />
      )}
      {/* The median offence's length, so the bar's own length is a reading. */}
      <path
        d={`M${median - 2.5} ${height} L${median} ${height - 3} L${median + 2.5} ${height} Z`}
        fill={INK}
        opacity={0.5}
      />
    </svg>
  );
};

interface GoalLineProps {
  /** Times a game this offence reaches the red zone. */
  trips: number;
  tripsMedian: number;
  /** His own touches inside it, per game. */
  touches: number;
  /** Of those, the ones inside the five. */
  goalLine: number;
  label: string;
  pitch?: number;
}

/**
 * Scoring chances, and how many of them are his.
 *
 * Touchdowns are most of the difference between two backs with the same yards,
 * and they are not distributed by talent — they are distributed by how often a
 * team reaches the red zone and who the coach hands it to when they get there.
 * Both halves are in the pool and neither was anywhere on the board.
 *
 * Drawn as pips on one pitch rather than as two bars, because a red-zone trip
 * is a discrete event and a drafter counts them: *they get there four times a
 * game and he touches it twice*. The top row is the offence's chances, the
 * bottom his touches, and the comparison is length against length on the same
 * scale — which is the whole argument for small multiples and the thing two
 * separately-scaled bars could not do.
 *
 * Goal-line touches — inside the five, where a carry is worth about six points
 * a fifth of the time — are the solid pips at the head of his row rather than a
 * third number. They are the same touches, worth more.
 *
 * The faint pip on the top row is the median offence's trips, so "this team
 * gets there a lot" is a claim about the league.
 */
const GoalLineView = ({
  trips,
  tripsMedian,
  touches,
  goalLine,
  label,
  pitch = 11,
}: GoalLineProps) => {
  const SLOTS = 7;
  const width = SLOTS * pitch;
  const height = 20;
  const cell = (index: number) => index * pitch;
  const filled = (value: number) => Math.min(SLOTS, Math.round(value));
  const tripCount = filled(trips);
  const touchCount = filled(touches);
  const goalCount = Math.min(touchCount, filled(goalLine));

  // An empty chance is drawn as an outline rather than as a darker fill: on a
  // near-black ground a dark fill is not a socket, it is nothing, and a row of
  // nothing cannot be counted against the row above it.
  const pips = (count: number, y: number, fill: string) =>
    Array.from({ length: SLOTS }, (_, index) => (
      <rect
        key={`${y}:${index}`}
        x={cell(index) + 0.5}
        y={y}
        width={pitch - 2.5}
        height={7}
        rx={1.5}
        fill={index < count ? fill : 'none'}
        stroke={index < count ? 'none' : FAINT}
        strokeWidth={0.75}
        opacity={index < count ? 0.95 : 0.6}
      />
    ));

  return (
    <svg
      className="dr-micro dr-micro-goal"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {pips(tripCount, 0, INK)}
      {/* The median offence, on the row it belongs to. */}
      <line
        x1={cell(Math.min(SLOTS, Math.round(tripsMedian)))}
        x2={cell(Math.min(SLOTS, Math.round(tripsMedian)))}
        y1={-1}
        y2={8}
        stroke={WARN}
        strokeWidth={1}
        opacity={0.8}
      />
      {pips(touchCount, 11, GOOD)}
      {/* Inside the five, drawn over his own row rather than beside it. */}
      {Array.from({ length: goalCount }, (_, index) => (
        <rect
          key={`goal:${index}`}
          x={cell(index) + 2}
          y={13}
          width={pitch - 5.5}
          height={3}
          rx={1}
          fill="var(--dr-ground)"
          opacity={0.85}
        />
      ))}
    </svg>
  );
};

interface DepthLadderProps {
  /** Where he is on the depth chart, 1 being the starter. */
  depth: number;
  roomSize: number;
  /** Points a game he leads the man behind him by. */
  aheadBy: number | null;
  /** Points a game he trails the man ahead of him by. */
  behindBy: number | null;
  label: string;
  width?: number;
  height?: number;
}

/**
 * The room he has to get the ball out of, with the margin as the geometry.
 *
 * "Depth 1 of 4" is three facts printed as a fraction and it hides the one that
 * matters: a starter nine points a game clear of his backup and a starter half
 * a point clear are the same fraction and completely different bets. The second
 * one loses the job in September.
 *
 * So the rungs are drawn at a *distance* proportional to the margin. A locked
 * starter floats at the top of the ladder with clear air beneath him; a
 * timeshare's rungs almost touch, which is what a timeshare looks like. The
 * ladder is the shape of a depth chart and the spacing is the thing a number
 * could not carry.
 *
 * At most four rungs are drawn — the man ahead, him, the next man, and a stub
 * for whatever else is in the room — because past that the room is not a
 * ranking, it is a practice squad.
 */
const DepthLadderView = ({
  depth,
  roomSize,
  aheadBy,
  behindBy,
  label,
  width = 54,
  height = 52,
}: DepthLadderProps) => {
  // Eight points a game is a clear job; anything past it is the same reading.
  const GAP_FULL = 8;
  const pad = 3;
  const inner = height - pad * 2;
  const rung = 4;
  // A margin of nothing still leaves the rungs distinguishable — they are two
  // men, not one — and a margin past the ceiling stops growing.
  const gapFor = (margin: number | null) =>
    margin == null ? 0 : Math.max(0.16, Math.min(1, Math.abs(margin) / GAP_FULL));

  const above = depth > 1 ? gapFor(behindBy) : 0;
  const below = depth < roomSize ? gapFor(aheadBy) : 0;
  const rest = roomSize - depth - 1;
  // Share the inner height between the gaps that exist, so a lone starter is
  // still drawn at the top of his ladder rather than in the middle of it.
  const total = above + below + (rest > 0 ? 0.35 : 0) || 1;
  const unit = (inner - rung * (1 + (depth > 1 ? 1 : 0) + (below > 0 ? 1 : 0))) / total;

  let y = pad;
  const rows: Array<{ y: number; me: boolean; faint: boolean }> = [];
  if (depth > 1) {
    rows.push({ y, me: false, faint: false });
    y += rung + above * unit;
  }
  const mine = y;
  rows.push({ y, me: true, faint: false });
  y += rung + below * unit;
  if (below > 0) rows.push({ y, me: false, faint: false });
  if (rest > 0) rows.push({ y: y + rung + 0.35 * unit * 0.5, me: false, faint: true });

  return (
    <svg
      className="dr-micro dr-micro-depth"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {/*
        No stile. It was drawn first — a rail down the left, so the rungs would
        read as one ladder rather than as stripes — and with the air marker down
        the right the pair closed into a rectangle with a bar across the top.
        The instrument stopped being a ladder and became a box, which is the
        exact failure this whole file exists to avoid: a container, with the
        reading inside it as a magnitude. Left-aligned rungs of two widths are
        already unmistakably a ladder, and the empty space between them is the
        reading rather than a gap in a frame.
      */}
      {rows.map((row, index) => (
        <rect
          key={index}
          x={0}
          y={Math.min(row.y, height - pad - rung)}
          width={row.me ? width : width * 0.58}
          height={rung}
          rx={2}
          fill={row.me ? 'var(--dr-accent-lift)' : INK}
          opacity={row.faint ? 0.28 : row.me ? 1 : 0.5}
        />
      ))}
      {/* The air beneath him, hugging the rungs rather than framing them. */}
      {below > 0 && (
        <line
          x1={1.5}
          x2={1.5}
          y1={mine + rung + 1}
          y2={Math.min(mine + rung + below * unit, height - pad) - 1}
          stroke={GOOD}
          strokeWidth={2.5}
          opacity={0.7}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
};

interface CareerArcProps {
  /** Every season he has played, oldest first. */
  seasons: Array<{ season: number; age: number | null; pointsPerGame: number; games: number }>;
  /** What the model says he will average next year, if it says anything. */
  projected: number | null;
  projectedAge: number | null;
  label: string;
  width?: number;
  height?: number;
}

/** Thirty and over is the model's worst age group, every season. See modelTrust. */
const OLD_AGE = 30;

/**
 * Every season he has played, plotted against how old he was.
 *
 * The x-axis is **age**, not the season, and that is the whole instrument. A
 * career drawn against calendar years says "he was better in 2024", which
 * anybody can read off the table. Drawn against age it says where he is on the
 * curve every player is on — and the backtest named that curve as one of the
 * three places this board should be trusted least, over-projecting the
 * thirty-and-overs by 52 to 66 points a man in every season it was measured.
 *
 * So the region past thirty is shaded, and the projection is drawn as an open
 * ring at *next* year's age: the question a bid is really asking is whether the
 * dot the model has put out there is on the line the career has been drawing,
 * or above it. A hollow mark floating over a descending run of solid ones is
 * the model paying for old tape, which is the failure it was measured making.
 *
 * The dots are sized by games played, because a nine-game season at a high rate
 * is a different fact from a full one and the mean hides it.
 */
const CareerArcView = ({
  seasons,
  projected,
  projectedAge,
  label,
  width = 150,
  height = 54,
}: CareerArcProps) => {
  const points = seasons.filter((entry) => entry.age != null) as Array<{
    season: number;
    age: number;
    pointsPerGame: number;
    games: number;
  }>;
  if (points.length === 0) return null;

  const pad = 4;
  const ages = points.map((entry) => entry.age);
  if (projectedAge != null) ages.push(projectedAge);
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const ppgTop = Math.max(...points.map((entry) => entry.pointsPerGame), projected ?? 0, 1) * 1.12;

  // A one-season career has no span to draw across, so it is placed in the
  // middle rather than divided by zero and pinned to the left edge.
  const span = maxAge - minAge;
  const x = (age: number) =>
    span > 0 ? pad + ((age - minAge) / span) * (width - pad * 2) : width / 2;
  const y = (ppg: number) => height - pad - (Math.max(0, ppg) / ppgTop) * (height - pad * 2);

  const path = points
    .map((entry, index) => `${index ? 'L' : 'M'}${x(entry.age)} ${y(entry.pointsPerGame)}`)
    .join(' ');
  const oldFrom = span > 0 && maxAge >= OLD_AGE ? x(Math.max(minAge, OLD_AGE)) : null;

  return (
    <svg
      className="dr-micro dr-micro-career"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {/* Where the model is documented to over-pay. */}
      {oldFrom != null && oldFrom < width - pad && (
        <rect
          x={oldFrom}
          y={0}
          width={width - oldFrom}
          height={height}
          fill={WARN}
          opacity={0.09}
        />
      )}
      <line
        x1={pad}
        x2={width - pad}
        y1={height - pad}
        y2={height - pad}
        stroke={FAINT}
        strokeWidth={0.75}
        opacity={0.7}
      />
      {points.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="var(--dr-accent-lift)"
          strokeWidth={1.4}
          opacity={0.85}
        />
      )}
      {points.map((entry) => (
        <circle
          key={entry.season}
          cx={x(entry.age)}
          cy={y(entry.pointsPerGame)}
          // One and a half to three and a half pixels: a nine-game season is
          // visibly a smaller claim than a seventeen-game one.
          r={1.5 + Math.max(0, Math.min(1, entry.games / SEASON_GAMES)) * 2}
          fill="var(--dr-accent-lift)"
        />
      ))}
      {/* The projection, drawn as what it is: not a season anybody played. */}
      {projected != null && projectedAge != null && (
        <>
          {points.length > 0 && (
            <line
              x1={x(points[points.length - 1].age)}
              y1={y(points[points.length - 1].pointsPerGame)}
              x2={x(projectedAge)}
              y2={y(projected)}
              stroke={INK}
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.5}
            />
          )}
          <circle
            cx={x(projectedAge)}
            cy={y(projected)}
            r={3}
            fill="none"
            stroke={INK}
            strokeWidth={1.4}
          />
        </>
      )}
    </svg>
  );
};

interface ConsensusProps {
  /** The most optimistic expert's overall rank. Lower is better. */
  best: number;
  worst: number;
  consensus: number;
  /** Ours, on the same axis. */
  ours: number;
  label: string;
  width?: number;
  height?: number;
}

/**
 * How much the experts disagree with each other, against how much we disagree
 * with them.
 *
 * The bargain board prints a gap between our rank and the room's and calls it
 * an edge. The backtest says to read that gap the other way — a sharp
 * disagreement with consensus is a reason to doubt this board — and what it
 * cannot say from a single number is whether the room even holds an opinion.
 * Ten places clear of a panel that agrees within two is a different claim
 * entirely from ten places clear of a panel spread over sixty.
 *
 * So the whisker is the panel's own best-to-worst range, the solid tick is
 * where they land in the middle, and our rank is a caret beneath the same axis.
 * Inside the whisker means somebody at FantasyPros already holds our view.
 * Outside it means nobody does, and the three seasons say that is where this
 * board has been wrong.
 *
 * Ranks run left to right the way a draft board does: earlier is better and
 * further left.
 */
const ConsensusView = ({
  best,
  worst,
  consensus,
  ours,
  label,
  width = 150,
  height = 24,
}: ConsensusProps) => {
  const pad = 5;
  const low = Math.min(best, ours);
  const high = Math.max(worst, ours);
  // A tenth of the span either side, so a caret sitting exactly on an endpoint
  // is still drawn as a mark rather than as half of one against the edge.
  const margin = Math.max(1, (high - low) * 0.12);
  const from = low - margin;
  const to = high + margin;
  const x = (rank: number) => pad + ((rank - from) / (to - from || 1)) * (width - pad * 2);
  const mid = 9;
  const outside = ours < best || ours > worst;

  return (
    <svg
      className="dr-micro dr-micro-consensus"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <line
        x1={x(best)}
        x2={x(worst)}
        y1={mid}
        y2={mid}
        stroke={FAINT}
        strokeWidth={7}
        opacity={0.95}
      />
      <line
        x1={x(best)}
        x2={x(best)}
        y1={mid - 5}
        y2={mid + 5}
        stroke={INK}
        strokeWidth={1}
        opacity={0.6}
      />
      <line
        x1={x(worst)}
        x2={x(worst)}
        y1={mid - 5}
        y2={mid + 5}
        stroke={INK}
        strokeWidth={1}
        opacity={0.6}
      />
      <line
        x1={x(consensus)}
        x2={x(consensus)}
        y1={mid - 6}
        y2={mid + 6}
        stroke={INK}
        strokeWidth={2}
      />
      {/* Ours, as a caret under the axis rather than a second tick on it — the
          two are different claims and a reader must not have to remember which
          mark was whose. */}
      <path
        d={`M${x(ours) - 4} ${height - 1} L${x(ours)} ${mid + 4} L${x(ours) + 4} ${height - 1} Z`}
        fill={outside ? WARN : GOOD}
      />
    </svg>
  );
};

interface CatchDepthProps {
  /** Average depth of target, in yards past the line. */
  adot: number;
  /** Yards he adds after catching it. */
  yac: number;
  /** The median at his position, as the rule to clear. */
  adotMedian: number;
  /** Full deflection, in yards. */
  top: number;
  label: string;
  width?: number;
  height?: number;
}

/**
 * Where on the field the ball actually reaches him, and how far he takes it.
 *
 * Two numbers that mean nothing apart and a great deal together. Eleven yards
 * of average target depth with three after the catch is a downfield receiver
 * whose production is the quarterback's; three yards with eight after it is a
 * screen game, whose production is his own and which survives a change at
 * quarterback. Both average the same fourteen, and the pool prints both as
 * numerals in a table.
 *
 * So it is drawn on a field: the line of scrimmage at the bottom, his catch
 * point at his average depth, and the run after it continuing upfield from
 * there. It is the one instrument here whose axis is literally the thing it
 * measures — yards — which is why it reads without a legend.
 *
 * The faint rule is the median target depth at his position. Above it is a
 * downfield job; on the line is a checkdown.
 */
const CatchDepthView = ({
  adot,
  yac,
  adotMedian,
  top,
  label,
  width = 40,
  height = 52,
}: CatchDepthProps) => {
  const pad = 3;
  const scale = (yards: number) =>
    Math.max(0, Math.min(1, yards / (top || 1))) * (height - pad * 2);
  const los = height - pad;
  // Negative target depth is real — a screen is caught behind the line — and it
  // is drawn below the line of scrimmage rather than clamped to it.
  const catchY = los - scale(Math.max(adot, 0)) + (adot < 0 ? Math.min(pad, -adot * 2) : 0);
  const topY = catchY - scale(yac);
  const mid = width / 2;

  return (
    <svg
      className="dr-micro dr-micro-catch"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {/* The line of scrimmage, and the median target depth at his position. */}
      <line x1={0} x2={width} y1={los} y2={los} stroke={INK} strokeWidth={1} opacity={0.55} />
      <line
        x1={0}
        x2={width}
        y1={los - scale(adotMedian)}
        y2={los - scale(adotMedian)}
        stroke={INK}
        strokeWidth={0.75}
        strokeDasharray="2 2"
        opacity={0.3}
      />
      {/* The throw, then the run. */}
      <line x1={mid} x2={mid} y1={los} y2={catchY} stroke={FAINT} strokeWidth={2} opacity={0.9} />
      <circle cx={mid} cy={catchY} r={2.6} fill="var(--dr-accent-lift)" />
      <line
        x1={mid}
        x2={mid}
        y1={catchY}
        y2={Math.max(pad, topY)}
        stroke={GOOD}
        strokeWidth={2}
        opacity={0.8}
      />
      <path
        d={`M${mid - 2.6} ${Math.max(pad, topY) + 3} L${mid} ${Math.max(pad, topY)} L${mid + 2.6} ${Math.max(pad, topY) + 3}`}
        fill="none"
        stroke={GOOD}
        strokeWidth={1.4}
      />
    </svg>
  );
};

interface SeasonAheadProps {
  games: Array<{ week: number; opponent: string; home: boolean; difficulty: number | null }>;
  byeWeek: number | null;
  label: string;
  /** The weeks a fantasy season is decided in. */
  playoffWeeks?: number[];
  pitch?: number;
  height?: number;
}

const LAST_WEEK = 18;

/**
 * The eighteen weeks in front of him, with the three that decide the season
 * marked as the three that decide the season.
 *
 * A strength-of-schedule number out of ten is an average, and an average over a
 * season is exactly the wrong summary: a receiver with three of the league's
 * softest defences in weeks fifteen to seventeen and a brutal September is a
 * better fantasy asset than the reverse at the identical mean, because one of
 * those stretches is played when it counts and the other is played while you
 * are still working out your lineup.
 *
 * So every week is its own column, taller and warmer for a defence that gave up
 * more, the bye is an empty socket rather than a gap the eye has to notice, and
 * the fantasy playoff weeks carry a rule beneath them. Reading the last three
 * columns is then a two-second act rather than a trip to a schedule tab.
 */
const SeasonAheadView = ({
  games,
  byeWeek,
  label,
  playoffWeeks = [15, 16, 17],
  pitch = 8,
  height = 26,
}: SeasonAheadProps) => {
  const width = LAST_WEEK * pitch;
  const byWeek = new Map(games.map((game) => [game.week, game]));
  const floor = 3;
  const usable = height - 6;

  return (
    <svg
      className="dr-micro dr-micro-season"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: LAST_WEEK }, (_, index) => {
        const week = index + 1;
        const game = byWeek.get(week);
        const x = index * pitch;
        // The bye is drawn as an absence, which is what it is — a hollow socket
        // the same size as a week, so the eye counts the season correctly.
        if (!game || week === byeWeek) {
          // Full height rather than a stub at the floor: an absence the same
          // size as a week is counted as a week, and a three-pixel mark among
          // eighteen columns reads as a rendering fault rather than as the bye.
          return (
            <rect
              key={week}
              x={x + 0.75}
              y={height - 6 - usable}
              width={pitch - 2}
              height={usable}
              rx={1}
              fill="none"
              stroke={FAINT}
              strokeWidth={0.75}
              strokeDasharray="2 2"
              opacity={0.85}
            />
          );
        }
        // Null difficulty is a matchup nobody has scored, drawn at the floor
        // rather than at the middle: a middling column is a claim.
        const soft = game.difficulty ?? 0;
        const bar = floor + soft * (usable - floor);
        return (
          <rect
            key={week}
            x={x + 0.5}
            y={height - 6 - bar}
            width={pitch - 1.5}
            height={bar}
            rx={1}
            fill={
              game.difficulty == null ? TRACK : soft >= 0.62 ? GOOD : soft <= 0.32 ? WARN : FAINT
            }
            opacity={game.difficulty == null ? 0.7 : 0.85}
          />
        );
      })}
      {/* The weeks it is actually decided in. */}
      <line
        x1={(playoffWeeks[0] - 1) * pitch + 0.5}
        x2={playoffWeeks[playoffWeeks.length - 1] * pitch - 1}
        y1={height - 2}
        y2={height - 2}
        stroke={INK}
        strokeWidth={1.4}
        opacity={0.7}
      />
    </svg>
  );
};

export const PlayMix = PlayMixView;
export const GoalLine = GoalLineView;
export const DepthLadder = DepthLadderView;
export const CareerArc = CareerArcView;
export const Consensus = ConsensusView;
export const CatchDepth = CatchDepthView;
export const SeasonAhead = SeasonAheadView;
