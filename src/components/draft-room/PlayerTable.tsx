import { useMemo } from 'react';
import type { Player } from '@/services/auctionDraftService';
import { getIdentity, teamColors } from '@/services/nflIdentity';

export type TableSort =
  | 'rank'
  | 'value'
  | 'projected'
  | 'vorp'
  | 'bye'
  | 'snap'
  | 'consistency'
  | 'name';

interface PlayerTableProps {
  players: Player[];
  selectedId?: string;
  watchlist: string[];
  sort: TableSort;
  descending: boolean;
  onSort: (sort: TableSort) => void;
  onSelect: (player: Player) => void;
  onToggleWatch: (playerId: string) => void;
}

interface Column {
  key: TableSort | null;
  label: string;
  /** Right-aligned numeric column. */
  numeric?: boolean;
  title?: string;
}

const COLUMNS: Column[] = [
  { key: 'rank', label: '#', numeric: true, title: 'Our rank' },
  { key: null, label: 'Pos' },
  { key: 'name', label: 'Player' },
  { key: 'value', label: '$', numeric: true, title: 'Auction value' },
  { key: 'projected', label: 'Proj', numeric: true, title: 'Projected PPR points' },
  { key: 'vorp', label: 'VORP', numeric: true, title: 'Value over replacement' },
  { key: 'bye', label: 'Bye', numeric: true },
  { key: 'snap', label: 'Snap', numeric: true, title: 'Snap share last season' },
  { key: 'consistency', label: 'Cons', numeric: true, title: 'Week-to-week consistency, 1-10' },
  { key: null, label: 'Trend' },
  { key: null, label: '★', title: 'Watchlist' },
];

const SORTS: Record<TableSort, (a: Player, b: Player) => number> = {
  rank: (a, b) => a.adp - b.adp,
  value: (a, b) => a.estimatedValue - b.estimatedValue,
  projected: (a, b) => a.projectedPoints - b.projectedPoints,
  vorp: (a, b) => a.valueOverReplacement - b.valueOverReplacement,
  bye: (a, b) => (a.byeWeek ?? 99) - (b.byeWeek ?? 99),
  snap: (a, b) => (a.snapPercentage ?? -1) - (b.snapPercentage ?? -1),
  consistency: (a, b) => (a.consistency ?? -1) - (b.consistency ?? -1),
  name: (a, b) => a.name.localeCompare(b.name),
};

const TREND_MARK: Record<string, { glyph: string; tone: string; label: string }> = {
  RISING: { glyph: '▲', tone: 'var(--dr-value)', label: 'rising' },
  DECLINING: { glyph: '▼', tone: 'var(--dr-danger)', label: 'declining' },
  STABLE: { glyph: '–', tone: 'var(--dr-ink-faint)', label: 'steady' },
};

/**
 * The dense board. Six hundred players is too many to browse as cards, so this
 * is the view for working: every column sortable, roughly thirty rows a screen,
 * and the same click target as a card.
 */
export const PlayerTable = ({
  players,
  selectedId,
  watchlist,
  sort,
  descending,
  onSort,
  onSelect,
  onToggleWatch,
}: PlayerTableProps) => {
  const rows = useMemo(() => {
    const sorted = [...players].sort(SORTS[sort]);
    return descending ? sorted.reverse() : sorted;
  }, [players, sort, descending]);

  return (
    <div className="dr-table-wrap">
      <table className="dr-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
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
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => {
            const identity = getIdentity(player.id);
            const team = identity?.team ?? player.team;
            const trend = TREND_MARK[player.recentTrends] ?? TREND_MARK.STABLE;
            const watched = watchlist.includes(player.id);

            return (
              <tr
                key={player.id}
                className={player.id === selectedId ? 'is-selected' : undefined}
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
                </td>
                <td className="is-numeric dr-num" style={{ color: 'var(--dr-value)' }}>
                  ${player.estimatedValue}
                </td>
                <td className="is-numeric dr-num">{player.projectedPoints}</td>
                <td className="is-numeric dr-num">{player.valueOverReplacement}</td>
                <td className="is-numeric dr-num">{player.byeWeek || '—'}</td>
                <td className="is-numeric dr-num">
                  {player.snapPercentage != null ? `${Math.round(player.snapPercentage)}%` : '—'}
                </td>
                <td className="is-numeric dr-num">{player.consistency ?? '—'}</td>
                <td style={{ color: trend.tone }} title={trend.label}>
                  {trend.glyph}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
