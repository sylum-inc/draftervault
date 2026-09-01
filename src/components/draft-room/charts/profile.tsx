import { useMemo, useState } from 'react';
import { FAINT, GOOD, INK, TRACK, WARN } from './micro';

/**
 * The dossier's instruments: the same rule as `micro.tsx` at the size a raised
 * card can afford.
 *
 * The eight tabs were nineteen `<dl>` lists of numerals against thirteen
 * charts, and three of the charts were bars. A number in a list is not wrong —
 * it is the most precise form there is — but a *column* of them answers no
 * question at all, because every question a drafter has is comparative:
 * compared to the other men at his position, compared to what a free player
 * scores, compared to what the room will pay. A list has nowhere to put the
 * comparison, so the reader carries it in their head with money on the table.
 *
 * These are the shapes those comparisons actually have:
 *
 *   A percentile is a *position in a distribution*, so draw the distribution.
 *   Eight bars all reading ninety-something say the same thing eight times;
 *   eight strips of the real cohort have eight different shapes.
 *
 *   A season's points came from somewhere, and where decides how much to
 *   believe them — sixty per cent of a back's total arriving as touchdowns is
 *   the single most regressive thing a fantasy season can be made of.
 *
 *   "Consistent" is a question about how many weeks cleared a bar, which is a
 *   staircase, not a variance score out of ten.
 *
 *   A price is reached by a chain of multipliers, so draw the chain.
 *
 * Interaction is held to the same bar as ink: it earns its place by answering a
 * question that was already being asked. Hovering a strip names the player
 * under the cursor, because "who is that dot" is the first thing anybody asks
 * of a distribution. Dragging a threshold answers "what are the odds he clears
 * the number I need", which no static curve can. Nothing here moves for the
 * sake of moving.
 */

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const quantile = (sorted: readonly number[], q: number): number => {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low);
};

export interface StripPoint {
  id: string;
  name: string;
  value: number;
}

interface MetricStripProps {
  label: string;
  /** Everybody he is being compared with, him included. */
  points: readonly StripPoint[];
  mineId: string;
  format: (value: number) => string;
  /** A rule with a meaning — replacement level, the league median. */
  reference?: { value: number; label: string } | null;
  /** Ranks and draft position: a smaller number is a better one. */
  invert?: boolean;
  width?: number;
  height?: number;
}

/**
 * One reading, against everybody it should be read against.
 *
 * This replaces a row of percentile bars, and the reason is the one this
 * codebase keeps rediscovering: a bar is a container. Eight of them told you
 * eight magnitudes on one shared 0-100 scale, so every player worth opening a
 * dossier on drew eight nearly-full bars and the panel said nothing — and worse,
 * it hid the only interesting thing, which is that the *distributions differ*.
 * Consistency at a position is tight and crowded; ceiling is skewed with a long
 * thin tail; red-zone touches are bimodal, because a team either feeds a man at
 * the goal line or it does not. A percentile of 90 means something completely
 * different in each of those three, and a bar cannot say which one you are in.
 *
 * So every player at his position is a tick on the real axis, he is the lit
 * caret, the median is a notch and a reference rule can carry replacement
 * level. The percentile is still printed, because it is the precise answer; the
 * strip is what makes it mean something.
 *
 * Hovering names the nearest man. "Who is that just above me" is the question a
 * distribution provokes and the one an auction actually needs — the answer is
 * usually somebody you could buy instead.
 */
