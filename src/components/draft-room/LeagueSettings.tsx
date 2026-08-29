import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LEAGUE_LIMITS,
  LINEUP_SLOTS,
  RECEPTION_SCORING,
  POSITIONS,
  leagueShape,
  normaliseLeague,
  rosteredForTeams,
  sameLeague,
  startingSlots,
  type LeagueShape,
  type LineupSlot,
  type Position,
} from '@/lib/valuation';

interface LeagueSettingsProps {
  /** Every team, so they can be named and one marked as yours. */
  teamList: Array<{ id: string; name: string }>;
  myTeamId: string | null;
  /** Applies at once — a name changes no price, so nothing is re-priced. */
  onRenameTeam: (teamId: string, name: string) => void;
  onSetMyTeam: (teamId: string | null) => void;
  league: LeagueShape;
  /** The shape the shipped pool was priced for, for showing what has moved. */
  poolLeague: LeagueShape;
  /** Picks that would be lost, so the warning can be honest about the cost. */
  draftedCount: number;
  /** Players the pool actually holds per position, to catch a league it cannot serve. */
  poolDepth: Record<string, number>;
  onApply: (league: LeagueShape) => void;
  onClose: () => void;
}

/** A whole number pulled from an input that may be mid-edit and therefore empty. */
const asNumber = (raw: string, fallback: number): number => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * The league every price on the board assumes.
 *
 * Changing it is not a display setting: replacement level, value over
 * replacement and every dollar figure are computed from these numbers, so this
 * panel re-prices the whole pool rather than relabelling it. It says so, and it
 * says what a change costs before making it.
 */
