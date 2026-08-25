import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LEAGUE_LIMITS,
  POSITIONS,
  leagueShape,
  normaliseLeague,
  rosteredForTeams,
  sameLeague,
  type LeagueShape,
  type Position,
} from '@/lib/valuation';

interface LeagueSettingsProps {
  league: LeagueShape;
  /** The shape the shipped pool was priced for, for showing what has moved. */
  poolLeague: LeagueShape;
  /** Picks that would be lost, so the warning can be honest about the cost. */
  draftedCount: number;
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
 * panel re-prices 599 players rather than relabelling them. It says so, and it
 * says what a change costs before making it.
 */
export const LeagueSettings = ({
  league,
  poolLeague,
  draftedCount,
  onApply,
  onClose,
}: LeagueSettingsProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [teams, setTeams] = useState(String(league.teams));
  const [budget, setBudget] = useState(String(league.budget));
  const [rosterSize, setRosterSize] = useState(String(league.rosterSize));
  const [starters, setStarters] = useState(String(league.starters));
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
        starters: asNumber(starters, league.starters),
        positionLimits: Object.fromEntries(
          POSITIONS.map((p) => [p, Math.max(0, asNumber(limits[p], league.positionLimits[p]))])
        ) as Record<Position, number>,
        // Replacement level scales with the league unless the pool was built
        // for this exact size, in which case its own table is the better answer.
        rostered:
          teamCount === poolLeague.teams ? poolLeague.rostered : rosteredForTeams(teamCount),
      })
    );
  }, [teams, budget, rosterSize, starters, limits, league, poolLeague]);

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
  if (draft.starters > draft.rosterSize)
    problems.push('A team cannot be required to start more players than it may roster.');

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
              Every dollar value on the board is computed from these numbers — change one and 599
              players are re-priced, not relabelled.
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
            {field(
              'Starters',
              starters,
              setStarters,
              'A dollar held per open slot',
              0,
              asNumber(rosterSize, league.rosterSize)
            )}
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
