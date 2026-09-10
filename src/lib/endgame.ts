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
  /**
   * What those same sales were listed at, in the same order.
   *
   * The thing that makes the pace mean something, and its absence was a real
   * defect rather than a missing refinement. Comparing a raw pace with par
   * compares the average of the *expensive* players just sold with the average
   * of the *cheaper* ones still to come, so early in an auction it reads "the
   * room is spending ahead of its budget" from the first sale onwards, whatever
   * the room does — a signal that fires on the shape of an auction rather than
   * on anything anyone did.
   *
   * Driven on the real sheet it contradicted the panel two inches above it: the
   * multiplier said money left exceeded value left by 15% because the room had
   * paid 40% *under* list, while this said the room was paying above par and to
   * hold. Both cannot be advice. Dividing by what those same players were
   * listed at takes the composition out and leaves what the room actually did.
   */
  recentList: readonly number[];
  teams: readonly EndgameTeam[];
  /** Which of them is yours, when one is marked. */
  myTeamId: string | null;
}

export interface Endgame {
  /** What the remaining players must average, given the money still in the room. */
  par: number;
  /** What the room has lately been paying, or null before anything has sold. */
  pace: number | null;
  /**
   * What it paid as a share of those players' list prices — 0.6 is forty per
   * cent under. Null before anything has sold. This is the figure the verdict
   * is taken from; `pace` is printed beside par because dollars are what
   * somebody at the table is holding in their head.
   */
  paceOfList: number | null;
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
  const { moneyLeft, playersLeft, recentPrices, recentList, teams, myTeamId } = input;

  const par = playersLeft > 0 ? Math.round(moneyLeft / playersLeft) : 0;
  const window = recentPrices.slice(0, PACE_WINDOW);
  const pace = mean(window);
  const paced = pace == null ? null : Math.round(pace);

  // Against what those same players were listed at, so the comparison is like
  // with like. A list total of zero means nothing on the board was priced —
  // there is no share to take, and inventing one would divide by the wrong
  // thing rather than say so.
  const listed = recentList.slice(0, window.length).reduce((sum, value) => sum + value, 0);
  const spent = window.reduce((sum, value) => sum + value, 0);
  const paceOfList = listed > 0 ? spent / listed : null;

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
    verdict = `Nothing has sold yet. The ${playersLeft} on the sheet have to average $${par}.`;
    lean = 'unknown';
  } else if (liveBidders <= 2) {
    // The strongest signal an auction gives, and it beats the pace comparison:
    // with nobody left able to pay, what a player is worth stops mattering.
    verdict =
      `Only ${liveBidders} team${liveBidders === 1 ? '' : 's'} can still pay $${par}. ` +
      'Whatever is left goes near the floor — stop bidding up and take them cheap.';
    lean = 'buy';
  } else if (paceOfList == null) {
    verdict = `The room is paying $${paced} a man against a par of $${par}, off a board with no prices on it.`;
    lean = 'unknown';
  } else if (paceOfList >= 1.1) {
    // The room is paying over list, so money is leaving faster than value. What
    // is left has to come down, and the last players go near the floor.
    verdict =
      `The room is paying ${Math.round((paceOfList - 1) * 100)}% over list. It is spending ` +
      `ahead of itself, so the last ${playersLeft} have to come down — par is $${par}. Hold.`;
    lean = 'wait';
  } else if (paceOfList <= 0.9) {
    // And the other way round, which is the case the raw pace got backwards.
    // Underpaying leaves more money behind less value, so nothing from here is
    // a bargain and the discount only shrinks. Waiting is the expensive move.
    verdict =
      `The room is paying ${Math.round((1 - paceOfList) * 100)}% under list, so the money left ` +
      `is chasing fewer players than it can afford. Prices only rise from here — buy now, ` +
      `at a par of $${par}.`;
    lean = 'buy';
  } else {
    verdict = `The room is paying about list. No timing edge right now — par from here is $${par}.`;
    lean = 'even';
  }

  return {
    par,
    pace: paced,
    paceOfList,
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

/**
 * Plain words for what the inflation number means for the next bid.
 *
 * `premium` is what the room has actually paid against our numbers, and it is
 * here because without it this panel gave two answers to one question. Driven
 * mid-auction it read "Money is chasing scraps — expect overpays" in red, two
 * inches above "RB −44% going cheap · 4 sold" in green, above "the room is
 * paying about par — no timing edge".
 *
 * They are not three findings. They are one, stated three ways and never
 * joined up: the room *underpaid* for the players sold, which is precisely why
 * the money left over now exceeds the value left to buy. A high multiplier
 * with a negative premium is a forecast that the rest will run dear, and it
 * arrives through the room having been cheap so far — the opposite of what
 * "expect overpays" reads as while the sales beneath it say bargain.
 *
 * So the loud band says which of the two it is. Nothing here is a new number;
 * both were already on the panel, a hand's width apart.
 */
export const readInflation = (
  inflation: number,
  premium: number | null
): { label: string; tone: string } => {
  const underpaying = premium != null && premium < 0.97;
  if (inflation >= 1.15)
    return underpaying
      ? {
          // "Hold" is the tempting word here and it is exactly wrong. More
          // money than value left means everything from here goes over list,
          // and the multiplier climbs as the money concentrates — so waiting
          // buys the same players at a worse number.
          label: 'The room underpaid early — more money left than value. Buy before it worsens.',
          tone: 'var(--dr-caution)',
        }
      : { label: 'Money is chasing scraps — expect overpays', tone: 'var(--dr-danger)' };
  if (inflation >= 1.04) return { label: 'Prices running hot', tone: 'var(--dr-caution)' };
  if (inflation <= 0.85) return { label: 'Value on the board — bid', tone: 'var(--dr-value)' };
  if (inflation <= 0.96) return { label: 'Slightly in your favour', tone: 'var(--dr-value)' };
  return { label: 'Priced about right', tone: 'var(--dr-ink-muted)' };
};
