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
  /**
   * Average draft position, when a market snapshot is bundled.
   *
   * Preferred over `consensusRank` wherever it exists, because ADP is the
   * signal `npm run backtest` actually measured — thousands of real half-PPR
   * drafts — while expert consensus is an analyst panel that was substituted
   * for it without evidence. They disagree where it costs most: on the 2026
   * board ADP has Gibbs, Bijan, Nacua, Chase and consensus has Chase, Gibbs,
   * Nacua, Bijan.
   *
   * ADP does not replace consensus, it outranks it. Real drafts stop caring
   * after about 230 players where consensus ranks 383, so a player with a
   * consensus rank and no ADP is by definition one the room was not drafting
   * — he sorts after every ADP'd player at his position, in consensus order.
   * That is an ordering claim both sources agree on rather than a splice of
   * two incompatible scales.
   */
  adp?: number | null;
  /**
   * Whether the money is buying him.
   *
   * Load-bearing once a commissioner's sheet is in force. The reorder is a
   * *permutation* of a value curve, and a permutation only conserves money if
   * it stays inside the set the money is spread across. Reordering across the
   * sheet boundary hands a highly-ranked off-sheet player a real dollar value
   * and pushes a sheet player to the floor — measured on the owner's own
   * sixty-name sheet, $436 of the room's $2,400 leaked onto fourteen players
   * nobody was going to bid on, and the sheet itself came out $422 light.
   *
   * Undefined means "everybody", which is the full-auction case where there is
   * no sheet to be off.
   */
  forSale?: boolean;
}

/** Which signal spoke for a player, so the panel can name it honestly. */
export type MarketSource = 'adp' | 'consensus' | 'none';

/**
 * One ordering out of two sources, without ever comparing their numbers.
 *
 * The tempting mistake is to blend an ADP of 41.2 with a consensus rank of 55
 * — different scales measuring different things, and the average is not a
 * quantity. What is comparable is the *claim*: a player real drafts took is
 * ahead of a player real drafts did not take. So ADP sorts among ADP, consensus
 * sorts among consensus, and every ADP'd player precedes every one that is not.
 */
export const marketOrder = (
  players: readonly ConsensusSubject[]
): Array<ConsensusSubject & { marketSource: MarketSource }> => {
  const drafted = players
    .filter((player) => player.adp != null)
    .sort((a, b) => (a.adp as number) - (b.adp as number))
    .map((player) => ({ ...player, marketSource: 'adp' as const }));
  const rankedOnly = players
    .filter((player) => player.adp == null && player.consensusRank != null)
    .sort((a, b) => (a.consensusRank as number) - (b.consensusRank as number))
    .map((player) => ({ ...player, marketSource: 'consensus' as const }));
  return [...drafted, ...rankedOnly];
};

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
  // One ordering first, then split by position. Doing it this way round is what
  // keeps ADP and consensus from being interleaved by number: the global order
  // already encodes "drafted before not drafted", and the per-position pass
  // only ever preserves it.
  // Only the players the money is actually buying. Everybody else keeps the
  // dollar floor he already sits at, which is the honest price for somebody no
  // money is chasing.
  const ordered = marketOrder(players).filter((player) => player.forSale !== false);
  const byPosition = new Map<string, Array<(typeof ordered)[number]>>();
  for (const player of ordered) {
    const list = byPosition.get(player.position);
    if (list) list.push(player);
    else byPosition.set(player.position, [player]);
  }

  const overrides: Record<string, RankingOverride> = {};
  for (const [, group] of byPosition) {
    // Our prices at this position, largest first: the curve, kept intact.
    const curve = group.map((player) => player.auctionValue).sort((a, b) => b - a);
    group.forEach((player, index) => {
      overrides[player.gsis] = {
        value: curve[index],
        rank: index + 1,
        notes: player.marketSource === 'adp' ? 'adp' : 'consensus',
      };
    });
  }
  return overrides;
};

/** How many of a pool the market actually has an opinion about. */
export const consensusCoverage = (
  players: readonly ConsensusSubject[]
): { ranked: number; of: number; fromAdp: number; fromConsensus: number } => {
  const buying = players.filter((player) => player.forSale !== false);
  const fromAdp = buying.filter((player) => player.adp != null).length;
  const fromConsensus = buying.filter(
    (player) => player.adp == null && player.consensusRank != null
  ).length;
  return { ranked: fromAdp + fromConsensus, of: players.length, fromAdp, fromConsensus };
};