export const MetricStrip = ({
  label,
  points,
  mineId,
  format,
  reference = null,
  invert = false,
  width = 300,
  height = 26,
}: MetricStripProps) => {
  const [hover, setHover] = useState<StripPoint | null>(null);

  const model = useMemo(() => {
    const values = points.map((point) => point.value).sort((a, b) => a - b);
    if (values.length < 4) return null;
    const mine = points.find((point) => point.id === mineId) ?? null;
    // Two per cent either end, so one outlier cannot compress the whole field
    // into the first third of the axis. A reading past the edge is clamped and
    // sits on it, which is itself a reading.
    const low = Math.min(quantile(values, 0.02), reference?.value ?? Infinity);
    const high = Math.max(quantile(values, 0.98), reference?.value ?? -Infinity);
    const span = high - low || 1;
    const below = mine ? values.filter((value) => value < mine.value).length : 0;
    const equal = mine ? values.filter((value) => value === mine.value).length : 0;
    const rank = mine ? Math.round(((below + equal / 2) / values.length) * 100) : null;
    return {
      low,
      high,
      span,
      mine,
      median: quantile(values, 0.5),
      // A rank percentile has to flip when a smaller number is a better one, or
      // the best player in the league reads as the worst.
      percentile: rank == null ? null : invert ? 100 - rank : rank,
      count: values.length,
    };
  }, [points, mineId, reference, invert]);

  if (!model) return null;

  const pad = 6;
  const inner = width - pad * 2;
  const x = (value: number) => pad + clamp01((value - model.low) / model.span) * inner;
  const axis = height - 9;

  const nearest = (clientX: number, target: SVGSVGElement) => {
    const box = target.getBoundingClientRect();
    const at = ((clientX - box.left) / box.width) * width;
    let best: StripPoint | null = null;
    let bestGap = Infinity;
    for (const point of points) {
      const gap = Math.abs(x(point.value) - at);
      if (gap < bestGap) {
        bestGap = gap;
        best = point;
      }
    }
    // Eight pixels: close enough that the answer is about the tick the cursor
    // is on rather than the nearest one on a half-empty stretch of axis.
    return bestGap <= 8 ? best : null;
  };

  return (
    <div className="dr-strip">
      <span className="dr-strip-label">{label}</span>
      <svg
        className="dr-strip-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: ${model.mine ? format(model.mine.value) : '—'}, ${model.percentile ?? '—'}th percentile of ${model.count} at this position`}
        onMouseMove={(event) => setHover(nearest(event.clientX, event.currentTarget))}
        onMouseLeave={() => setHover(null)}
      >
        <line x1={pad} x2={width - pad} y1={axis} y2={axis} stroke={TRACK} strokeWidth={5} />
        {/* The field itself. This is the part a bar could never carry: where the
            other men actually are, and therefore whether being ahead of them is
            a step or a stride. */}
        {points.map((point) => (
          <line
            key={point.id}
            x1={x(point.value)}
            x2={x(point.value)}
            y1={axis - 4}
            y2={axis + 4}
            stroke={hover?.id === point.id ? INK : FAINT}
            strokeWidth={hover?.id === point.id ? 1.6 : 1}
            opacity={hover?.id === point.id ? 1 : 0.55}
          />
        ))}
        {reference && (
          <line
            x1={x(reference.value)}
            x2={x(reference.value)}
            y1={axis - 8}
            y2={axis + 8}
            stroke={WARN}
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.85}
          />
        )}
        {/* The middle of the field, under the axis so it cannot be mistaken for
            another player. */}
        <path
          d={`M${x(model.median) - 3} ${axis + 9} L${x(model.median)} ${axis + 4} L${x(model.median) + 3} ${axis + 9} Z`}
          fill={INK}
          opacity={0.4}
        />
        {model.mine && (
          <>
            <circle cx={x(model.mine.value)} cy={axis} r={5.5} fill={GOOD} opacity={0.2} />
            <circle cx={x(model.mine.value)} cy={axis} r={3} fill={GOOD} />
          </>
        )}
      </svg>
      <span className="dr-strip-read">
        {hover && hover.id !== mineId ? (
          <>
            <em>{hover.name}</em>
            <b className="dr-num">{format(hover.value)}</b>
          </>
        ) : (
          <>
            <b className="dr-num">{model.mine ? format(model.mine.value) : '—'}</b>
            {model.percentile != null && <em>{model.percentile}th</em>}
          </>
        )}
      </span>
    </div>
  );
};

export interface MixSeason {
  season: number;
  total: number;
  parts: Array<{ key: string; label: string; points: number }>;
  /** The share of his points that arrived as touchdowns. */
  tdShare: number;
}

interface ScoringMixProps {
  seasons: readonly MixSeason[];
  /** What a typical starter at his position gets from touchdowns. */
  tdNorm?: number | null;
  width?: number;
  height?: number;
}

const MIX_FILL: Record<string, string> = {
  rec: 'var(--dr-accent-lift)',
  rush: GOOD,
  pass: 'var(--dr-info)',
  td: WARN,
  other: FAINT,
};

