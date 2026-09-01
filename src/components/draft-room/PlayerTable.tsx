import { useMemo } from 'react';
import type { Player, PriceAdjuster } from '@/services/auctionDraftService';
import { getIdentity, teamColors } from '@/services/nflIdentity';

export type TableSort =
  | 'rank'
  | 'value'
  | 'projected'
  | 'vorp'
  | 'bye'
  | 'snap'
  | 'consistency'
  | 'name'
  | 'ppg'
  | 'floor'
  | 'ceiling'
  | 'targetShare'
  | 'carryShare'
  | 'redZone'
  | 'touches'
  | 'adot'
  | 'plays'
  | 'proe'
  | 'consensus'
  | 'edge'
  | 'spread'
  | 'ownership'
  | 'adjusted';

export type ColumnSet = 'value' | 'production' | 'usage' | 'market';

interface PlayerTableProps {
  players: Player[];
  /**
   * How many rows to actually render. The table mounts a row per player, and
   * six hundred of them cost seconds of frozen interface on an ordinary laptop.
   * Sorting and the bar scales still use every player, so what is shown is the
   * real top of the list rather than an arbitrary slice.
   */
  limit?: number;
  selectedId?: string;
  watchlist: string[];
  pinned: string[];
  columns: ColumnSet;
  sort: TableSort;
  descending: boolean;
  onSort: (sort: TableSort) => void;
  onColumns: (set: ColumnSet) => void;
  onSelect: (player: Player) => void;
  onToggleWatch: (playerId: string) => void;
  onTogglePin: (playerId: string) => void;
  /**
   * List prices restated at the room's inflation.
   *
   * A closure off the engine rather than a number written onto each player, and
   * that is deliberate: the adjusted price changes on every single pick, and
   * the card board's sixty memoised cards do not re-render on a pick at all
   * because their props are stable element references. Putting this on the
   * Player object — or handing it to a card — would undo that measured fix for
   * every pick of the night. The table re-renders anyway, so it can have it.
   */
  adjust: PriceAdjuster;
}

interface Column {
  key: TableSort | null;
  label: string;
  numeric?: boolean;
  title?: string;
  /**
   * The cell's text.
   *
   * Takes the price adjuster as well as the player because one column is not a
   * property of the player at all: what he costs tonight is a property of the
   * room, and it moves with every pick while he does not.
   */
  read?: (player: Player, adjust: PriceAdjuster) => string;
  /** Draws a proportional bar behind the number, scaled across the visible rows. */
  bar?: (player: Player, adjust: PriceAdjuster) => number | null;
  tone?: string;
}

const pct = (value: number | null | undefined) => (value == null ? '—' : `${Math.round(value)}%`);
const one = (value: number | null | undefined) => (value == null ? '—' : value.toFixed(1));

/**
 * Four column sets over one table.
 *
 * Six hundred players carry far more numbers than fit across a screen, and the
 * ones that matter change with the question: pricing a bid is a different task
 * from working out whether a role is real. Rather than a horizontal scroll that
 * nobody uses, the identity columns stay put and the right-hand block swaps.
 */
