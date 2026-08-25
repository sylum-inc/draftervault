import type { Player, PlayerPosition, Team } from '@/services/auctionDraftService';

interface TeamsPanelProps {
  teams: Team[];
  players: Player[];
  activeTeamId: string;
  onSelectTeam: (teamId: string) => void;
}

/** Starting slots a team is trying to fill, in the order they matter. */
const STARTERS: Array<[PlayerPosition, number]> = [
  ['QB', 1],
  ['RB', 2],
  ['WR', 3],
  ['TE', 1],
  ['K', 1],
  ['DST', 1],
];

/**
 * Every team's roster as it fills.
 *
 * The thing you actually need mid-auction is not your own roster — it is
 * everyone else's, because a team that still needs two running backs is the
 * team about to bid against you. Filled slots are solid, open ones hollow.
 */
export const TeamsPanel = ({ teams, players, activeTeamId, onSelectTeam }: TeamsPanelProps) => {
  const byTeam = new Map<string, Player[]>();
  for (const player of players) {
    if (!player.isDrafted || !player.draftedBy) continue;
    if (!byTeam.has(player.draftedBy)) byTeam.set(player.draftedBy, []);
    byTeam.get(player.draftedBy)!.push(player);
  }

  return (
    <section className="dr-panel dr-rail" aria-label="Team rosters">
      <header className="dr-rail-head">
        <h2 className="dr-eyebrow">Rosters</h2>
        <span className="dr-eyebrow">needs at a glance</span>
      </header>

      {teams.map((team) => {
        const roster = (byTeam.get(team.id) ?? []).sort(
          (a, b) => (b.draftCost ?? 0) - (a.draftCost ?? 0)
        );
        const active = team.id === activeTeamId;

        return (
          <div className={`dr-team-block${active ? ' is-active' : ''}`} key={team.id}>
            <button type="button" className="dr-team-head" onClick={() => onSelectTeam(team.id)}>
              <span className="dr-team-name">{team.name}</span>
              <span
                className="dr-num"
                style={{ color: team.remaining <= 5 ? 'var(--dr-danger)' : 'var(--dr-ink)' }}
              >
                ${team.remaining}
              </span>
            </button>

            <div className="dr-slots">
              {STARTERS.flatMap(([position, required]) =>
                Array.from({ length: required }, (_, index) => {
                  const filled = (team.roster[position] ?? 0) > index;
                  return (
                    <span
                      key={`${position}-${index}`}
                      className="dr-slot"
                      data-filled={filled || undefined}
                      title={`${position}${required > 1 ? ` ${index + 1}` : ''}: ${filled ? 'filled' : 'open'}`}
                    >
                      {position}
                    </span>
                  );
                })
              )}
            </div>

            {roster.length > 0 && (
              <ul className="dr-team-roster">
                {roster.slice(0, 5).map((player) => (
                  <li key={player.id}>
                    <span className="dr-num dr-team-cost">${player.draftCost}</span>
                    {player.name}
                  </li>
                ))}
                {roster.length > 5 && (
                  <li style={{ color: 'var(--dr-ink-faint)' }}>+{roster.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
};
