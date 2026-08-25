import { useMemo } from 'react';
import type { Player } from '@/services/auctionDraftService';
import { getIdentity } from '@/services/nflIdentity';
import { Headshot } from './Headshot';

interface CompareTrayProps {
  players: Player[];
  pinned: string[];
  onUnpin: (id: string) => void;
  onClear: () => void;
  onOpen: () => void;
}

/** The docked strip: who is pinned, and the way into the full comparison. */
export const CompareTray = ({ players, pinned, onUnpin, onClear, onOpen }: CompareTrayProps) => {
  const chosen = pinned
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  if (chosen.length === 0) return null;

  return (
    <div className="dr-tray" role="region" aria-label="Players pinned for comparison">
      <span className="dr-eyebrow">Compare</span>
      <div className="dr-tray-chips">
        {chosen.map((player) => (
          <button
            key={player.id}
            type="button"
            className="dr-tray-chip"
            onClick={() => onUnpin(player.id)}
            title={`Remove ${player.name}`}
          >
            <Headshot
              identity={getIdentity(player.id)}
              fallbackName={player.name}
              width={22}
              className="dr-tray-face"
            />
            <span>{getIdentity(player.id)?.name ?? player.name}</span>
            <em aria-hidden="true">×</em>
          </button>
        ))}
      </div>
      <button className="dr-button is-primary" onClick={onOpen} disabled={chosen.length < 2}>
        Compare {chosen.length}
      </button>
      <button className="dr-button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
};

interface CompareViewProps {
  players: Player[];
  pinned: string[];
  onClose: () => void;
  onUnpin: (id: string) => void;
}

type Row = {
  label: string;
  read: (player: Player) => number | null;
  format: (value: number) => string;
  /** Whether a bigger number is the better one, for the winner marker. */
  higherIsBetter?: boolean;
  group: string;
};

const ROWS: Row[] = [
  {
    group: 'Value',
    label: 'Our price',
    read: (p) => p.estimatedValue,
    format: (v) => `$${v}`,
    higherIsBetter: false,
  },
  {
    group: 'Value',
    label: 'Our rank',
    read: (p) => p.adp,
    format: (v) => `#${v}`,
    higherIsBetter: false,
  },
  {
    group: 'Value',
    label: 'Consensus rank',
    read: (p) => p.market?.consensusRank ?? null,
    format: (v) => `#${v}`,
    higherIsBetter: false,
  },
  {
    group: 'Value',
    label: 'Expert spread',
    read: (p) => p.market?.spread ?? null,
    format: (v) => `±${v}`,
    higherIsBetter: false,
  },
  {
    group: 'Projection',
    label: 'Projected points',
    read: (p) => p.projectedPoints,
    format: (v) => String(v),
  },
  {
    group: 'Projection',
    label: 'Points per game',
    read: (p) => p.pointsPerGame ?? null,
    format: (v) => v.toFixed(1),
  },
  { group: 'Projection', label: 'Floor', read: (p) => p.floor, format: (v) => String(v) },
  { group: 'Projection', label: 'Ceiling', read: (p) => p.upside, format: (v) => String(v) },
  {
    group: 'Projection',
    label: 'Consistency',
    read: (p) => p.consistency,
    format: (v) => `${v}/10`,
  },
  {
    group: 'Usage',
    label: 'Snap share',
    read: (p) => p.snapPercentage ?? null,
    format: (v) => `${v}%`,
  },
  {
    group: 'Usage',
    label: 'Target share',
    read: (p) => p.usage?.targetShare ?? null,
    format: (v) => `${v}%`,
  },
  {
    group: 'Usage',
    label: 'Air yards share',
    read: (p) => p.usage?.airYardsShare ?? null,
    format: (v) => `${v}%`,
  },
  {
    group: 'Usage',
    label: 'Carry share',
    read: (p) => p.usage?.carryShare ?? null,
    format: (v) => `${v}%`,
  },
  {
    group: 'Usage',
    label: 'Touches per game',
    read: (p) => p.usage?.touchesPerGame ?? null,
    format: (v) => v.toFixed(1),
  },
  {
    group: 'Usage',
    label: 'Red-zone touches',
    read: (p) => p.usage?.redZoneTouches ?? null,
    format: (v) => String(v),
  },
  {
    group: 'Usage',
    label: 'Goal-line touches',
    read: (p) => p.usage?.goalLineTouches ?? null,
    format: (v) => String(v),
  },
  { group: 'Usage', label: 'aDOT', read: (p) => p.usage?.adot ?? null, format: (v) => `${v} yd` },
  {
    group: 'Offence',
    label: 'Plays per game',
    read: (p) => p.teamContext?.playsPerGame ?? null,
    format: (v) => v.toFixed(1),
  },
  {
    group: 'Offence',
    label: 'Pass rate over expected',
    read: (p) => p.teamContext?.passRateOverExpected ?? null,
    format: (v) => `${v > 0 ? '+' : ''}${v}%`,
  },
  {
    group: 'Offence',
    label: 'Red-zone trips/game',
    read: (p) => p.teamContext?.redZoneTripsPerGame ?? null,
    format: (v) => v.toFixed(1),
  },
  {
    group: 'Offence',
    label: 'Sack rate allowed',
    read: (p) => p.teamContext?.sackRateAllowed ?? null,
    format: (v) => `${v}%`,
    higherIsBetter: false,
  },
  {
    group: 'Risk',
    label: 'Games missed, 3 yrs',
    read: (p) => p.durability?.totalMissed ?? null,
    format: (v) => String(v),
    higherIsBetter: false,
  },
  {
    group: 'Risk',
    label: 'Depth chart',
    read: (p) => p.competition?.depth ?? null,
    format: (v) => `${v}${v === 1 ? 'st' : v === 2 ? 'nd' : v === 3 ? 'rd' : 'th'}`,
    higherIsBetter: false,
  },
  {
    group: 'Risk',
    label: 'Bye week',
    read: (p) => p.byeWeek || null,
    format: (v) => `wk ${v}`,
    higherIsBetter: false,
  },
];

/**
 * Two to four players, every number on a shared scale.
 *
 * This is the moment the whole app exists for: a name is on the block and the
 * question is whether he is better than the one you were saving your money for.
 * Answering it means putting the numbers next to each other on the *same* axis —
 * a bar that is twice as long has to mean twice as much, or the comparison is
 * decoration. Rows where nobody has data disappear rather than showing dashes.
 */
export const CompareView = ({ players, pinned, onClose, onUnpin }: CompareViewProps) => {
  const chosen = useMemo(
    () =>
      pinned
        .map((id) => players.find((player) => player.id === id))
        .filter((player): player is Player => Boolean(player)),
    [players, pinned]
  );

  const groups = useMemo(() => {
    const out = new Map<string, Array<Row & { values: Array<number | null>; max: number }>>();
    for (const row of ROWS) {
      const values = chosen.map(row.read);
      if (!values.some((value) => value != null)) continue;
      const max = Math.max(...values.map((value) => value ?? 0), 0.0001);
      if (!out.has(row.group)) out.set(row.group, []);
      out.get(row.group)!.push({ ...row, values, max });
    }
    return out;
  }, [chosen]);

  if (chosen.length < 2) return null;

  return (
    <div className="dr-overlay" role="dialog" aria-modal="true" aria-label="Compare players">
      <div className="dr-compare dr-panel">
        <header className="dr-compare-head">
          <h2 className="dr-display">Head to head</h2>
          <button className="dr-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div
          className="dr-compare-players"
          style={{ '--dr-compare-count': chosen.length } as React.CSSProperties}
        >
          <span />
          {chosen.map((player) => {
            const identity = getIdentity(player.id);
            return (
              <div className="dr-compare-player" key={player.id}>
                <Headshot
                  identity={identity}
                  fallbackName={player.name}
                  width={54}
                  className="dr-compare-face"
                />
                <strong>{identity?.name ?? player.name}</strong>
                <span className="dr-compare-meta">
                  {player.position} · {player.team}
                </span>
                <button className="dr-linkish" onClick={() => onUnpin(player.id)}>
                  remove
                </button>
              </div>
            );
          })}
        </div>

        <div className="dr-compare-body">
          {[...groups].map(([group, rows]) => (
            <section key={group}>
              <h3 className="dr-eyebrow">{group}</h3>
              {rows.map((row) => {
                const present = row.values.filter((value): value is number => value != null);
                const best =
                  present.length > 1
                    ? row.higherIsBetter === false
                      ? Math.min(...present)
                      : Math.max(...present)
                    : null;
                return (
                  <div
                    className="dr-compare-row"
                    key={row.label}
                    style={{ '--dr-compare-count': chosen.length } as React.CSSProperties}
                  >
                    <span className="dr-compare-label">{row.label}</span>
                    {row.values.map((value, index) => (
                      <div className="dr-compare-cell" key={chosen[index].id}>
                        {/* No bar where a smaller number is the better one. Length
                            reads as "more is better" whatever the caption says, and
                            on a rank row that is exactly backwards — #2 would draw
                            a longer bar than #1. The highlight carries those. */}
                        {row.higherIsBetter !== false && (
                          <span
                            className="dr-compare-bar"
                            style={{ width: value == null ? 0 : `${(value / row.max) * 100}%` }}
                          />
                        )}
                        <span
                          className={`dr-num dr-compare-value${value != null && value === best ? ' is-best' : ''}`}
                        >
                          {value == null ? '—' : row.format(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <p className="dr-footnote">
          Bars share a scale within each row, and only appear where a bigger number is the better
          one. A highlighted number is the best of the group at that measure — for price, rank,
          expert spread, injuries, depth chart and bye week, lower is better.
        </p>
      </div>
    </div>
  );
};
