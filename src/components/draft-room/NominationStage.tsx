import type { CSSProperties } from 'react';
import type {
  BidCheck,
  DraftAnalytics,
  DraftPhase,
  Player,
  SnakeSlot,
  Team,
} from '@/services/auctionDraftService';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';
import { RangeBar } from './charts/RangeBar';

interface NominationStageProps {
  /**
   * Which half of the draft this stage is running, and the structural branch
   * of the whole component.
   *
   * It is deliberately the *only* phase-shaped prop. Two panels of controls
   * that differ in what they ask for — a price, or nothing at all — is one
   * decision, and splitting it across a second flag is how the bid box comes
   * back for a pick that has no price. Everything else here is a plain fact
   * that one mode or the other happens to use.
   */
  mode: DraftPhase;
  player: Player | null;
  teams: Team[];
  teamId: string;
  bid: string;
  analytics: DraftAnalytics | null;
  /**
   * Whether this transaction is legal. The engine answers it for both halves in
   * the same typed shape — `validateBid` in the auction, `validateSnakePick` in
   * the snake — and this renders whichever came back verbatim.
   */
  check: BidCheck | null;
  onTeamChange: (teamId: string) => void;
  onBidChange: (bid: string) => void;
  /** Sell at the bid, or take the pick. The room decides which by phase. */
  onConfirm: () => void;
  onOpenProfile: () => void;
  /** Whether a team still has room; a full one cannot win the bidding. */
  canDraft: (team: Team) => boolean;
  /** Whose turn it is in the snake, with the round and pick it falls on. */
  onTheClock?: SnakeSlot;
  /**
   * Sheet players still to sell or be passed over. Null when no sheet is in
   * force, which is also when there is no snake phase to count down to.
   */
  sheetRemaining: number | null;
  /**
   * Nobody bid a dollar. Marks the player passed over rather than striking him
   * off, which is what eventually ends the auction — one player nobody calls
   * would otherwise hold the room in an auction the table left long ago.
   */
  onUnsold: () => void;
  /** Put a player the room passed over back up for bidding. */
  onReturnToSheet: () => void;
  /** Whether this player has already been passed over. */
  passedOver: boolean;
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
  mode,
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
  onTheClock,
  sheetRemaining,
  onUnsold,
  onReturnToSheet,
  passedOver,
}: NominationStageProps) => {
  const snake = mode === 'snake';

  if (!player) {
    return (
      <section className="dr-panel dr-stage is-empty" aria-label="Nomination">
        {snake && onTheClock && (
          <p className="dr-eyebrow" style={{ marginBottom: 8 }}>
            {/* Both numbers, because they diverge and each is the answer to a
                different question. `pick` is the seat on the printed board;
                `overall` is what somebody at the table actually calls out. A
                team that filled its roster at auction still owns its seat, so
                with two teams bought out the opening pick of the snake sits in
                seat three — and nobody calls that pick three. */}
            Round {onTheClock.round}, pick {onTheClock.pick} · #{onTheClock.overall} overall ·{' '}
            {onTheClock.team.name} on the clock
          </p>
        )}
        <p className="dr-empty">
          {snake ? (
            <>
              The auction is over. Pick a player from the board to hand him to the team on the
              clock.
              <br />
              Nothing costs anything from here.
            </>
          ) : (
            <>
              Pick a player from the board to put them up for auction.
              <br />
              Their valuation and bid controls appear here.
            </>
          )}
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
    <section
      className="dr-panel dr-stage"
      style={style}
      aria-label={snake ? `Snake pick: ${player.name}` : `Nomination: ${player.name}`}
    >
      {snake && onTheClock && (
        <p className="dr-stage-clock">
          <span className="dr-eyebrow">
            Round {onTheClock.round} · pick {onTheClock.pick} · #{onTheClock.overall} overall
          </span>
          <strong>{onTheClock.team.name}</strong>
          <span className="dr-eyebrow">on the clock</span>
        </p>
      )}

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
        {/* Money in the auction, the board in the snake. A price and a ceiling
            are the two numbers that decide a bid; neither says anything about a
            pick that costs nothing, where the question is where he ranks and
            what he is projected to do. */}
        {snake ? (
          <>
            <div className="dr-tile">
              <dt>Our rank</dt>
              <dd style={{ color: 'var(--dr-value)' }}>#{player.adp}</dd>
            </div>
            <div className="dr-tile">
              <dt>Bye</dt>
              <dd>{player.byeWeek || '—'}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="dr-tile">
              <dt>Est. value</dt>
              <dd style={{ color: 'var(--dr-value)' }}>${player.estimatedValue}</dd>
            </div>
            <div className="dr-tile">
              <dt>Max bid</dt>
              <dd>${analytics ? Math.round(analytics.maxBid) : '—'}</dd>
            </div>
          </>
        )}
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
        {snake ? (
          // Nobody chooses a team in the snake: the order chose it, and offering
          // a select here would be offering a choice the engine will refuse.
          <p className="dr-verdict">
            <span>Goes to</span>
            <strong>{onTheClock?.team.name ?? '—'}</strong>
          </p>
        ) : (
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
        )}

        {!snake && (
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
        )}

        {/* A verdict against our number is a statement about a price. There is
            no price in the snake, so there is nothing to be above or below. */}
        {!snake && (
          <p className="dr-verdict">
            <span>Against our number</span>
            <strong style={{ color: verdict.tone }}>{verdict.label}</strong>
          </p>
        )}

        {rejection && (
          <p className="dr-notice" role="status">
            {rejection.message}
          </p>
        )}

        {snake ? (
          <button
            // The auction hands focus to the winning-team select after a
            // nomination; the snake has no select, so the confirm button is
            // what the keyboard lands on and Enter still records the pick.
            id="dr-snake-draft"
            type="submit"
            className="dr-button dr-button-primary"
            disabled={!!rejection || !onTheClock}
          >
            Draft to {onTheClock?.team.name ?? 'nobody'}
          </button>
        ) : (
          <>
            <button
              type="submit"
              className="dr-button dr-button-primary"
              disabled={!!rejection || !teamId}
            >
              Sold — ${Number.isFinite(amount) ? amount : 0}
            </button>

            {/* The auction cannot end while one player nobody called is still
                waiting to be sold, and somebody has to be able to say so. It
                marks him passed over rather than striking him off, because the
                sheet's length is the league's auctioned count and shortening it
                would re-price the room mid-auction. Only for a player who is on
                the sheet: nobody bids on the other five hundred either, and
                there is nothing to pass over. */}
            {/* Passing a player over is the only control in the room that can
                end the auction, and it used to be one unconfirmed click with no
                way back: undo pops the pick log, so it takes back an unrelated
                sale instead, and a reset keeps the mark. A mis-click on the last
                unsold name ended the auction and left a $54 player to be taken
                for nothing. So the inverse is offered in the same slot, and the
                click that ends the auction asks first. */}
            {sheetRemaining != null && player.onSheet && !passedOver && (
              <button
                type="button"
                className="dr-button"
                onClick={() => {
                  if (
                    sheetRemaining > 1 ||
                    window.confirm(
                      `${player.name} is the last name on the sheet. Passing him over ends the auction and opens the snake draft.`
                    )
                  ) {
                    onUnsold();
                  }
                }}
                style={{ justifyContent: 'center' }}
                title="Mark him passed over — he goes to the snake instead"
              >
                Nobody bid · {sheetRemaining} left on the sheet
              </button>
            )}
            {player.onSheet && passedOver && (
              <button
                type="button"
                className="dr-button"
                onClick={onReturnToSheet}
                style={{ justifyContent: 'center' }}
                title="The room came back to him — put him up for bidding again"
              >
                Put him back up
              </button>
            )}
          </>
        )}

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
