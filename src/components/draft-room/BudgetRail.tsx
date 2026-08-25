import type { Team } from '@/services/auctionDraftService';

interface BudgetRailProps {
  teams: Team[];
  activeTeamId: string;
}

const rosterSize = (team: Team): number =>
  Object.values(team.roster).reduce((total, count) => total + count, 0);

/**
 * Money left per team.
 *
 * Budget state is encoded twice on purpose — bar length and color — so a team
 * running out reads at a glance without anyone parsing the number.
 */
export const BudgetRail = ({ teams, activeTeamId }: BudgetRailProps) => (
  <section className="dr-panel dr-rail" aria-label="Team budgets">
    <header className="dr-rail-head">
      <h2 className="dr-eyebrow">Budgets</h2>
      <span className="dr-eyebrow">{teams.length} teams</span>
    </header>

    {teams.map((team) => {
      const share = team.budget > 0 ? team.remaining / team.budget : 0;
      const tone = share <= 0.05 ? 'is-broke' : share <= 0.25 ? 'is-low' : '';
      const filled = rosterSize(team);

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
              <span className="dr-num" style={{ color: 'var(--dr-ink-faint)', marginLeft: 6 }}>
                {filled}
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
