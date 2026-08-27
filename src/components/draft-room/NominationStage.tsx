import type { CSSProperties } from 'react';
import type { BidCheck, DraftAnalytics, Player, Team } from '@/services/auctionDraftService';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';
import { RangeBar } from './charts/RangeBar';

interface NominationStageProps {
  player: Player | null;
  teams: Team[];
  teamId: string;
  bid: string;
  analytics: DraftAnalytics | null;
  check: BidCheck | null;
  onTeamChange: (teamId: string) => void;
  onBidChange: (bid: string) => void;
  onConfirm: () => void;
  onOpenProfile: () => void;
  /** Whether a team still has room; a full one cannot win the bidding. */
  canDraft: (team: Team) => boolean;
}

const inkFor = (hex: string): string => {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0b0f17' : '#ffffff';
};

/** How this bid compares to the model's number, in plain words. */
const verdictFor = (
  bid: number,
  analytics: DraftAnalytics | null
): { label: string; tone: string } => {
  if (!analytics || !Number.isFinite(bid) || bid < 1)
    return { label: '—', tone: 'var(--dr-ink-muted)' };
  const value = analytics.adjustedValue;
  if (bid <= value * 0.85) return { label: 'Below value', tone: 'var(--dr-value)' };
  if (bid <= value * 1.05) return { label: 'At value', tone: 'var(--dr-ink)' };
  if (bid <= analytics.maxBid) return { label: 'Premium', tone: 'var(--dr-caution)' };
  return { label: 'Overpay', tone: 'var(--dr-danger)' };
};

export const NominationStage = ({
  player,
  teams,
  teamId,
  bid,
  analytics,
  check,
  onTeamChange,
  onBidChange,
  onConfirm,
  onOpenProfile,
  canDraft,
}: NominationStageProps) => {
  if (!player) {
    return (
      <section className="dr-panel dr-stage is-empty" aria-label="Nomination">
        <p className="dr-empty">
          Pick a player from the board to put them up for auction.
          <br />
          Their valuation and bid controls appear here.
        </p>
      </section>
    );
  }

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);
  const amount = Number.parseInt(bid, 10);
  const verdict = verdictFor(amount, analytics);
  const rejection = check && !check.ok ? check : null;

  const style = { '--dr-accent': primary, '--dr-accent-ink': inkFor(primary) } as CSSProperties;
  const step = (delta: number) =>
    onBidChange(String(Math.max(1, (Number.parseInt(bid, 10) || 0) + delta)));

  return (
    <section className="dr-panel dr-stage" style={style} aria-label={`Nomination: ${player.name}`}>
      <div className="dr-stage-hero">
        {logo && <img className="dr-stage-logo" src={logo} alt="" aria-hidden="true" />}
        <Headshot
          identity={identity}
          fallbackName={player.name}
          width={208}
          className="dr-stage-photo"
        />
        <div>
          <h2 className="dr-stage-name">{identity?.name ?? player.name}</h2>
          <p className="dr-stage-sub">
            <span className="dr-pos">{player.position}</span>
            {team}
            {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
            {identity?.age && <span className="dr-num">{identity.age}y</span>}
          </p>
        </div>
      </div>

      <dl className="dr-stage-tiles">
        <div className="dr-tile">
          <dt>Est. value</dt>
          <dd style={{ color: 'var(--dr-value)' }}>${player.estimatedValue}</dd>
        </div>
        <div className="dr-tile">
          <dt>Max bid</dt>
          <dd>${analytics ? Math.round(analytics.maxBid) : '—'}</dd>
        </div>
        <div className="dr-tile">
          <dt>Projected</dt>
          <dd>{player.projectedPoints}</dd>
        </div>
        <div className="dr-tile">
          <dt>VORP</dt>
          <dd>{player.valueOverReplacement}</dd>
        </div>
      </dl>

      <div className="dr-stage-range">
        <RangeBar
          floor={player.floor}
          projection={player.projectedPoints}
          ceiling={player.upside}
          replacement={player.projectedPoints - player.valueOverReplacement || undefined}
        />
        <div className="dr-stage-signals">
          {player.percentiles?.points != null && (
            <span title={`${player.percentiles.points}th percentile among ${player.position}s`}>
              <em>vs {player.position}</em>
              <strong className="dr-num">{player.percentiles.points}th</strong>
            </span>
          )}
          <span>
            <em>Consistency</em>
            <strong className="dr-num">{player.consistency ?? '—'}/10</strong>
          </span>
          <span>
            <em>Snap</em>
            <strong className="dr-num">
              {player.snapPercentage != null ? `${Math.round(player.snapPercentage)}%` : '—'}
            </strong>
          </span>
          <span>
            <em>Trend</em>
            <strong
              style={{
                color:
                  player.recentTrends === 'RISING'
                    ? 'var(--dr-value)'
                    : player.recentTrends === 'DECLINING'
                      ? 'var(--dr-danger)'
                      : 'var(--dr-ink-muted)',
              }}
            >
              {player.recentTrends === 'RISING'
                ? '▲'
                : player.recentTrends === 'DECLINING'
                  ? '▼'
                  : '–'}
            </strong>
          </span>
        </div>
      </div>

      <form
        className="dr-stage-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="dr-field">
          <label className="dr-eyebrow" htmlFor="dr-team">
            Winning team
          </label>
          <select
            id="dr-team"
            className="dr-select"
            value={teamId}
            onChange={(event) => onTeamChange(event.target.value)}
          >
            <option value="">Select a team…</option>
            {teams.map((t) => {
              // A team with no room cannot win anything. It stays in the list
              // so the order never shifts under the cursor mid-auction, but it
              // says why it is unavailable rather than accepting the choice and
              // rejecting the bid afterwards.
              const full = !canDraft(t);
              return (
                <option key={t.id} value={t.id} disabled={full}>
                  {t.name} · {full ? 'roster full' : `$${t.remaining} left`}
                </option>
              );
            })}
          </select>
        </div>

        <div className="dr-field">
          <label className="dr-eyebrow" htmlFor="dr-bid">
            Winning bid
          </label>
          <div className="dr-bid">
            <button
              type="button"
              className="dr-step"
              onClick={() => step(-1)}
              aria-label="Lower bid by one dollar"
            >
              −
            </button>
            <input
              id="dr-bid"
              className="dr-input"
              inputMode="numeric"
              value={bid}
              onChange={(event) => onBidChange(event.target.value.replace(/[^0-9]/g, ''))}
            />
            <button
              type="button"
              className="dr-step"
              onClick={() => step(1)}
              aria-label="Raise bid by one dollar"
            >
              +
            </button>
          </div>
        </div>

        <p className="dr-verdict">
          <span>Against our number</span>
          <strong style={{ color: verdict.tone }}>{verdict.label}</strong>
        </p>

        {rejection && (
          <p className="dr-notice" role="status">
            {rejection.message}
          </p>
        )}

        <button
          type="submit"
          className="dr-button dr-button-primary"
          disabled={!!rejection || !teamId}
        >
          Sold — ${Number.isFinite(amount) ? amount : 0}
        </button>

        <button
          type="button"
          className="dr-button"
          onClick={onOpenProfile}
          style={{ justifyContent: 'center' }}
        >
          Full profile
        </button>
      </form>
    </section>
  );
};
