import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Player } from '@/services/auctionDraftService';
import { researchMark } from '@/services/playerResearch';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';

interface PlayerCardProps {
  player: Player;
  selected: boolean;
  /**
   * Whether the research file has finished loading.
   *
   * The marks themselves live in a module-level map that is filled once and
   * never changes, so a card reads them directly rather than being handed an
   * object — an object prop would be a new reference on every render and would
   * defeat the memo this list depends on. This boolean flips false to true
   * exactly once, which re-renders the board a single time with the marks in.
   */
  researchReady?: boolean;
  watched: boolean;
  onSelect: (player: Player) => void;
  onToggleWatch: (playerId: string) => void;
  onTogglePin: (playerId: string) => void;
  pinned: boolean;
}

/** Readable ink for a team color, so light jerseys don't get white-on-white. */
const inkFor = (hex: string): string => {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#0b0f17' : '#ffffff';
};

const RISK_COLOR: Record<Player['injuryRisk'], string> = {
  LOW: 'var(--dr-value)',
  MEDIUM: 'var(--dr-caution)',
  HIGH: 'var(--dr-danger)',
};

/**
 * One card on the board.
 *
 * Wrapped in `memo` because the board holds 628 of these and React re-renders
 * the whole list on every keystroke in the search box and every pick made.
 * Unmemoised that cost roughly a second of frozen interface per nomination on
 * an ordinary laptop; each card also resolves its identity and team colours, so
 * the work is not trivial per instance.
 */