const SETS: Record<ColumnSet, Column[]> = {
  value: [
    {
      key: 'value',
      label: '$',
      numeric: true,
      title: 'Our auction value',
      read: (p) => `$${p.estimatedValue}`,
      bar: (p) => p.estimatedValue,
      tone: 'var(--dr-value)',
    },
    {
      key: 'adjusted',
      label: 'Now',
      numeric: true,
      title: "What he costs at the room's current inflation, not the list price",
      read: (p, adjust) => `$${adjust.price(p)}`,
      bar: (p, adjust) => adjust.price(p),
    },
    {
      key: 'projected',
      label: 'Proj',
      numeric: true,
      title: 'Projected PPR points',
      read: (p) => String(p.projectedPoints),
      bar: (p) => p.projectedPoints,
    },
    {
      key: 'vorp',
      label: 'VORP',
      numeric: true,
      title: 'Value over replacement',
      read: (p) => String(p.valueOverReplacement),
    },
    {
      key: 'floor',
      label: 'Floor',
      numeric: true,
      title: 'One season deviation below the projection',
      read: (p) => String(p.floor),
    },
    {
      key: 'ceiling',
      label: 'Ceil',
      numeric: true,
      title: 'One season deviation above the projection',
      read: (p) => String(p.upside),
    },
    {
      key: 'consistency',
      label: 'Cons',
      numeric: true,
      title: 'Week-to-week consistency, 1-10',
      read: (p) => String(p.consistency ?? '—'),
    },
    { key: 'bye', label: 'Bye', numeric: true, read: (p) => String(p.byeWeek || '—') },
  ],
  production: [
    {
      key: 'projected',
      label: 'Proj',
      numeric: true,
      title: 'Projected PPR points',
      read: (p) => String(p.projectedPoints),
      bar: (p) => p.projectedPoints,
    },
    {
      key: 'ppg',
      label: 'PPG',
      numeric: true,
      title: 'Projected points per game',
      read: (p) => one(p.pointsPerGame),
    },
    { key: 'floor', label: 'Floor', numeric: true, read: (p) => String(p.floor) },
    { key: 'ceiling', label: 'Ceil', numeric: true, read: (p) => String(p.upside) },
    {
      key: null,
      label: 'Gm',
      numeric: true,
      title: 'Expected games played',
      read: (p) => String(p.expectedGames ?? '—'),
    },
    {
      key: null,
      label: 'Missed',
      numeric: true,
      title: 'Games missed to injury over three seasons',
      read: (p) => String(p.durability?.totalMissed ?? '—'),
    },
    { key: 'consistency', label: 'Cons', numeric: true, read: (p) => String(p.consistency ?? '—') },
  ],
  usage: [
    {
      key: 'snap',
      label: 'Snap',
      numeric: true,
      title: 'Share of offensive snaps',
      read: (p) => pct(p.snapPercentage),
      bar: (p) => p.snapPercentage ?? null,
    },
    {
      key: 'targetShare',
      label: 'Tgt%',
      numeric: true,
      title: "Share of the team's targets",
      read: (p) => pct(p.usage?.targetShare),
    },
    {
      key: 'carryShare',
      label: 'Car%',
      numeric: true,
      title: "Share of the team's carries",
      read: (p) => pct(p.usage?.carryShare),
    },
    {
      key: 'touches',
      label: 'Tch/g',
      numeric: true,
      title: 'Touches per game',
      read: (p) => one(p.usage?.touchesPerGame),
    },
    {
      key: 'redZone',
      label: 'RZ',
      numeric: true,
      title: 'Red-zone touches',
      read: (p) => String(p.usage?.redZoneTouches ?? '—'),
      bar: (p) => p.usage?.redZoneTouches ?? null,
    },
    {
      key: 'adot',
      label: 'aDOT',
      numeric: true,
      title: 'Average depth of target',
      read: (p) => one(p.usage?.adot),
    },
    {
      key: 'plays',
      label: 'Plays',
      numeric: true,
      title: "The offence's plays per game",
      read: (p) => one(p.teamContext?.playsPerGame),
    },
    {
      key: 'proe',
      label: 'PROE',
      numeric: true,
      title: 'Pass rate over expected',
      read: (p) =>
        p.teamContext?.passRateOverExpected == null
          ? '—'
          : `${p.teamContext.passRateOverExpected > 0 ? '+' : ''}${p.teamContext.passRateOverExpected}`,
    },
  ],
  market: [
    {
      key: 'value',
      label: '$',
      numeric: true,
      read: (p) => `$${p.estimatedValue}`,
      tone: 'var(--dr-value)',
    },
    {
      key: 'consensus',
      label: 'ECR',
      numeric: true,
      title: 'FantasyPros expert consensus rank',
      read: (p) => (p.market?.consensusRank ? `#${p.market.consensusRank}` : '—'),
    },
    {
      key: 'edge',
      label: 'Gap',
      numeric: true,
      title: 'Consensus rank minus our rank — positive means the room is sleeping on him',
      read: (p) =>
        p.market?.edge == null ? '—' : `${p.market.edge > 0 ? '+' : ''}${p.market.edge}`,
    },
    {
      key: 'spread',
      label: '±',
      numeric: true,
      title: 'How much the experts disagree',
      read: (p) => (p.market?.spread == null ? '—' : String(p.market.spread)),
    },
    {
      key: null,
      label: 'Best',
      numeric: true,
      title: 'Most optimistic expert',
      read: (p) => (p.market?.best ? `#${p.market.best}` : '—'),
    },
    {
      key: null,
      label: 'Worst',
      numeric: true,
      title: 'Least optimistic expert',
      read: (p) => (p.market?.worst ? `#${p.market.worst}` : '—'),
    },
    {
      key: 'ownership',
      label: 'Own',
      numeric: true,
      title: 'Percentage of leagues where he is rostered',
      read: (p) => pct(p.market?.ownership),
    },
  ],
};