export const LeagueSettings = ({
  teamList,
  myTeamId,
  onRenameTeam,
  onSetMyTeam,
  league,
  poolLeague,
  draftedCount,
  poolDepth,
  onApply,
  onClose,
}: LeagueSettingsProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [teams, setTeams] = useState(String(league.teams));
  const [budget, setBudget] = useState(String(league.budget));
  const [rosterSize, setRosterSize] = useState(String(league.rosterSize));
  const [receptionPoints, setReceptionPoints] = useState(league.receptionPoints);
  const [lineup, setLineup] = useState<Record<LineupSlot, string>>(
    () =>
      Object.fromEntries(
        LINEUP_SLOTS.map((slot) => [slot, String(league.startingLineup[slot] ?? 0)])
      ) as Record<LineupSlot, string>
  );
  const [limits, setLimits] = useState<Record<Position, string>>(
    () =>
      Object.fromEntries(POSITIONS.map((p) => [p, String(league.positionLimits[p])])) as Record<
        Position,
        string
      >
  );

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const draft = useMemo<LeagueShape>(() => {
    const teamCount = asNumber(teams, league.teams);
    return normaliseLeague(
      leagueShape({
        teams: teamCount,
        budget: asNumber(budget, league.budget),
        rosterSize: asNumber(rosterSize, league.rosterSize),
        receptionPoints,
        startingLineup: Object.fromEntries(
          LINEUP_SLOTS.map((slot) => [
            slot,
            Math.max(0, asNumber(lineup[slot], league.startingLineup[slot] ?? 0)),
          ])
        ) as Record<LineupSlot, number>,
        positionLimits: Object.fromEntries(
          POSITIONS.map((p) => [p, Math.max(0, asNumber(limits[p], league.positionLimits[p]))])
        ) as Record<Position, number>,
        // Replacement level scales with the league unless the pool was built
        // for this exact size, in which case its own table is the better answer.
        rostered:
          teamCount === poolLeague.teams ? poolLeague.rostered : rosteredForTeams(teamCount),
      })
    );
  }, [teams, budget, rosterSize, lineup, limits, receptionPoints, league, poolLeague]);

  // Read from the pool rather than written into the copy: the last hardcoded
  // count went stale the first time the pool grew.
  const poolSize = POSITIONS.reduce((total, position) => total + (poolDepth[position] ?? 0), 0);

  const unchanged = sameLeague(draft, league);
  const rosterSlots = draft.teams * draft.rosterSize;
  const money = draft.teams * draft.budget;
  // What is actually biddable: every roster spot must be covered by a dollar.
  const surplus = money - rosterSlots;
  const positionCapacity = POSITIONS.reduce((total, p) => total + draft.positionLimits[p], 0);

  const problems: string[] = [];
  if (surplus <= 0)
    problems.push(
      `$${money} of budget cannot fill ${rosterSlots} roster spots at a dollar each — every player would price at $1.`
    );
  if (positionCapacity < draft.rosterSize)
    problems.push(
      `Position limits total ${positionCapacity}, so a team could never fill ${draft.rosterSize} roster spots.`
    );
  const slots = startingSlots(draft);
  if (slots > draft.rosterSize)
    problems.push(`A team would start ${slots} players but may only roster ${draft.rosterSize}.`);
  if (slots === 0) problems.push('A league has to start somebody.');

  /**
   * Positions the pool cannot fill at this league size.
   *
   * Not an error — the valuation falls back to the worst player it has — but it
   * quietly understates that position, and nothing on the board would show it.
   */
  const thin = POSITIONS.map((position) => ({
    position,
    has: poolDepth[position] ?? 0,
    wants: draft.rostered[position],
  })).filter((entry) => entry.has > 0 && entry.has < entry.wants);

  const apply = () => {
    if (problems.length || unchanged) return;
    onApply(draft);
  };

  const field = (
    label: string,
    value: string,
    set: (next: string) => void,
    hint: string,
    min: number,
    max: number
  ) => (
    <label className="dr-league-field" key={label}>
      <span className="dr-eyebrow">{label}</span>
      <input
        className="dr-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
      <span className="dr-meter-note">{hint}</span>
    </label>
  );

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="League settings">
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close league settings"
        onClick={onClose}
      />

      <article className="dr-modal-panel dr-league">
        <header className="dr-results-head">
          <div>
            <h2 className="dr-stage-name" style={{ fontSize: 26 }}>
              League settings
            </h2>
            <p className="dr-meter-note">
              Every dollar value on the board is computed from these numbers — change one and all{' '}
              {poolSize} players are re-priced, not relabelled.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <section className="dr-modal-section">
          <div className="dr-league-grid">
            {field(
              'Teams',
              teams,
              setTeams,
              'Sets replacement level',
              LEAGUE_LIMITS.teams.min,
              LEAGUE_LIMITS.teams.max
            )}
            {field(
              'Budget',
              budget,
              setBudget,
              'Per team, in dollars',
              LEAGUE_LIMITS.budget.min,
              LEAGUE_LIMITS.budget.max
            )}
            {field(
              'Roster',
              rosterSize,
              setRosterSize,
              'Spots per team',
              LEAGUE_LIMITS.rosterSize.min,
              LEAGUE_LIMITS.rosterSize.max
            )}
          </div>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">
            Starting lineup · {slots} slot{slots === 1 ? '' : 's'}
          </h3>
          <p className="dr-meter-note">
            What decides which positions go early: a dollar is held back for every open slot, and an
            unfilled one is what makes a position urgent. A flex counts for each of RB, WR and TE,
            since any of them can fill it.
          </p>
          <div className="dr-league-grid">
            {LINEUP_SLOTS.map((slot) => (
              <label className="dr-league-field" key={slot}>
                <span className="dr-eyebrow">{slot}</span>
                <input
                  className="dr-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={12}
                  value={lineup[slot]}
                  onChange={(event) =>
                    setLineup((current) => ({ ...current, [slot]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Most a team may carry</h3>
          <div className="dr-league-grid">
            {POSITIONS.map((position) => (
              <label className="dr-league-field" key={position}>
                <span className="dr-eyebrow">{position}</span>
                <input
                  className="dr-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={40}
                  value={limits[position]}
                  onChange={(event) =>
                    setLimits((current) => ({ ...current, [position]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Scoring</h3>
          <p className="dr-meter-note">
            What a catch is worth is the biggest single lever in fantasy scoring — a hundred-catch
            receiver is a hundred points apart between the ends of it. The pool is generated at full
            PPR; anything else is priced by taking those points back out.
          </p>
          <div className="dr-scoring">
            {RECEPTION_SCORING.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`dr-scoring-option${receptionPoints === option.value ? ' is-on' : ''}`}
                aria-pressed={receptionPoints === option.value}
                onClick={() => setReceptionPoints(option.value)}
              >
                <span className="dr-scoring-name">{option.label}</span>
                <span className="dr-meter-note">{option.hint}</span>
              </button>
            ))}
          </div>
          {receptionPoints !== poolLeague.receptionPoints && (
            <p className="dr-meter-note">
              Every projection on the board is restated for this, so pass-catchers and runners trade
              places against each other. Nothing is regenerated.
            </p>
          )}
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Who is in the league</h3>
          <p className="dr-meter-note">
            Names apply straight away and re-price nothing — the draft is untouched. Marking your
            own team is what lets the rest of the room be read as opponents.
          </p>
          <div className="dr-owners">
            {teamList.map((team, index) => (
              <div className="dr-owner-row" key={team.id}>
                <button
                  type="button"
                  className={`dr-owner-mine${team.id === myTeamId ? ' is-mine' : ''}`}
                  aria-pressed={team.id === myTeamId}
                  title={team.id === myTeamId ? 'This is your team' : 'Mark this as your team'}
                  onClick={() => onSetMyTeam(team.id === myTeamId ? null : team.id)}
                >
                  {team.id === myTeamId ? 'you' : String(index + 1)}
                </button>
                <input
                  className="dr-input"
                  value={team.name}
                  maxLength={40}
                  aria-label={`Name for team ${index + 1}`}
                  onChange={(event) => onRenameTeam(team.id, event.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">What this league buys</h3>
          <dl className="dr-league-summary">
            <div>
              <dt>On the table</dt>
              <dd>${money.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Roster spots</dt>
              <dd>{rosterSlots}</dd>
            </div>
            <div>
              <dt>Above the minimum</dt>
              <dd style={{ color: surplus > 0 ? 'var(--dr-value)' : 'var(--dr-danger)' }}>
                ${surplus.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt>Rostered at WR</dt>
              <dd>{draft.rostered.WR}</dd>
            </div>
          </dl>
          <p className="dr-meter-note">
            The surplus is what bidding actually competes over: each of the {rosterSlots} spots is
            covered by a dollar first, and what is left is shared out by value over replacement.
          </p>
        </section>

        {thin.length > 0 && problems.length === 0 && (
          <section className="dr-modal-section">
            <p className="dr-league-warning">
              This league rosters{' '}
              {thin
                .map(
                  (entry) => `${entry.wants} ${entry.position}s where the pool holds ${entry.has}`
                )
                .join(', and ')}
              . Replacement level falls back to the worst one there is, so those values come out
              lower than a deeper pool would set them. Every other position is unaffected.
            </p>
          </section>
        )}

        {problems.length > 0 && (
          <section className="dr-modal-section">
            <ul className="dr-league-problems">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </section>
        )}

        {draftedCount > 0 && !unchanged && problems.length === 0 && (
          <section className="dr-modal-section">
            <p className="dr-league-warning">
              {draftedCount} pick{draftedCount === 1 ? '' : 's'} will be cleared. Those bids were
              made against prices this league does not charge, so replaying them would build a
              roster nobody could have bought.
            </p>
          </section>
        )}

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            onClick={apply}
            disabled={unchanged || problems.length > 0}
          >
            {unchanged ? 'No change' : 'Apply and re-price'}
          </button>
          <button type="button" className="dr-button" onClick={onClose}>
            Cancel
          </button>
          {!sameLeague(league, poolLeague) && (
            <button type="button" className="dr-button" onClick={() => onApply(poolLeague)}>
              Back to {poolLeague.teams} × ${poolLeague.budget}
            </button>
          )}
        </div>
      </article>
    </div>
  );
};