/**
 * Where the points actually came from, season by season.
 *
 * Two backs projected for two hundred and fifty points are not the same bet
 * when one of them got ninety of last year's from touchdowns and the other got
 * thirty. Touchdown rate is the least stable thing in football — it is handed
 * out by field position and play calling, not earned at a repeatable rate — so
 * a season built on it is a season that will not repeat, and the projection
 * cannot say so because it only ever saw the total.
 *
 * A stacked column per season, at the league's own scoring, with the touchdown
 * segment in the warning colour and a tick on the edge at the share a typical
 * starter gets. Above the tick is a man being paid for scores; below it, a man
 * being paid for yards and catches, which is the same money for a steadier
 * thing.
 *
 * The remainder is drawn as `other` rather than being normalised away: the
 * components are yards, catches and scores, and a season also contains two-point
 * conversions and lost fumbles. Scaling the parts to close the gap would state
 * a decomposition that is not the one that happened.
 */
export const ScoringMix = ({
  seasons,
  tdNorm = null,
  width = 300,
  height = 108,
}: ScoringMixProps) => {
  const [hover, setHover] = useState<{ season: number; key: string } | null>(null);
  if (!seasons.length) return null;

  const pad = { top: 6, bottom: 16 };
  const plot = height - pad.top - pad.bottom;
  const top = Math.max(...seasons.map((season) => season.total), 1) * 1.05;
  const slot = width / seasons.length;
  const bar = Math.min(46, slot * 0.56);
  const shown = hover
    ? seasons
        .find((season) => season.season === hover.season)
        ?.parts.find((part) => part.key === hover.key)
    : null;

  return (
    <div className="dr-mix">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={seasons
          .map(
            (season) =>
              `${season.season}: ${Math.round(season.total)} points, ${Math.round(season.tdShare * 100)}% from touchdowns`
          )
          .join('; ')}
        onMouseLeave={() => setHover(null)}
      >
        {seasons.map((season, index) => {
          const left = index * slot + (slot - bar) / 2;
          let y = pad.top + plot;
          return (
            <g key={season.season}>
              {season.parts.map((part) => {
                const tall = (Math.max(0, part.points) / top) * plot;
                y -= tall;
                return (
                  <rect
                    key={part.key}
                    x={left}
                    y={y}
                    width={bar}
                    height={Math.max(0, tall)}
                    fill={MIX_FILL[part.key] ?? FAINT}
                    opacity={
                      hover && (hover.season !== season.season || hover.key !== part.key)
                        ? 0.4
                        : 0.9
                    }
                    onMouseEnter={() => setHover({ season: season.season, key: part.key })}
                  />
                );
              })}
              {/* What a typical starter takes from scores, on his own column, so
                  "unusually touchdown-dependent" is a place rather than a word. */}
              {tdNorm != null && (
                <line
                  x1={left - 2}
                  x2={left + bar + 2}
                  y1={pad.top + plot - ((season.total * tdNorm) / top) * plot}
                  y2={pad.top + plot - ((season.total * tdNorm) / top) * plot}
                  stroke={INK}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.55}
                />
              )}
              <text
                x={left + bar / 2}
                y={height - 5}
                textAnchor="middle"
                className="dr-mix-tick"
                fill="currentColor"
              >
                {String(season.season).slice(2)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="dr-mix-read">
        {shown ? (
          <>
            <b className="dr-num">{Math.round(shown.points)}</b> pts from {shown.label} in{' '}
            {hover?.season}
          </>
        ) : (
          <>
            <b className="dr-num">{Math.round(seasons[seasons.length - 1].tdShare * 100)}%</b> of
            his {seasons[seasons.length - 1].season} came from touchdowns
            {tdNorm != null && ` · a typical starter ${Math.round(tdNorm * 100)}%`}
          </>
        )}
      </p>
    </div>
  );
};

interface WeeksAboveProps {
  /** Points in each game he played, in any order. */
  weeks: readonly number[];
  /** What a freely available player at his position scores in a game. */
  replacement: number;
  /** A full season, so weeks he missed are visibly weeks he did not clear. */
  season?: number;
  width?: number;
  height?: number;
}

/**
 * How many weeks he cleared a bar — for every bar.
 *
 * "Consistency 7/10" is a variance score, and variance is symmetric: it treats
 * a man who is never bad and a man who is never good as the same reading. What
 * a lineup actually needs is the other question — *how often did starting him
 * win the week* — and that is a staircase, not a score.
 *
 * The curve descends from seventeen at zero points to nothing at his best week,
 * and reading across at any threshold gives the number of weeks he cleared it.
 * Replacement level is marked, because the weeks below it are the weeks a free
 * player would have done as well; and the denominator is a full season rather
 * than games played, so a man who missed six weeks visibly cleared nothing in
 * six of them. An availability-adjusted reading is the only honest one when
 * what is being bought is a starting slot for eighteen weeks.
 */
export const WeeksAbove = ({
  weeks,
  replacement,
  season = 17,
  width = 300,
  height = 104,
}: WeeksAboveProps) => {
  const [at, setAt] = useState<number | null>(null);
  const sorted = useMemo(() => [...weeks].sort((a, b) => a - b), [weeks]);
  if (sorted.length < 3) return null;

  const pad = { left: 4, right: 4, top: 6, bottom: 18 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const top = Math.max(sorted[sorted.length - 1], replacement * 1.4, 1);
  const x = (points: number) => pad.left + clamp01(points / top) * plotW;
  const y = (count: number) => pad.top + (1 - clamp01(count / season)) * plotH;
  const above = (threshold: number) => sorted.filter((value) => value >= threshold).length;

  // A staircase, not a smoothed line: the count changes at his actual weeks and
  // is flat between them, and drawing a slope there would invent games.
  let path = `M${x(0)} ${y(above(0))}`;
  for (const value of sorted) {
    path += ` L${x(value)} ${y(above(value))} L${x(value)} ${y(above(value) - 1)}`;
  }
  path += ` L${x(top)} ${y(0)}`;

  const marker = at ?? replacement;

  return (
    <div className="dr-weeks">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Weeks cleared at each scoring threshold. He beat replacement level of ${replacement.toFixed(1)} in ${above(replacement)} of ${season} weeks.`}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const points = ((event.clientX - box.left) / box.width) * width;
          setAt(clamp01((points - pad.left) / plotW) * top);
        }}
        onMouseLeave={() => setAt(null)}
      >
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={y(0)}
          y2={y(0)}
          stroke={FAINT}
          strokeWidth={0.75}
          opacity={0.7}
        />
        {/* Under the curve to the left of replacement is the part of his season
            a free player would also have given you. */}
        <path d={`${path} L${x(top)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={GOOD} opacity={0.1} />
        <path d={path} fill="none" stroke={GOOD} strokeWidth={1.6} />
        <line
          x1={x(replacement)}
          x2={x(replacement)}
          y1={pad.top}
          y2={y(0)}
          stroke={WARN}
          strokeWidth={1}
          strokeDasharray="3 2"
          opacity={0.9}
        />
        {at != null && (
          <line
            x1={x(at)}
            x2={x(at)}
            y1={pad.top}
            y2={y(0)}
            stroke={INK}
            strokeWidth={1}
            opacity={0.8}
          />
        )}
        <text
          x={x(replacement)}
          y={height - 5}
          textAnchor="middle"
          className="dr-mix-tick"
          fill="currentColor"
        >
          free
        </text>
      </svg>
      <p className="dr-mix-read">
        Cleared <b className="dr-num">{marker.toFixed(1)}</b> in{' '}
        <b className="dr-num">
          {above(marker)} of {season}
        </b>{' '}
        weeks
        {at == null && ' — the bar a free player sets'}
      </p>
    </div>
  );
};

interface ThresholdProps {
  projection: number;
  floor: number;
  ceiling: number;
  replacement: number | null;
}

/** The standard normal tail, good to about four decimal places. Abramowitz and
 *  Stegun 26.2.17, which is more than a projection deserves. */
const tailAbove = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? p : 1 - p;
};

/**
 * The odds he clears a number you choose.
 *
 * The outcome curve above draws the whole distribution, which is the right
 * picture and answers a question nobody actually has. The question people have
 * is specific and arrives with a number already in it: *my other back gives me
 * two hundred and ten, does this man beat that?* A curve cannot be read to two
 * significant figures by eye, and the one threshold that matters is different
 * for every reader — which is exactly the case for making it draggable rather
 * than for drawing forty more marks nobody asked about.
 *
 * Floor and ceiling are one standard deviation either side, so the deviation is
 * half their spread and the tail is an ordinary normal one. It opens on
 * replacement level, which is the threshold the whole board is built around.
 */
export const Threshold = ({ projection, floor, ceiling, replacement }: ThresholdProps) => {
  const sd = Math.max((ceiling - floor) / 2, 1);
  /*
   * Replacement level is inside the range or the slider lies about where it is.
   * It opens on that threshold, and for a good player replacement sits well
   * below the floor — so a range of floor-to-ceiling clamped the handle to its
   * left end while the label read the true number, which is a control saying
   * one thing and showing another.
   */
  const low = Math.max(0, Math.round(Math.min(floor - sd, replacement ?? floor)));
  const high = Math.round(Math.max(ceiling + sd, replacement ?? ceiling));
  const [at, setAt] = useState(() =>
    Math.min(high, Math.max(low, Math.round(replacement ?? projection)))
  );
  // P(X > at) with X normal about the projection, which is Q of the *standard-
  // ised threshold* — not of the distance back to the mean. Written the other
  // way round first, which reported a 0% chance that a 278-point projection
  // would clear 72.
  const odds = Math.round(tailAbove((at - projection) / sd) * 100);

  return (
    <div className="dr-threshold">
      <label className="dr-threshold-row">
        <span className="dr-threshold-say">
          <b className="dr-num">{odds}%</b> chance he clears <b className="dr-num">{at}</b> points
        </span>
        <input
          type="range"
          min={low}
          max={high}
          step={1}
          value={at}
          onChange={(event) => setAt(Number(event.target.value))}
          aria-label="Points threshold"
        />
      </label>
      <p className="dr-footnote" style={{ margin: 0 }}>
        {replacement != null && (
          <>
            A free {' '}
            <button
              type="button"
              className="dr-linkish"
              onClick={() => setAt(Math.min(high, Math.max(low, Math.round(replacement))))}
            >
              replacement player scores {Math.round(replacement)}
            </button>
            .{' '}
          </>
        )}
        Floor and ceiling are one standard deviation either side, so this is the normal tail of that
        spread — not a simulation.
      </p>
    </div>
  );
};

export interface ChainStep {
  label: string;
  /** The dollars after this step. */
  dollars: number;
  /** What was applied to get here, as it should be printed. */
  applied?: string;
  note?: string;
}

interface PriceChainProps {
  steps: readonly ChainStep[];
}

/**
 * How the number on the card was reached, as the chain it is.
 *
 * The panel this replaces printed list value, inflation, scarcity, need,
 * confidence and adjusted value as six unrelated cells, which is the shape of a
 * lookup table and not the shape of the arithmetic. The arithmetic is a chain:
 * a list price derived from points over replacement, multiplied by what the
 * room is paying tonight, multiplied by what this roster still needs. Each step
 * lands on a dollar figure, and the useful reading is which step moved it —
 * because "the model likes him" and "you need one and the room is hot" are
 * different reasons to be looking at $54, and only one of them survives you
 * filling the slot.
 *
 * Bar length is the dollars, so growth and shrinkage down the chain are visible
 * without reading a multiplier; the multiplier is printed anyway, because a
 * length is not a number.
 */
export const PriceChain = ({ steps }: PriceChainProps) => {
  const top = Math.max(...steps.map((step) => step.dollars), 1);
  return (
    <ol className="dr-chain">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].dollars : null;
        const move = previous == null ? 0 : step.dollars - previous;
        return (
          <li key={step.label} className="dr-chain-step" title={step.note}>
            <span className="dr-chain-label">{step.label}</span>
            <span className="dr-chain-track">
              <span
                className="dr-chain-fill"
                style={{
                  width: `${(step.dollars / top) * 100}%`,
                  background:
                    index === steps.length - 1 ? 'var(--dr-good)' : 'var(--dr-accent-lift)',
                  opacity: index === steps.length - 1 ? 0.9 : 0.55,
                }}
              />
            </span>
            {step.applied && <span className="dr-chain-applied">{step.applied}</span>}
            <span className="dr-chain-money dr-num">
              ${Math.round(step.dollars)}
              {move !== 0 && (
                <em data-move={move > 0 ? 'up' : 'down'}>
                  {move > 0 ? '+' : '−'}${Math.abs(Math.round(move))}
                </em>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

interface BidScrubProps {
  /** Our list price, before tonight's room. */
  list: number;
  /** The same price moved by what the room is actually paying, if known. */
  adjusted: number | null;
  projection: number;
  /** Points over the man the snake hands you free, if the outlook is knowable. */
  gain: number | null;
  gainFree: string | null;
  /** The most this team may legally bid, which is what the engine will accept. */
  ceiling: number | null;
}

/**
 * What a bid buys, at whatever number is on the table.
 *
 * Every other price on this screen is a number somebody else arrived at. The
 * one that decides the night is the number about to be said out loud, and it
 * moves a dollar at a time while people shout — so the useful thing is not
 * another static figure but the same three readings recomputed at whatever is
 * being considered.
 *
 * Points per dollar is the comparison an auction is really making across
 * players. The surplus is against our list price and against the adjusted one,
 * which differ by exactly the room's inflation and are worth seeing apart.
 * And where the snake outlook is knowable, gain per dollar is the reading this
 * format turns on — buying points you were going to be handed for nothing is
 * the specific way a hybrid budget disappears.
 */
export const BidScrub = ({
  list,
  adjusted,
  projection,
  gain,
  gainFree,
  ceiling,
}: BidScrubProps) => {
  const max = Math.max(ceiling ?? 0, Math.round((adjusted ?? list) * 1.6), list + 5, 10);
  const [bid, setBid] = useState(() => Math.max(1, Math.round(adjusted ?? list)));
  const perDollar = bid > 0 ? projection / bid : 0;
  const gainPerDollar = gain != null && bid > 0 ? gain / bid : null;
  const over = bid - list;

  return (
    <div className="dr-scrub">
      <div className="dr-scrub-head">
        <b className="dr-num">${bid}</b>
        <input
          type="range"
          min={1}
          max={max}
          step={1}
          value={bid}
          onChange={(event) => setBid(Number(event.target.value))}
          aria-label="What a bid buys"
        />
      </div>
      <dl className="dr-scrub-reads">
        <div>
          <dt>Points per $</dt>
          <dd className="dr-num">{perDollar.toFixed(1)}</dd>
        </div>
        <div title="Against our own list price, before the room">
          <dt>vs list</dt>
          <dd className="dr-num" data-tone={over > 0 ? 'warn' : 'good'}>
            {over > 0 ? '+' : over < 0 ? '−' : ''}${Math.abs(over)}
          </dd>
        </div>
        {adjusted != null && (
          <div title="Against the list price moved by what the room is paying tonight">
            <dt>vs tonight</dt>
            <dd className="dr-num" data-tone={bid > adjusted ? 'warn' : 'good'}>
              {bid > adjusted ? '+' : bid < adjusted ? '−' : ''}$
              {Math.abs(bid - Math.round(adjusted))}
            </dd>
          </div>
        )}
        {gainPerDollar != null && (
          <div title={`Points a dollar over ${gainFree ?? 'the man the snake hands you free'}`}>
            <dt>Gain per $</dt>
            <dd className="dr-num" data-tone={gainPerDollar > 0 ? 'good' : 'warn'}>
              {gainPerDollar.toFixed(2)}
            </dd>
          </div>
        )}
        {ceiling != null && (
          <div title="The most you may legally bid — the same figure the engine will accept">
            <dt>Your ceiling</dt>
            <dd className="dr-num">${ceiling}</dd>
          </div>
        )}
      </dl>
      {gain != null && gainFree && (
        <p className="dr-footnote" style={{ margin: 0 }}>
          Every dollar here is buying {gain > 0 ? `the ${gain} points` : 'nothing'} between him and{' '}
          {gainFree}, who the snake hands you for free — not the {Math.round(projection)} on his
          card.
        </p>
      )}
    </div>
  );
};