const SORTS: Record<TableSort, (a: Player, b: Player, adjust: PriceAdjuster) => number> = {
  rank: (a, b) => a.adp - b.adp,
  value: (a, b) => a.estimatedValue - b.estimatedValue,
  projected: (a, b) => a.projectedPoints - b.projectedPoints,
  vorp: (a, b) => a.valueOverReplacement - b.valueOverReplacement,
  bye: (a, b) => (a.byeWeek ?? 99) - (b.byeWeek ?? 99),
  snap: (a, b) => (a.snapPercentage ?? -1) - (b.snapPercentage ?? -1),
  consistency: (a, b) => (a.consistency ?? -1) - (b.consistency ?? -1),
  name: (a, b) => a.name.localeCompare(b.name),
  ppg: (a, b) => (a.pointsPerGame ?? -1) - (b.pointsPerGame ?? -1),
  floor: (a, b) => a.floor - b.floor,
  ceiling: (a, b) => a.upside - b.upside,
  targetShare: (a, b) => (a.usage?.targetShare ?? -1) - (b.usage?.targetShare ?? -1),
  carryShare: (a, b) => (a.usage?.carryShare ?? -1) - (b.usage?.carryShare ?? -1),
  redZone: (a, b) => (a.usage?.redZoneTouches ?? -1) - (b.usage?.redZoneTouches ?? -1),
  touches: (a, b) => (a.usage?.touchesPerGame ?? -1) - (b.usage?.touchesPerGame ?? -1),
  adot: (a, b) => (a.usage?.adot ?? -1) - (b.usage?.adot ?? -1),
  plays: (a, b) => (a.teamContext?.playsPerGame ?? -1) - (b.teamContext?.playsPerGame ?? -1),
  proe: (a, b) =>
    (a.teamContext?.passRateOverExpected ?? -99) - (b.teamContext?.passRateOverExpected ?? -99),
  // Ranks sort best-first when ascending, so an unranked player belongs last.
  consensus: (a, b) => (a.market?.consensusRank ?? 9999) - (b.market?.consensusRank ?? 9999),
  edge: (a, b) => (a.market?.edge ?? -999) - (b.market?.edge ?? -999),
  spread: (a, b) => (a.market?.spread ?? -1) - (b.market?.spread ?? -1),
  ownership: (a, b) => (a.market?.ownership ?? -1) - (b.market?.ownership ?? -1),
  // Inflation is one multiplier over the whole board, so this orders identically
  // to `value` — until a sheet is in force, when off-sheet players do not move
  // and the two genuinely diverge.
  adjusted: (a, b, adjust) => adjust.price(a) - adjust.price(b),
};

const TREND_MARK: Record<string, { glyph: string; tone: string; label: string }> = {
  RISING: { glyph: '▲', tone: 'var(--dr-value)', label: 'rising' },
  DECLINING: { glyph: '▼', tone: 'var(--dr-danger)', label: 'declining' },
  STABLE: { glyph: '–', tone: 'var(--dr-ink-faint)', label: 'steady' },
};

const SET_LABEL: Record<ColumnSet, string> = {
  value: 'Value',
  production: 'Production',
  usage: 'Usage',
  market: 'Market',
};

/**
 * The dense board. Six hundred players is too many to browse as cards, so this
 * is the view for working: every column sortable, roughly thirty rows a screen,
 * and the same click target as a card.
 */
