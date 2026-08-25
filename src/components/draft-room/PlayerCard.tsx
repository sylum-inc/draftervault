import type { CSSProperties } from 'react';
import type { Player } from '@/services/auctionDraftService';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';

interface PlayerCardProps {
  player: Player;
  selected: boolean;
  watched: boolean;
  onSelect: (player: Player) => void;
  onToggleWatch: (playerId: string) => void;
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

export const PlayerCard = ({
  player,
  selected,
  watched,
  onSelect,
  onToggleWatch,
}: PlayerCardProps) => {
  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);

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
          <dd style={{ color: 'var(--dr-value)' }}>${player.estimatedValue}</dd>
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
    </button>
  );
};
