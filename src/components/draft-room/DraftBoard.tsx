import { useMemo } from 'react';
import type { AuctionDraftService, Player, Team } from '@/services/auctionDraftService';
import { getIdentity } from '@/services/nflIdentity';
import { DraftFlow, PositionRuns, type FlowPick } from './charts/DraftFlow';
import { TierDepletion, type TierRow } from './charts/TierDepletion';

interface DraftBoardProps {
  service: AuctionDraftService;
  players: Player[];
  teams: Team[];
  onClose: () => void;
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

/**
 * The whole room at once.
 *
 * A pick log is a list, and a list is the wrong shape for the questions people
 * actually ask between nominations: who has spent their money, which positions
 * went in a run, what is left. The grid answers the first, the flow answers the
 * second, and the depletion bars answer the third — one screen, no scrolling
 * back through a ticker.
 */
export const DraftBoard = ({ service, players, teams, onClose }: DraftBoardProps) => {
  const board = useMemo(() => service.getDraftBoard(), [service, players]); // eslint-disable-line react-hooks/exhaustive-deps
  const league = service.getLeagueShape();

  /*
   * Money leaving the room — the auction half, and only the auction half.
   *
   * A hundred and forty snake picks are a hundred and forty zero-dollar points
   * on a chart whose whole subject is spending. They draw a dead flat line
   * three quarters of the way across it, and a flat line on a money chart is
   * not "no money moved": it is indistinguishable from a room that has run out,
   * which is a real and different thing this chart exists to show. So the
   * drain stops where the money did.
   */
  const flow: FlowPick[] = useMemo(
    () =>
      players
        .filter((player) => player.isDrafted && player.draftCost != null)
        .map((player) => ({
          pickNumber: player.pickNumber ?? 0,
          position: player.position,
          cost: player.draftCost ?? 0,
          playerName: getIdentity(player.id)?.name ?? player.name,
          teamName: teams.find((team) => team.id === player.draftedBy)?.name ?? '',
        }))
        .sort((a, b) => a.pickNumber - b.pickNumber),
    [players, teams]
  );

  /** Any pick at all, either half, is enough for the supply chart to say something. */
  const depleted = players.some((player) => player.isDrafted);

  const depletion: TierRow[] = useMemo(
    () =>
      POSITIONS.map((position) => {
        const group = players.filter((player) => player.position === position);
        const tiers = [1, 2, 3, 4];
        return {
          position,
          remaining: tiers.map(
            (tier) => group.filter((player) => player.tier === tier && !player.isDrafted).length
          ),
          started: tiers.map((tier) => group.filter((player) => player.tier === tier).length),
        };
      }).filter((row) => row.started.some((count) => count > 0)),
    [players]
  );

  const deepest = Math.max(...board.map((row) => row.picks.length), 1);
  const totalBudget = league.teams * league.budget;

  return (
    <div className="dr-overlay" role="dialog" aria-modal="true" aria-label="League draft board">
      <div className="dr-boardview dr-panel">
        <header className="dr-compare-head">
          <h2 className="dr-display">The room</h2>
          <button className="dr-button" onClick={onClose}>
            Close
          </button>
        </header>

        {/* Two sections, gated separately, because they answer different
            questions. Money left in the room is about the auction and needs
            bought players. What is left is about supply and counts both halves
            — gating it on the money count hid it through the entire snake,
            behind a message saying the board fills in as picks happen while a
            hundred and forty picks happened below it. */}
        {flow.length >= 2 || depleted ? (
          <div className="dr-boardview-charts">
            {flow.length >= 2 && (
              <section>
                <h3 className="dr-eyebrow">Money left in the room</h3>
                <DraftFlow picks={flow} totalBudget={totalBudget} />
                <PositionRuns picks={flow} />
              </section>
            )}
            {depleted && (
              <section>
                <h3 className="dr-eyebrow">What is left</h3>
                <TierDepletion rows={depletion} />
              </section>
            )}
          </div>
        ) : (
          <p className="dr-empty">
            The board fills in as picks happen. Nominate someone to get it started.
          </p>
        )}

        <div className="dr-gridboard" role="table" aria-label="Every pick by team">
          <div className="dr-gridboard-head" role="row">
            {board.map(({ team }) => (
              <div className="dr-gridboard-team" role="columnheader" key={team.id}>
                <strong>{team.name}</strong>
                <span className="dr-num">${team.remaining}</span>
              </div>
            ))}
          </div>
          <div className="dr-gridboard-body">
            {Array.from({ length: deepest }, (_, slot) => (
              <div className="dr-gridboard-row" role="row" key={slot}>
                {board.map(({ team, picks }) => {
                  const pick = picks[slot];
                  return (
                    <div className="dr-gridboard-cell" role="cell" key={team.id}>
                      {pick ? (
                        <span
                          className="dr-gridboard-pick"
                          style={{
                            borderLeftColor: `var(--dr-pos-${pick.player.position.toLowerCase()})`,
                          }}
                          title={
                            pick.cost != null
                              ? `#${pick.pickNumber} ${pick.player.name} — $${pick.cost}`
                              : `#${pick.pickNumber} ${pick.player.name} — taken in the ${pick.phase}, no cost`
                          }
                        >
                          <em>{pick.player.position === 'DST' ? 'D' : pick.player.position}</em>
                          <span className="dr-gridboard-name">
                            {getIdentity(pick.player.id)?.name ?? pick.player.name}
                          </span>
                          {/* A cell reading "$0" says the room bought him for
                              nothing. The grid says which half of the draft he
                              came from instead. */}
                          <span className="dr-num">
                            {pick.cost != null ? `$${pick.cost}` : 'snake'}
                          </span>
                        </span>
                      ) : (
                        <span className="dr-gridboard-empty" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