export const PlayerTable = ({
  players,
  limit,
  selectedId,
  watchlist,
  pinned,
  columns,
  sort,
  descending,
  onSort,
  onColumns,
  onSelect,
  onToggleWatch,
  onTogglePin,
  adjust,
}: PlayerTableProps) => {
  const active = SETS[columns];

  const rows = useMemo(() => {
    const compare = SORTS[sort] ?? SORTS.rank;
    const sorted = [...players].sort((a, b) => compare(a, b, adjust));
    return descending ? sorted.reverse() : sorted;
  }, [players, sort, descending, adjust]);

  // Slice after sorting, and only for rendering: `maxima` below still measures
  // the whole field, so a bar means the same thing however much is on screen.
  const visible = useMemo(() => (limit ? rows.slice(0, limit) : rows), [rows, limit]);

  // Bars are scaled across what is actually on screen, so filtering to one
  // position rescales them instead of leaving every bar a stub.
  const maxima = useMemo(() => {
    const out = new Map<string, number>();
    for (const column of active) {
      if (!column.bar) continue;
      out.set(
        column.label,
        Math.max(...rows.map((player) => column.bar!(player, adjust) ?? 0), 0.0001)
      );
    }
    return out;
  }, [rows, active, adjust]);

  return (
    <div className="dr-table-wrap">
      <div className="dr-table-sets" role="group" aria-label="Column set">
        <span className="dr-eyebrow">Columns</span>
        <div className="dr-segmented">
          {(Object.keys(SETS) as ColumnSet[]).map((set) => (
            <button
              key={set}
              type="button"
              aria-pressed={columns === set}
              onClick={() => onColumns(set)}
            >
              {SET_LABEL[set]}
            </button>
          ))}
        </div>
      </div>

      <table className="dr-table">
        <thead>
          <tr>
            <th scope="col" className="is-numeric" title="Our rank">
              <button type="button" className="dr-th-button" onClick={() => onSort('rank')}>
                #{sort === 'rank' && <span aria-hidden="true">{descending ? ' ↓' : ' ↑'}</span>}
              </button>
            </th>
            <th scope="col">Pos</th>
            <th scope="col">
              <button type="button" className="dr-th-button" onClick={() => onSort('name')}>
                Player
                {sort === 'name' && <span aria-hidden="true">{descending ? ' ↓' : ' ↑'}</span>}
              </button>
            </th>
            {active.map((column) => (
              <th
                key={column.label}
                scope="col"
                title={column.title}
                className={column.numeric ? 'is-numeric' : undefined}
                aria-sort={
                  column.key === sort ? (descending ? 'descending' : 'ascending') : undefined
                }
              >
                {column.key ? (
                  <button
                    type="button"
                    className="dr-th-button"
                    onClick={() => onSort(column.key!)}
                  >
                    {column.label}
                    {column.key === sort && (
                      <span aria-hidden="true">{descending ? ' ↓' : ' ↑'}</span>
                    )}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
            <th scope="col">Trend</th>
            <th scope="col" title="Spotlight — put him up top">
              <span aria-hidden="true">◎</span>
            </th>
            <th scope="col" title="Watchlist">
              ★
            </th>
            <th scope="col" title="Pin to compare">
              ⇄
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((player) => {
            const identity = getIdentity(player.id);
            const team = identity?.team ?? player.team;
            const trend = TREND_MARK[player.recentTrends] ?? TREND_MARK.STABLE;
            const watched = watchlist.includes(player.id);
            const isPinned = pinned.includes(player.id);

            return (
              <tr
                key={player.id}
                className={player.id === selectedId ? 'is-selected' : undefined}
                data-tier={player.tier}
                onClick={() => onSelect(player)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(player);
                  }
                }}
              >
                <td className="is-numeric dr-num">{player.adp}</td>
                <td>
                  <span
                    className="dr-pos"
                    style={{ background: teamColors(team).primary, color: '#fff' }}
                  >
                    {player.position}
                  </span>
                </td>
                <td className="dr-table-name">
                  <span
                    className="dr-tier-dot"
                    data-tier={player.tier}
                    title={`Tier ${player.tier}`}
                  />
                  {identity?.name ?? player.name}
                  <span className="dr-table-team">{team}</span>
                  {/* Nobody is bidding on him: he is filled in by the snake,
                      which is a different thing from being worth a dollar. */}
                  {!player.onSheet && player.sheetIsStated && (
                    <span className="dr-snake" title="Not on the auction sheet">
                      snake
                    </span>
                  )}
                </td>

                {active.map((column) => {
                  const bar = column.bar?.(player, adjust) ?? null;
                  const max = maxima.get(column.label) ?? 1;
                  return (
                    <td
                      key={column.label}
                      className={column.numeric ? 'is-numeric dr-num' : 'dr-num'}
                      style={column.tone ? { color: column.tone } : undefined}
                    >
                      {bar != null && (
                        <span
                          className="dr-cell-bar"
                          aria-hidden="true"
                          style={{ width: `${Math.max(0, (bar / max) * 100)}%` }}
                        />
                      )}
                      <span className="dr-cell-value">{column.read?.(player, adjust) ?? '—'}</span>
                    </td>
                  );
                })}

                <td style={{ color: trend.tone }} title={trend.label}>
                  {trend.glyph}
                </td>
                <td>
                  <button
                    type="button"
                    className="dr-star dr-spot"
                    aria-label={`Spotlight ${player.name} — put him up top`}
                    title="Spotlight — put him up top"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(player);
                    }}
                  >
                    ◎
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="dr-star"
                    aria-pressed={watched}
                    aria-label={watched ? `Stop watching ${player.name}` : `Watch ${player.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleWatch(player.id);
                    }}
                  >
                    {watched ? '★' : '☆'}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={`dr-star dr-pin${isPinned ? ' is-pinned' : ''}`}
                    aria-pressed={isPinned}
                    aria-label={isPinned ? `Unpin ${player.name}` : `Pin ${player.name} to compare`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePin(player.id);
                    }}
                  >
                    ⇄
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
