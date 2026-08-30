import type { RankingOverride } from './rankingsCsv';

/**
 * The board the backtest says to draft off: the market's order, our dollars.
 *
 * `npm run backtest` scored a sweep of blends between our board and real
 * pre-season draft-market ADP, and the answer was the same in all three
 * held-out seasons and under leave-one-season-out: the best weight on our own
 * ordering is **zero**. The market alone scored rho 0.510, 0.482 and 0.481 on
 * surplus over replacement, our board 0.368, 0.378 and 0.428, and every blend
 * in between landed in between. An ensemble usually beats its parts; it does
 * not here, because averaging only helps when two estimators are comparably
 * good, and ours is not — the blend just dilutes the better signal.
 *
 * So this takes the ordering from consensus and the *shape* from us, which is
 * exactly the board that was measured. That second half matters and is easy to
 * miss: a rank is not a price. What turns an ordering into dollars is the size
 * of the gaps between players — the drop from the best receiver to the fifth is
 * most of what an auction is arguing about — and consensus publishes a rank
 * with no gaps in it at all. Our surplus curve has them, is derived from this
 * league's own scoring and roster shape, and is the one thing the backtest
 * found the board is genuinely good at. Permuting values along it keeps every
 * dollar the league had to spend and only changes who receives them.
 *
 * Reordering happens **within a position**, never across. Consensus ranks pool
 * every position into one list, and letting that list reorder across positions
 * would hand the board the positional ordering — which is the confound that
 * made the backtest's first headline wrong, and which no auction pays for
 * because you start one quarterback whatever his rank says.
 *
 * A player consensus does not rank keeps our number. That is 245 of the 628,
 * and it is the right answer rather than a gap: they are the $1-2 bench players
 * FantasyPros does not bother to rank, they are already at the floor, and
 * inventing a market opinion for them would be inventing the one thing this
 * whole module exists to defer to.
 */

/** What the board needs to know about a player to re-order him. */
export interface ConsensusSubject {
  gsis: string;
  position: string;
  /** Our own price, which supplies the curve the market's order is read off. */
  auctionValue: number;
  /** Where the market has him. Null or absent means we keep our own number. */
  consensusRank?: number | null;
}

/**
 * Overrides that reprice the board at consensus, in the same shape an imported
 * CSV produces.
 *
 * Deliberately expressed as overrides rather than as a second pricing mode.
 * `setCustomRankings` is already the tested path for "somebody else's numbers
 * drive the board": the advisor follows it, `modelValue` keeps ours beside it
 * so the board can say whose number it is showing, and a draft in progress
 * survives it because only prices move. A parallel pricing path would be a
 * second place a dollar is decided, which is the thing `valuation.ts` exists
 * to prevent.
 */
export const consensusOverrides = (
  players: readonly ConsensusSubject[]
): Record<string, RankingOverride> => {
  const byPosition = new Map<string, ConsensusSubject[]>();
  for (const player of players) {
    if (player.consensusRank == null) continue;
    const list = byPosition.get(player.position);
    if (list) list.push(player);
    else byPosition.set(player.position, [player]);
  }

  const overrides: Record<string, RankingOverride> = {};
  for (const [, group] of byPosition) {
    // Our prices at this position, largest first: the curve, kept intact.
    const curve = group.map((player) => player.auctionValue).sort((a, b) => b - a);
    // The same players in the market's order. Ties broken by our own price, so
    // the result is deterministic rather than dependent on pool order — two
    // runs disagreeing about a dollar is the kind of thing nobody notices until
    // a second window shows a different number.
    const ordered = [...group].sort(
      (a, b) =>
        (a.consensusRank as number) - (b.consensusRank as number) || b.auctionValue - a.auctionValue
    );
    ordered.forEach((player, index) => {
      overrides[player.gsis] = {
        value: curve[index],
        rank: player.consensusRank as number,
        notes: 'consensus',
      };
    });
  }
  return overrides;
};

/** How many of a pool the market actually has an opinion about. */
export const consensusCoverage = (
  players: readonly ConsensusSubject[]
): { ranked: number; of: number } => ({
  ranked: players.filter((player) => player.consensusRank != null).length,
  of: players.length,
});
