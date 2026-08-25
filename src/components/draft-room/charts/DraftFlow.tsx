export interface FlowPick {
  pickNumber: number;
  position: string;
  cost: number;
  playerName: string;
  teamName: string;
}

interface DraftFlowProps {
  picks: FlowPick[];
  /** Total money the room started with, so the drain has a ceiling. */
  totalBudget: number;
}

const WIDTH = 460;
const HEIGHT = 120;
const PAD = { top: 10, right: 8, bottom: 18, left: 36 };

/**
 * Money leaving the room, and the size of each bite.
 *
 * An auction is a closed system: every dollar spent is a dollar that cannot bid
 * against you later. The line is what remains; the ticks under it are what each
 * pick cost. Watching the slope is how you know whether the room is front-
 * loading — and a flat stretch late is the tell that everyone is out of money
 * and the players still on the board are about to go for a dollar.
 *
 * One hue throughout. This is a magnitude over time, and position is carried by
 * the run strip below, where every cell is lettered — a three-pixel tick cannot
 * hold a label, so it must not be the only place identity lives.
 */
export const DraftFlow = ({ picks, totalBudget }: DraftFlowProps) => {
  if (picks.length < 2) return null;

  const ordered = [...picks].sort((a, b) => a.pickNumber - b.pickNumber);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const dearest = Math.max(...ordered.map((pick) => pick.cost), 1);

  let running = 0;
  const remaining = ordered.map((pick) => {
    running += pick.cost;
    return { pick, left: totalBudget - running };
  });

  const x = (index: number) => PAD.left + (index / Math.max(1, ordered.length - 1)) * plotW;
  const y = (left: number) => PAD.top + (1 - left / totalBudget) * plotH;

  const line = remaining
    .map((row, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(row.left).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(remaining.length - 1).toFixed(1)},${PAD.top + plotH} L${PAD.left},${PAD.top + plotH} Z`;
  const spent = totalBudget - (remaining[remaining.length - 1]?.left ?? totalBudget);

  return (
    <figure className="dr-flow">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`$${spent} of $${totalBudget} has left the room across ${ordered.length} picks. The most expensive was $${dearest}.`}
      >
        <path d={area} fill="var(--dr-value)" fillOpacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke="var(--dr-value)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {remaining.map((row, i) => {
          // Each tick is the price of that pick, hanging from the baseline.
          const h = Math.max(1.5, (row.pick.cost / dearest) * (plotH * 0.44));
          return (
            <rect
              key={row.pick.pickNumber}
              x={x(i) - 1.5}
              y={PAD.top + plotH - h}
              width={3}
              height={h}
              fill="var(--dr-ink-faint)"
              fillOpacity={0.7}
            >
              <title>
                {`#${row.pick.pickNumber} ${row.pick.playerName} (${row.pick.position}) — $${row.pick.cost} to ${row.pick.teamName}; $${row.left} left in the room`}
              </title>
            </rect>
          );
        })}

        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--dr-line)"
        />
        <text x={4} y={PAD.top + 8} className="dr-axis-title">
          ${totalBudget}
        </text>
        <text x={4} y={PAD.top + plotH} className="dr-axis-title">
          $0
        </text>
        <text x={PAD.left + plotW / 2} y={HEIGHT - 4} className="dr-axis-title" textAnchor="middle">
          pick 1 → {ordered.length}
        </text>
      </svg>

      <figcaption className="dr-flow-key">
        <span className="dr-flow-total dr-num">
          ${spent} of ${totalBudget} gone
        </span>
        <span className="dr-flow-note">Ticks are what each pick cost · hover for the player</span>
      </figcaption>
    </figure>
  );
};

interface PositionRunsProps {
  picks: FlowPick[];
}

/**
 * The order positions came off the board.
 *
 * Runs are the thing an auction room does that no projection anticipates: four
 * tight ends in six picks and the position is gone. Every cell carries its
 * letter, so the colour is reinforcement and never the only signal.
 */
export const PositionRuns = ({ picks }: PositionRunsProps) => {
  if (!picks.length) return null;
  const ordered = [...picks].sort((a, b) => a.pickNumber - b.pickNumber);

  return (
    <div className="dr-runs">
      <div className="dr-runs-strip">
        {ordered.map((pick) => (
          <span
            key={pick.pickNumber}
            className="dr-run-cell"
            style={{ background: `var(--dr-pos-${pick.position.toLowerCase()})` }}
            title={`#${pick.pickNumber} ${pick.playerName} — $${pick.cost} to ${pick.teamName}`}
          >
            {pick.position === 'DST' ? 'D' : pick.position.charAt(0)}
          </span>
        ))}
      </div>
      <p className="dr-footnote">
        Each cell is one pick, in order. The letter is the position; the colour repeats it.
      </p>
    </div>
  );
};
