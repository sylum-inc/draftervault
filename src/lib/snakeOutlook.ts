/**
 * What the snake will give you for nothing, and therefore what a bid is worth.
 *
 * This is the one piece of arithmetic in the app that is specific to the format
 * being played, and it is the piece nobody else at the table is doing.
 *
 * In an ordinary auction every roster spot has to be bought, so the only
 * question is how to divide the money. Here a commissioner's sheet of fifty-odd
 * is auctioned and the remaining eleven or twelve seats per team are snaked for
 * free, with no minimum anybody has to spend. That changes the question
 * entirely. It is no longer "what is this player worth" — it is **"how much
 * better is he than the player I will get for nothing at the same position?"**
 *
 * `vorp` cannot answer that, and it is worth being precise about why rather
 * than treating this as a refinement of it. VORP measures a player against the
 * last man the *league* rosters at his position — about the sixtieth receiver.
 * That is the right bar when the auction buys the whole roster, because the
 * sixtieth receiver really is the alternative. In this format he is not: your
 * alternative is whoever is still on the board at *your* snake slot, which
 * might be the twenty-fifth receiver. Paying auction money for the difference
 * between a stud and the sixtieth receiver, when you are actually only buying
 * the difference between him and the twenty-fifth, is how a budget disappears
 * into players you did not need to buy.
 *
 * The estimate assumes the room snakes in the board's current order, which
 * after "Use consensus" is the draft market's. That is an assumption and it is
 * stated: real rooms reach and panic. It is also the best available one — the
 * backtest found market order the strongest predictor of what actually happens,
 * beating our own board in every season it was measured against.
 */

/** A player, reduced to what this arithmetic needs. */
export interface OutlookSubject {
  id: string;
  name: string;
  position: string;
  /** Projected points under the league in force. */
  points: number;
  /** What the board says he costs. Only meaningful for players being auctioned. */
  price: number;
  /**
   * Where the board ranks him overall, lowest first.
   *
   * This is the order the room is assumed to snake in, so it comes from the
   * live board rather than from our own model: after "Use consensus" the board
   * is ordered by real drafts, which is what the other eleven managers are
   * reading off their own sheets.
   */
  order: number;
}

/** What one position looks like once the money and the free picks are separated. */
export interface PositionOutlook {
  position: string;
  /** The best player expected to survive to your next snake pick. */
  free: OutlookSubject | null;
  /** How many at this position are gone before you pick, on this estimate. */
  goneBefore: number;
  /** The best player still for sale at auction here. */
  forSale: OutlookSubject | null;
  /**
   * Points the auction buys over the free alternative.
   *
   * The number to spend against. Zero or negative means the snake covers this
   * position and every dollar spent on it is a dollar not spent where it counts.
   */
  gain: number;
  /** Points of gain per dollar of his current price. */
  gainPerDollar: number;
}

export interface SnakeOutlook {
  /** Null when the outlook cannot honestly be computed; `reason` says why. */
  positions: PositionOutlook[] | null;
  reason: string | null;
  /** Which snake pick of yours this is measured at, 1-based among snake picks. */
  atOverall: number | null;
}

export interface OutlookInput {
  /** Undrafted players the snake will hand out, i.e. everybody not being auctioned. */
  snakePool: readonly OutlookSubject[];
  /** Undrafted players still being bought with money. */
  forSale: readonly OutlookSubject[];
  /**
   * Your next snake pick, counted among snake picks overall and 1-based.
   *
   * Null when it cannot be known — no order set, no team marked as yours, or a
   * league with no snake half at all.
   */
  yourNextSnakePick: number | null;
  /** Why it cannot be known, when it cannot. */
  unavailable?: string;
  /** Positions to report on, in the order to report them. */
  positions: readonly string[];
}

/**
 * The best player at each position expected to survive to your slot.
 *
 * Deliberately refuses rather than guesses. An outlook computed without knowing
 * where you pick would be an outlook for somebody else's draft, and it would
 * look exactly as authoritative as a real one.
 */
export const snakeOutlook = (input: OutlookInput): SnakeOutlook => {
  const { snakePool, forSale, yourNextSnakePick, positions } = input;

  if (yourNextSnakePick == null) {
    return {
      positions: null,
      reason: input.unavailable ?? 'No snake pick to measure from.',
      atOverall: null,
    };
  }
  if (!snakePool.length) {
    return { positions: null, reason: 'Nobody left for the snake to hand out.', atOverall: null };
  }

  // The room is assumed to take the best available in the board's order. Every
  // pick before yours comes off the top, so what is left for you starts at that
  // depth — the single assumption this whole estimate rests on.
  const ordered = [...snakePool].sort((a, b) => a.order - b.order || b.points - a.points);
  const gone = Math.max(0, yourNextSnakePick - 1);
  const surviving = ordered.slice(gone);
  const takenBefore = ordered.slice(0, gone);

  const best = (list: readonly OutlookSubject[], position: string) =>
    list
      .filter((player) => player.position === position)
      .reduce<OutlookSubject | null>(
        (top, player) => (top == null || player.points > top.points ? player : top),
        null
      );

  const out: PositionOutlook[] = positions.map((position) => {
    /*
     * Two different orders, and using one for both is the mistake this comment
     * exists to prevent.
     *
     * Who is *gone* is decided by the room, so it is taken in the room's order
     * — the market's, which is what the other eleven managers are reading.
     * Who *you take* from what is left is decided by you, and you take the
     * best of them by projected points, because points are what score.
     *
     * Ordering both by the room inflates the gain, sometimes wildly: on the
     * shipped board it made the best free back a rookie the market likes and
     * this model does not, at 61 points, when a receiver-adjacent back worth
     * twice that was sitting untaken beside him. The auction then looked like
     * the only way to get a running back, which is exactly the conclusion a
     * budget should not be spent on.
     */
    const free = best(surviving, position);
    const forSaleHere = best(forSale, position);
    const gain = forSaleHere ? forSaleHere.points - (free?.points ?? 0) : 0;
    const price = forSaleHere?.price ?? 0;
    return {
      position,
      free,
      goneBefore: takenBefore.filter((player) => player.position === position).length,
      forSale: forSaleHere,
      gain: Math.round(gain),
      // Guarded rather than clamped: a player at the dollar floor with real
      // gain genuinely is enormous value per dollar, and hiding that behind a
      // cap would bury the best buy on the board.
      gainPerDollar: price > 0 ? Math.round((gain / price) * 10) / 10 : 0,
    };
  });

  return { positions: out, reason: null, atOverall: yourNextSnakePick };
};

