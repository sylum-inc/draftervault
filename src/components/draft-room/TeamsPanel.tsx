import type { Player, Team } from '@/services/auctionDraftService';
import { FLEX_ELIGIBLE, LINEUP_SLOTS, type LeagueShape, type LineupSlot } from '@/lib/valuation';

interface TeamsPanelProps {
  teams: Team[];
  players: Player[];
  activeTeamId: string;
  onSelectTeam: (teamId: string) => void;
  /** The lineup the league actually starts, which is what "need" means. */
  league: LeagueShape;
  /** Which team is the person using this, so it can be told apart at a glance. */
  myTeamId: string | null;
}

/**
 * Starting slots a team is trying to fill, in the order they matter.
 *
 * Read from the league rather than typed here. This was the fourth hardcoded
 * QB1/RB2/WR3 table in the app; the other three were consolidated when the
 * league became configurable and this one was missed, so a superflex or
 * three-receiver league saw needs it was not actually playing.
 */
/** What a roster line paid, in words, for the column that has room for a dash. */
const cost = (player: Player): string =>
  player.draftCost != null ? `Bought for $${player.draftCost}` : 'Taken in the snake — no cost';

/* Every seat the lineup fields, the flex included. It iterated the positions
   and so drew nine chips for a ten-starter lineup: the flex seat — the one this
   league's whole difference turns on — was never rendered. */
const startersFor = (league: LeagueShape): Array<[LineupSlot, number]> =>
  LINEUP_SLOTS.map(
    (slot) => [slot, league.startingLineup[slot] ?? 0] as [LineupSlot, number]
  ).filter(([, count]) => count > 0);

/* Whether the flex is taken: bodies at flex-eligible positions beyond the
   dedicated seats there. The same arithmetic `unfilledSlotsFor` does for the
   reserve, read off the roster counts this panel already has. */
const flexTaken = (team: Team, league: LeagueShape): number =>
  FLEX_ELIGIBLE.reduce(
    (sum, position) =>
      sum + Math.max(0, (team.roster[position] ?? 0) - (league.startingLineup[position] ?? 0)),
    0
  );

/**
 * Every team's roster as it fills.
 *
 * The thing you actually need mid-auction is not your own roster — it is
 * everyone else's, because a team that still needs two running backs is the
 * team about to bid against you. Filled slots are solid, open ones hollow.
 */
export const TeamsPanel = ({
  teams,
  players,
  activeTeamId,
  onSelectTeam,
  league,
  myTeamId,
}: TeamsPanelProps) => {
  const STARTERS = startersFor(league);
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
        <span className="dr-eyebrow dr-num">
          ${teams.reduce((sum, team) => sum + team.remaining, 0).toLocaleString()} in the room
        </span>
      </header>

      <div className="dr-rail-grid">
        {teams.map((team) => {
          // Dearest first, and the free ones last: a snake pick has no cost at
          // all, so it sorts below a $1 buy rather than tying with one.
          const roster = (byTeam.get(team.id) ?? []).sort(
            (a, b) => (b.draftCost ?? -1) - (a.draftCost ?? -1)
          );
          const active = team.id === activeTeamId;
          const share = team.budget > 0 ? team.remaining / team.budget : 0;
          const flexUsed = flexTaken(team, league);

          return (
            <div
              className={`dr-team-block${active ? ' is-active' : ''}${team.id === myTeamId ? ' is-mine' : ''}`}
              key={team.id}
            >
              <button type="button" className="dr-team-head" onClick={() => onSelectTeam(team.id)}>
                <span className="dr-team-name">
                  {team.name}
                  {team.id === myTeamId && (
                    <span className="dr-mine-tag" title="Your team">
                      you
                    </span>
                  )}
                </span>
                <span
                  className="dr-num"
                  style={{ color: team.remaining <= 5 ? 'var(--dr-danger)' : 'var(--dr-ink)' }}
                >
                  ${team.remaining}
                </span>
              </button>

              {/* Money left, as the bar the budgets tab used to be. */}
              <span
                className={`dr-team-bar${share <= 0.05 ? ' is-broke' : share <= 0.2 ? ' is-low' : ''}`}
                title={`$${team.remaining} of $${team.budget} left`}
              >
                <span style={{ width: `${Math.max(0, Math.min(100, share * 100))}%` }} />
              </span>

              <div className="dr-slots">
                {STARTERS.flatMap(([position, required]) =>
                  Array.from({ length: required }, (_, index) => {
                    const filled =
                      position === 'FLEX' ? flexUsed > index : (team.roster[position] ?? 0) > index;
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
                      {/* A snake pick was not bought for $0; nobody bought him at
                        all. The column says which of the two happened. */}
                      <span className="dr-num dr-team-cost" title={cost(player)}>
                        {player.draftCost != null ? `$${player.draftCost}` : '—'}
                      </span>
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
      </div>
    </section>
  );
};
