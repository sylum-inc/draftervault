import type { Player, Team } from '@/services/auctionDraftService';

interface BudgetRailProps {
  teams: Team[];
  /** Every player, so a roster count can say how many of them were bought. */
  players: Player[];
  activeTeamId: string;
}

const rosterSize = (team: Team): number =>
  Object.values(team.roster).reduce((total, count) => total + count, 0);

/**
 * Money left per team.
 *
 * Budget state is encoded twice on purpose — bar length and color — so a team
 * running out reads at a glance without anyone parsing the number.
 *
 * The bars stop moving when the auction does, and that is correct rather than
 * broken: a snake pick costs nothing, so the money a team is holding at the end
 * of the auction is the money it finishes with. The count beside the name goes
 * on climbing, because it is a count of players and not of dollars — the two
 * come apart the moment the snake starts, which is what the tooltip says.
 */
export const BudgetRail = ({ teams, players, activeTeamId }: BudgetRailProps) => (
  <section className="dr-panel dr-rail" aria-label="Team budgets">
    <header className="dr-rail-head">
      <h2 className="dr-eyebrow">Budgets</h2>
      <span className="dr-eyebrow">{teams.length} teams</span>
    </header>

    {teams.map((team) => {
      const share = team.budget > 0 ? team.remaining / team.budget : 0;
      const tone = share <= 0.05 ? 'is-broke' : share <= 0.25 ? 'is-low' : '';
      const filled = rosterSize(team);
      const bought = players.filter(
        (player) => player.draftedBy === team.id && player.draftCost != null
      ).length;

      return (
        <div
          className="dr-team-row"
          key={team.id}
          style={team.id === activeTeamId ? { color: 'var(--dr-ink)' } : undefined}
        >
          <span
            style={{ color: team.id === activeTeamId ? 'var(--dr-ink)' : 'var(--dr-ink-muted)' }}
          >
            {team.name}
            {filled > 0 && (
              <span
                className="dr-num"
                style={{ color: 'var(--dr-ink-faint)', marginLeft: 6 }}
                title={`${filled} rostered · ${bought} bought at auction`}
              >
                {filled}
                {bought < filled && <span style={{ opacity: 0.6 }}>·{bought}$</span>}
              </span>
            )}
          </span>
          <span
            className="dr-num"
            style={{ color: share <= 0.05 ? 'var(--dr-danger)' : 'var(--dr-ink)' }}
          >
            ${team.remaining}
          </span>
          <span className={`dr-team-bar ${tone}`}>
            <span style={{ width: `${Math.max(0, Math.min(100, share * 100))}%` }} />
          </span>
        </div>
      );
    })}
  </section>
);