/** One position's gain, bounded across every draw it could be measured at. */
export interface PositionSpread {
  position: string;
  /** The gain at the draw that helps least, and at the draw that helps most. */
  low: number;
  high: number;
  /** Per dollar at each end, so a cheap position is not buried by a dear one. */
  perDollarLow: number;
  perDollarHigh: number;
  /** The free man at each end — the same man when the draw changes nothing. */
  bestFree: OutlookSubject | null;
  worstFree: OutlookSubject | null;
  /** The player the gain is measured for, which no draw changes. */
  forSale: OutlookSubject | null;
  /** No draw moves this one, so it can be decided now. */
  settled: boolean;
}

export interface SnakeSpread {
  positions: PositionSpread[] | null;
  reason: string | null;
}

/**
 * What a bid buys before the order has been drawn.
 *
 * `snakeOutlook` refuses without a snake slot, and that refusal is right: a
 * number computed at somebody else's pick looks exactly as authoritative as one
 * computed at yours. But refusing is not the same as having nothing to say, and
 * what it was withholding turns out to be the most useful thing on the board a
 * month before the draft — because **the answer is a bound, not a guess.** Run
 * the same arithmetic at every draw you could be handed and report the range.
 * Nothing is assumed; every number in it is one the outlook would print.
 *
 * On the shipped board that lands somewhere worth stating plainly, and it is
 * not where it would be guessed. **Quarterback and tight end have width zero**:
 * Jalen Hurts and George Kittle survive all twelve draws, because a one-starter
 * position is not what a room reaches for in the first round of a snake — so
 * those two rows can be committed to a month early. **Running back is what the
 * draw decides**: the free back falls from Josh Jacobs at 196 to RJ Harvey at
 * 154 between the first seat and the last, so a bid at the position moves from
 * buying 82 points to buying 124. Receiver moves a little (89 to 96) and the
 * rest not at all.
 *
 * That is the shape of the thing worth knowing before draft night: the
 * positions where a plan can be fixed now, and the one where it cannot.
 *
 * `settled` is therefore the load-bearing field rather than the numbers: it
 * says which rows the draw cannot touch, and those are the rows to plan on.
 */
export const snakeOutlookSpread = (
  input: Omit<OutlookInput, 'yourNextSnakePick'>,
  /** Every overall pick you could hold — one through the number of teams. */
  draws: readonly number[]
): SnakeSpread => {
  if (!draws.length) return { positions: null, reason: 'No draws to measure over.' };
  const runs = draws.map((draw) => snakeOutlook({ ...input, yourNextSnakePick: draw }));
  const first = runs[0];
  if (!first.positions) return { positions: null, reason: first.reason };

  const positions = input.positions.map((position, index) => {
    const at = runs.map((run) => run.positions![index]);
    const gains = at.map((row) => row.gain);
    const low = Math.min(...gains);
    const high = Math.max(...gains);
    const perDollar = at.map((row) => row.gainPerDollar);
    return {
      position,
      low,
      high,
      perDollarLow: Math.min(...perDollar),
      perDollarHigh: Math.max(...perDollar),
      // The best free man is the one you get on the smallest gain, because the
      // gain is a difference against him: a better free man is a worse bid.
      bestFree: at[gains.indexOf(low)]?.free ?? null,
      worstFree: at[gains.indexOf(high)]?.free ?? null,
      forSale: first.positions![index].forSale,
      settled: low === high,
    };
  });

  return { positions, reason: null };
};

/**
 * The one line to read before bidding.
 *
 * Written as a fact about the board rather than as advice, for the same reason
 * `modelTrust` is not in `draftAdvisor`: it states what the arithmetic found,
 * and the decision stays the owner's.
 */
export const outlookHeadline = (outlook: SnakeOutlook): string => {
  if (!outlook.positions) return outlook.reason ?? '';
  const ranked = [...outlook.positions]
    .filter((row) => row.forSale && row.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const covered = outlook.positions
    .filter((row) => row.free && (!row.forSale || row.gain <= 0))
    .map((row) => row.position);

  if (!ranked.length) {
    return 'The snake covers every position as well as the auction does. Nothing here is worth bidding up.';
  }
  const spend = ranked
    .slice(0, 2)
    .map((row) => `${row.position} (+${row.gain})`)
    .join(' and ');
  const wait = covered.length ? ` The snake already covers ${covered.join(', ')}.` : '';
  return `Money buys the most at ${spend}.${wait}`;
};