const PlayerCardView = ({
  player,
  selected,
  researchReady = false,
  watched,
  pinned,
  onSelect,
  onToggleWatch,
  onTogglePin,
}: PlayerCardProps) => {
  const identity = getIdentity(player.id);
  const mark = researchReady ? researchMark(player.id) : null;
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);

  const percentiles = player.percentiles ?? {};
  const usage = player.usage;
  const edge = player.market?.edge ?? null;

  // Receivers and backs earn their touches differently, so the card shows the
  // measure that actually describes the role rather than a fixed trio.
  const signals: Array<{ label: string; value: string; percentile?: number; title: string }> = [];
  if (player.snapPercentage != null) {
    signals.push({
      label: 'Snaps',
      value: `${Math.round(player.snapPercentage)}%`,
      percentile: percentiles.snapShare,
      title: `${Math.round(player.snapPercentage)}% of offensive snaps${percentiles.snapShare != null ? ` — ${percentiles.snapShare}th percentile among ${player.position}s` : ''}`,
    });
  }
  if (usage?.targetShare != null && player.position !== 'RB') {
    signals.push({
      label: 'Tgt%',
      value: `${usage.targetShare}%`,
      percentile: percentiles.targetShare,
      title: `${usage.targetShare}% of his team's targets${percentiles.targetShare != null ? ` — ${percentiles.targetShare}th percentile` : ''}`,
    });
  } else if (usage?.carryShare != null) {
    signals.push({
      label: 'Car%',
      value: `${usage.carryShare}%`,
      percentile: percentiles.carryShare,
      title: `${usage.carryShare}% of his team's carries${percentiles.carryShare != null ? ` — ${percentiles.carryShare}th percentile` : ''}`,
    });
  }
  if (usage?.redZoneTouches) {
    signals.push({
      label: 'RZ',
      value: String(usage.redZoneTouches),
      percentile: percentiles.redZoneTouches,
      title: `${usage.redZoneTouches} red-zone touches in ${usage.season}${percentiles.redZoneTouches != null ? ` — ${percentiles.redZoneTouches}th percentile` : ''}`,
    });
  }

  const style = {
    '--dr-accent': primary,
    '--dr-accent-ink': inkFor(primary),
  } as CSSProperties;

  return (
    <button
      type="button"
      className="dr-card"
      style={style}
      aria-selected={selected}
      onClick={() => onSelect(player)}
    >
      <span className="dr-tier dr-num">T{player.tier}</span>
      {mark && mark.direction !== 'NEUTRAL' && (
        <span
          className="dr-card-research dr-research-mark"
          style={{ color: mark.direction === 'PAY_UP' ? 'var(--dr-value)' : 'var(--dr-danger)' }}
          title={`${mark.headline || 'Sourced findings'} — open the Research tab`}
          aria-label={`Research: ${mark.direction === 'PAY_UP' ? 'pay up' : 'fade'}`}
        >
          {mark.direction === 'PAY_UP' ? '↑' : '↓'}
        </span>
      )}
      <span
        className="dr-card-star dr-star"
        role="button"
        tabIndex={0}
        aria-pressed={watched}
        aria-label={watched ? `Stop watching ${player.name}` : `Watch ${player.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleWatch(player.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onToggleWatch(player.id);
          }
        }}
      >
        {watched ? '★' : '☆'}
      </span>
      <span
        className={`dr-card-pin${pinned ? ' is-pinned' : ''}`}
        role="button"
        tabIndex={0}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${player.name}` : `Pin ${player.name} to compare`}
        title={pinned ? 'Pinned for comparison' : 'Pin to compare'}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePin(player.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onTogglePin(player.id);
          }
        }}
      >
        ⇄
      </span>

      <div className="dr-card-head">
        {logo && <img className="dr-card-logo" src={logo} alt="" aria-hidden="true" />}
        <Headshot
          identity={identity}
          fallbackName={player.name}
          width={124}
          className="dr-card-photo"
        />
        <span
          className="dr-flag"
          style={{ background: RISK_COLOR[player.injuryRisk] }}
          title={`${player.injuryRisk.toLowerCase()} injury risk`}
        />
      </div>

      <span className="dr-card-name">{identity?.name ?? player.name}</span>
      <span className="dr-card-meta">
        <span className="dr-pos">{player.position}</span>
        {team}
        {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
      </span>

      <dl className="dr-card-stats">
        <div className="dr-card-stat">
          <dt>Value</dt>
          <dd
            style={{ color: 'var(--dr-value)' }}
            className={player.customRanking ? 'dr-custom-value' : undefined}
            title={
              player.customRanking ? `Your ranking. Ours says $${player.modelValue}.` : undefined
            }
          >
            ${player.estimatedValue}
          </dd>
        </div>
        <div className="dr-card-stat">
          <dt>Proj</dt>
          <dd>{player.projectedPoints}</dd>
        </div>
        <div className="dr-card-stat">
          <dt>Rank</dt>
          <dd>{player.adp}</dd>
        </div>
      </dl>

      {/* The three numbers that explain the projection, each with its standing
          in the position — a share means nothing without one. */}
      <div className="dr-card-signals">
        {signals.map((signal) => (
          <span className="dr-card-signal" key={signal.label} title={signal.title}>
            <em>{signal.label}</em>
            <span className="dr-num">{signal.value}</span>
            <span
              className="dr-card-signal-bar"
              aria-hidden="true"
              style={{ width: `${signal.percentile ?? 0}%` }}
            />
          </span>
        ))}
      </div>

      {edge != null && Math.abs(edge) >= 8 && (
        <span
          className="dr-card-edge"
          style={{ color: edge > 0 ? 'var(--dr-value)' : 'var(--dr-caution)' }}
          title={
            edge > 0
              ? `Expert consensus ranks him ${edge} spots below our board`
              : `Expert consensus ranks him ${Math.abs(edge)} spots above our board`
          }
        >
          {edge > 0
            ? `${edge} spots cheaper than consensus`
            : `${Math.abs(edge)} spots hotter than us`}
        </span>
      )}
    </button>
  );
};

/**
 * Re-render only when something about this card actually changed.
 *
 * The board hands every card the same stable callbacks, so this comes down to
 * the player object, whether it is selected, watched or pinned. Reference
 * equality on the player is right: the engine returns fresh arrays on every
 * sync, but the player objects inside are the same instances unless the draft
 * moved them.
 */
export const PlayerCard = memo(PlayerCardView);
