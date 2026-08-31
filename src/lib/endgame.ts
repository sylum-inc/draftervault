/**
 * When to buy, which is the half the spend outlook does not answer.
 *
 * `snakeOutlook` says *what* a dollar buys — how much better an auction player
 * is than the man the snake hands you free. This says *when* that dollar goes
 * furthest, and it rests on one piece of arithmetic the room is not doing:
 *
 *   the money in the room ÷ the players still for sale = what the rest must average
 *
 * That is not a forecast, it is a constraint. Twelve teams at $200 chasing sixty
 * players means the sheet averages $40 whatever anybody believes. If the first
 * twenty go at $60, the remaining forty *must* average $30 — the money is gone
 * and the players are not. Every auction ends in a fire sale for exactly this
 * reason, and the only question is whether you are holding money when it starts.
 *
 * So the panel compares two numbers that are always both knowable: **par**, the
 * average the remainder must go for, and **pace**, what the room has actually
 * been paying. Pace above par means the room is spending ahead of its budget and
 * prices have to fall. Pace below par means money is piling up behind fewer
 * players and prices have to rise.
 *
 * The second number is who can still bid at all. A team with $8 left is not a
 * quiet bidder, it is a spectator, and once most of the room is spectating the
 * remaining players go for a dollar regardless of what they are worth. That
 * count collapsing is the single clearest buy signal an auction produces.
 *
 * Nothing here takes a view about a player. It is all arithmetic on money and
 * counts, which is what the backtest found this board is actually good at.
 */

/** One team's money, as this arithmetic needs it. */
export interface EndgameTeam {
  id: string;
  name: string;
  /** Money the rules still let them spend. */
  remaining: number;
}

export interface EndgameInput {
  /** Money left across the whole room. */
  moneyLeft: number;
  /** Sheet players not yet sold or passed over. */
  playersLeft: number;
  /**
   * What the most recent sales actually went for, newest first.
   *
   * Only the recent ones: an average over the whole auction is dominated by the
   * opening stars and stops moving, which is the opposite of what a pace is for.
   */
  recentPrices: readonly number[];
  teams: readonly EndgameTeam[];
  /** Which of them is yours, when one is marked. */
  myTeamId: string | null;
}

export interface Endgame {
  /** What the remaining players must average, given the money still in the room. */
  par: number;
  /** What the room has lately been paying, or null before anything has sold. */
  pace: number | null;
  /** Teams whose remaining money still covers par. */
  liveBidders: number;
  teamCount: number;
  /** Your money, and how many pars it buys. Null with no team marked. */
  yourMoney: number | null;
  /** Your share of what is left in the room, 0-1. */
  yourShare: number | null;
  playersLeft: number;
  moneyLeft: number;
  /** What to do about it, in one line. */
  verdict: string;
  /** Which way the verdict leans, for colour. */
  lean: 'wait' | 'buy' | 'even' | 'unknown';
}

/** How many recent sales make a pace. Few enough to move, enough to mean something. */
export const PACE_WINDOW = 8;

const mean = (values: readonly number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

export const endgame = (input: EndgameInput): Endgame => {
  const { moneyLeft, playersLeft, recentPrices, teams, myTeamId } = input;

  const par = playersLeft > 0 ? Math.round(moneyLeft / playersLeft) : 0;
  const pace = mean(recentPrices.slice(0, PACE_WINDOW));
  const paced = pace == null ? null : Math.round(pace);

  // A team that cannot cover par is not bidding on anything that matters, so it
  // is not competition. Counting them as bidders is how a room reads as richer
  // than it is right up until the moment it stops bidding.
  const liveBidders = teams.filter((team) => team.remaining >= par && par > 0).length;
  const mine = myTeamId ? (teams.find((team) => team.id === myTeamId) ?? null) : null;
  const yourMoney = mine?.remaining ?? null;
  const yourShare = mine && moneyLeft > 0 ? mine.remaining / moneyLeft : null;

  let lean: Endgame['lean'] = 'unknown';
  let verdict: string;

  if (playersLeft <= 0) {
    verdict = 'The auction is over. Everything from here is a free pick.';
    lean = 'unknown';
  } else if (paced == null) {
    verdict = `Nothing has sold yet. The sixty on the sheet have to average $${par}.`;
    lean = 'unknown';
  } else if (liveBidders <= 2) {
    // The strongest signal an auction gives, and it beats the pace comparison:
    // with nobody left able to pay, what a player is worth stops mattering.
    verdict =
      `Only ${liveBidders} team${liveBidders === 1 ? '' : 's'} can still pay $${par}. ` +
      'Whatever is left goes near the floor — stop bidding up and take them cheap.';
    lean = 'buy';
  } else if (paced >= par * 1.25) {
    verdict =
      `The room is paying $${paced} against a par of $${par}. It is spending ahead of its ` +
      `budget, so the last ${playersLeft} have to come down. Hold.`;
    lean = 'wait';
  } else if (paced <= par * 0.8) {
    verdict =
      `The room is paying $${paced} against a par of $${par}. Money is piling up behind ` +
      `${playersLeft} players, so prices have to rise. Buy now.`;
    lean = 'buy';
  } else {
    verdict = `The room is paying about par — $${paced} against $${par}. No timing edge right now.`;
    lean = 'even';
  }

  return {
    par,
    pace: paced,
    liveBidders,
    teamCount: teams.length,
    yourMoney,
    yourShare,
    playersLeft,
    moneyLeft,
    verdict,
    lean,
  };
};
