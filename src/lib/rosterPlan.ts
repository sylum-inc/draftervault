/**
 * What the best affordable roster looks like, and therefore what a dollar is
 * worth.
 *
 * Everything else in this app answers a *local* question: what is this player
 * worth, what does the room have left, what does this bid gain over the man the
 * snake hands you free. The question none of them answers is the one that
 * decides the season — **given $100 and this sheet of sixty, which set of
 * players should I end up with?** — and without it every local answer is
 * unanchored, because "worth $48" means nothing until you know what else those
 * forty-eight dollars could have bought.
 *
 * That gap was not academic. `generateDraftAnalytics` printed a "max bid" of
 * `riskAdjustedValue * 1.15`, under a panel headed *What to bid*, and because
 * the multiplier is the same for everybody the number ranked players in exactly
 * the order their prices already did. It carried no information the price
 * beside it did not. Measured on the shipped board it told the owner to go to
 * $28 on Omarion Hampton, whose gain over the free back is **minus forty-two
 * points** — twenty-eight dollars to make the team worse than doing nothing —
 * while quoting $32 for Amon-Ra St. Brown at plus eighty-three.
 *
 * ## What replaces it
 *
 * This is a knapsack, and it has an exact answer. Each player for sale costs
 * whole dollars and, if bought, fills a seat that the snake would otherwise
 * have filled for nothing. Maximise the starting lineup's points subject to the
 * budget and the roster's shape, and two things fall out:
 *
 *   **The plan** — the best affordable set at these prices.
 *
 *   **The price of a dollar** — how many points the marginal dollar buys under
 *   that plan. This is the number the night actually turns on. A player is
 *   worth bidding on while the points he adds per dollar beat it, and not a
 *   cent beyond, because past that the money buys more somewhere else.
 *
 * ## Why the objective is lineup points and not "sum of gains"
 *
 * The tempting formulation — add up each player's gain over "the free man at
 * his position" — double-counts, and it took a worked example to see why. A
 * league starting two backs with free men A (196) and B (154) available: buying
 * nobody scores A + B. Buying Gibbs (278) scores Gibbs + A, because you still
 * take the best free back for the *other* seat. So the first back you buy is
 * measured against **B, the worse one**, and the second against A. Summing "gain
 * over the best free man" twice would credit A's replacement twice and never
 * B's.
 *
 * Scoring the whole lineup instead makes the baseline a constant, so the
 * ambiguity disappears: maximising the lineup maximises the gain over it, and
 * which free man each purchase displaces is bookkeeping the search does rather
 * than a rule anybody has to state.
 *
 * ## What it refuses
 *
 * Everything `snakeOutlook` refuses, for the same reasons and inherited from
 * it: no sheet, no team marked as yours, no snake order drawn. A plan built on
 * a guess about where you pick is a plan for somebody else's draft and would
 * look exactly as authoritative as a real one.
 */

export interface PlanCandidate {
  id: string;
  name: string;
  position: string;
  /** Whole dollars — what he is expected to actually cost. */
  price: number;
  /** Projected points at this league's scoring. */
  points: number;
}

export interface PlanInput {
  candidates: readonly PlanCandidate[];
  /**
   * Points of the free men expected to survive to your picks, best first, per
   * position. The counterfactual every purchase is measured against.
   */
  freeByPosition: Readonly<Record<string, readonly number[]>>;
  /** Starting seats still to fill at each position, the flex excluded. */
  openSeats: Readonly<Record<string, number>>;
  /** Flex seats still open, and which positions may fill one. */
  flexOpen: number;
  flexPositions: readonly string[];
  /** Whole dollars still committable. */
  budget: number;
}

export interface PlanBuy {
  candidate: PlanCandidate;
  /** Whether he takes a dedicated seat or the flex. */
  seat: 'starter' | 'flex';
  /** Points this purchase adds to the lineup, in the order the plan buys. */
  gain: number;
}

export interface RosterPlan {
  /** The best affordable set, dearest first. */
  buy: PlanBuy[];
  spend: number;
  /** Points the whole plan adds over filling every seat from the snake. */
  gain: number;
  /**
   * What the marginal dollar buys, in points.
   *
   * The threshold to bid against: above this rate a bid is buying more than the
   * money would elsewhere, below it the money is better kept. Zero when nothing
   * on the board is worth buying at all, which is a real answer in a format
   * where eleven seats are free.
   */
  perDollar: number;
  /** Best lineup points reachable at each budget from 0 to `budget`. */
  curve: readonly number[];
  /**
   * Dollars the best lineup does not need.
   *
   * Not `budget - spend`: there can be several ways to reach the same lineup
   * and this is the cheapest of them, so it is the most that can be spent
   * elsewhere without costing a point. It is the floor under every price in
   * `maxPriceFor`, because **money left unspent at the end of an auction scores
   * nothing** — so any player who can be rostered is worth at least this much,
   * however little he adds to the lineup.
   */
  slack: number;
  /** Set when no plan can honestly be computed, and nothing else is. */
  reason: string | null;
}

/** Positions a plan will never spend on, and the reason it never should. */
const NEVER_BUY = new Set(['K', 'DST']);

const EMPTY: RosterPlan = {
  buy: [],
  spend: 0,
  gain: 0,
  perDollar: 0,
  curve: [0],
  slack: 0,
  reason: null,
};

interface Shape {
  /** Positions the plan may spend on, in a fixed order. */
  positions: string[];
  /** How many of each it could ever want: seats plus whatever the flex allows. */
  caps: number[];
  /** Mixed-radix strides for encoding the counts as one integer. */
  strides: number[];
  states: number;
  /**
   * Every state's counts, decoded once.
   *
   * The inner loop runs items × dollars × states — three quarters of a million
   * times on a real sheet — and decoding the state inside it allocated a fresh
   * array each pass. That was the whole cost: nominating a player went from
   * about two hundred milliseconds to seven hundred under a 4x CPU throttle,
   * on the one path that runs while a name is being called. There are only a
   * hundred and twenty states; they are decoded here, once.
   */
  counts: Int32Array;
  /** Whether each position may take the flex, by slot. */
  flexible: boolean[];
}

const shapeOf = (input: PlanInput): Shape => {
  const positions = Object.keys(input.openSeats)
    .filter((position) => !NEVER_BUY.has(position))
    .filter(
      (position) =>
        (input.openSeats[position] ?? 0) > 0 ||
        (input.flexOpen > 0 && input.flexPositions.includes(position))
    )
    .sort();
  const caps = positions.map(
    (position) =>
      (input.openSeats[position] ?? 0) +
      (input.flexPositions.includes(position) ? input.flexOpen : 0)
  );
  const strides: number[] = [];
  let states = 1;
  for (const cap of caps) {
    strides.push(states);
    states *= cap + 1;
  }

  const width = positions.length;
  const counts = new Int32Array(states * width);
  for (let state = 0; state < states; state += 1) {
    let rest = state;
    for (let index = 0; index < width; index += 1) {
      counts[state * width + index] = rest % (caps[index] + 1);
      rest = Math.floor(rest / (caps[index] + 1));
    }
  }
  const flexible = positions.map((position) => input.flexPositions.includes(position));
  return { positions, caps, strides, states, counts, flexible };
};

/**
 * What the snake fills the seats this plan leaves empty with.
 *
 * The other half of the objective, and the half that makes the counterfactual
 * honest: a plan that buys one of two backs still gets a back for the second
 * seat, and a plan that buys neither gets two. Free men are taken best first,
 * and the flex takes the best one still unused across every eligible position —
 * which is why it is computed after the dedicated seats rather than alongside
 * them.
 */
const freeFill = (input: PlanInput, shape: Shape, counts: readonly number[]): number => {
  let total = 0;
  // How far into each position's free list the dedicated seats have eaten.
  const used: Record<string, number> = {};
  let flexTaken = 0;

  for (let index = 0; index < shape.positions.length; index += 1) {
    const position = shape.positions[index];
    const seats = input.openSeats[position] ?? 0;
    const bought = counts[index];
    const fromSnake = Math.max(0, seats - bought);
    const free = input.freeByPosition[position] ?? [];
    for (let k = 0; k < fromSnake; k += 1) total += free[k] ?? 0;
    used[position] = fromSnake;
    if (input.flexPositions.includes(position)) flexTaken += Math.max(0, bought - seats);
  }

  // Seats at a position with no candidates in the shape at all still get filled.
  for (const [position, seats] of Object.entries(input.openSeats)) {
    if (shape.positions.includes(position) || NEVER_BUY.has(position)) continue;
    const free = input.freeByPosition[position] ?? [];
    for (let k = 0; k < seats; k += 1) total += free[k] ?? 0;
    used[position] = seats;
  }

  for (let seat = flexTaken; seat < input.flexOpen; seat += 1) {
    let best = 0;
    let bestPosition: string | null = null;
    for (const position of input.flexPositions) {
      const free = input.freeByPosition[position] ?? [];
      const next = free[used[position] ?? 0] ?? 0;
      if (next > best) {
        best = next;
        bestPosition = position;
      }
    }
    if (!bestPosition) break;
    used[bestPosition] = (used[bestPosition] ?? 0) + 1;
    total += best;
  }
  return total;
};

interface Table {
  /** Best points bought, by state then by dollars. -Infinity where unreachable. */
  best: Float64Array;
  /** How each cell was reached, for reading the plan back out. */
  from: Int32Array;
  took: Int32Array;
  shape: Shape;
  width: number;
}

/**
 * Which roster states one more player at this slot may legally be added to.
 *
 * A dedicated seat while any remain, the flex once they are gone, and nothing
 * at all after that — a bench body gains nothing, because the snake fills a
 * bench for free.
 */
const allow = (input: PlanInput, shape: Shape, slot: number, seats: number): Uint8Array => {
  const width = shape.positions.length;
  const out = new Uint8Array(shape.states);
  for (let state = 0; state < shape.states; state += 1) {
    const here = shape.counts[state * width + slot];
    if (here >= shape.caps[slot]) continue;
    if (here >= seats) {
      if (!shape.flexible[slot]) continue;
      let flexUsed = 0;
      for (let index = 0; index < width; index += 1) {
        if (!shape.flexible[index]) continue;
        flexUsed += Math.max(
          0,
          shape.counts[state * width + index] - (input.openSeats[shape.positions[index]] ?? 0)
        );
      }
      if (flexUsed >= input.flexOpen) continue;
    }
    out[state] = 1;
  }
  return out;
};

const solve = (input: PlanInput, shape: Shape, skipId: string | null): Table => {
  const width = input.budget + 1;
  const cells = shape.states * width;
  const best = new Float64Array(cells).fill(Number.NEGATIVE_INFINITY);
  const from = new Int32Array(cells).fill(-1);
  const took = new Int32Array(cells).fill(-1);
  best[0] = 0;

  for (let item = 0; item < input.candidates.length; item += 1) {
    const candidate = input.candidates[item];
    if (candidate.id === skipId) continue;
    const slot = shape.positions.indexOf(candidate.position);
    if (slot < 0) continue;
    const price = Math.max(0, Math.round(candidate.price));
    if (price > input.budget) continue;
    const seats = input.openSeats[candidate.position] ?? 0;

    // Which states this candidate may be added to at all, decided once per
    // candidate rather than once per (candidate, dollar) — the feasibility
    // question is about the roster, and dollars have no bearing on it.
    const allowed = allow(input, shape, slot, seats);

    // Dollars descend so each candidate is used at most once — the ordinary
    // 0/1 knapsack sweep, and the reason a player cannot be bought twice.
    for (let dollars = input.budget - price; dollars >= 0; dollars -= 1) {
      for (let state = 0; state < shape.states; state += 1) {
        if (!allowed[state]) continue;
        const at = state * width + dollars;
        const have = best[at];
        if (have === Number.NEGATIVE_INFINITY) continue;

        const next = (state + shape.strides[slot]) * width + dollars + price;
        const value = have + candidate.points;
        if (value > best[next]) {
          best[next] = value;
          from[next] = at;
          took[next] = item;
        }
      }
    }
  }
  return { best, from, took, shape, width };
};

const decode = (state: number, shape: Shape): number[] => {
  const width = shape.positions.length;
  const counts: number[] = new Array(width);
  for (let index = 0; index < width; index += 1) {
    counts[index] = shape.counts[state * width + index];
  }
  return counts;
};

/** The best lineup reachable for each budget, and where the best one sits. */
const readCurve = (input: PlanInput, shape: Shape, table: Table) => {
  const curve = new Array<number>(input.budget + 1).fill(0);
  let bestCell = -1;
  let bestTotal = Number.NEGATIVE_INFINITY;
  // Cached because the fill is a function of the counts alone, and the same
  // counts appear once per dollar.
  const fills = new Float64Array(shape.states);
  for (let state = 0; state < shape.states; state += 1) {
    fills[state] = freeFill(input, shape, decode(state, shape));
  }

  for (let dollars = 0; dollars <= input.budget; dollars += 1) {
    let bestHere = dollars > 0 ? curve[dollars - 1] : Number.NEGATIVE_INFINITY;
    for (let state = 0; state < shape.states; state += 1) {
      const cell = state * table.width + dollars;
      const bought = table.best[cell];
      if (bought === Number.NEGATIVE_INFINITY) continue;
      const total = bought + fills[state];
      if (total > bestHere) bestHere = total;
      if (total > bestTotal) {
        bestTotal = total;
        bestCell = cell;
      }
    }
    curve[dollars] = bestHere === Number.NEGATIVE_INFINITY ? 0 : bestHere;
  }
  return { curve, bestCell, bestTotal };
};

/**
 * The best affordable roster at these prices, and what a dollar is worth.
 */
export const rosterPlan = (input: PlanInput): RosterPlan => {
  if (input.budget <= 0 || !input.candidates.length) return EMPTY;
  const shape = shapeOf(input);
  if (!shape.positions.length) return EMPTY;

  const table = solve(input, shape, null);
  const { curve, bestCell } = readCurve(input, shape, table);

  const buy: PlanBuy[] = [];
  let cell = bestCell;
  let spend = 0;
  while (cell >= 0 && table.took[cell] >= 0) {
    const candidate = input.candidates[table.took[cell]];
    const previous = table.from[cell];
    const dollars = cell % table.width;
    const before = previous % table.width;
    spend += dollars - before;
    const counts = decode(Math.floor(cell / table.width), shape);
    const slot = shape.positions.indexOf(candidate.position);
    const seats = input.openSeats[candidate.position] ?? 0;
    buy.push({
      candidate,
      seat: counts[slot] > seats ? 'flex' : 'starter',
      // Filled below: a purchase's contribution is only meaningful against the
      // plan it sits in, so it is read off the curve rather than guessed at.
      gain: 0,
    });
    cell = previous;
  }
  buy.reverse();

  const baseline = freeFill(
    input,
    shape,
    shape.positions.map(() => 0)
  );
  const total = curve[input.budget];

  // Each purchase's own contribution, in the order the plan makes them: what
  // the lineup scores with it against what it scores without.
  let running = baseline;
  const counts = shape.positions.map(() => 0);
  let bought = 0;
  for (const entry of buy) {
    const slot = shape.positions.indexOf(entry.candidate.position);
    counts[slot] += 1;
    bought += entry.candidate.points;
    const after = bought + freeFill(input, shape, counts);
    entry.gain = Math.round(after - running);
    running = after;
  }

  /*
   * The price of a dollar, taken over the last ten rather than the last one.
   *
   * A single dollar's difference is integer noise — the curve is a staircase
   * and most steps are flat — so the marginal rate read off one step is
   * frequently zero for a budget that is buying plenty. Ten dollars is short
   * enough to still be marginal and long enough to cross a step.
   */
  const window = Math.min(10, input.budget);
  const perDollar = window > 0 ? (curve[input.budget] - curve[input.budget - window]) / window : 0;

  // The cheapest budget that still reaches the best lineup. Everything above it
  // is money the plan has no use for, and in an auction that money is worth
  // nothing unless it is spent on somebody.
  let cheapest = input.budget;
  while (cheapest > 0 && curve[cheapest - 1] >= curve[input.budget] - 1e-9) cheapest -= 1;

  return {
    buy: buy.sort((a, b) => b.candidate.price - a.candidate.price),
    spend,
    gain: Math.round(total - baseline),
    perDollar: Math.round(Math.max(0, perDollar) * 100) / 100,
    curve,
    slack: input.budget - cheapest,
    reason: null,
  };
};

export interface PlayerValue {
  /** Points he would add to the lineup as it stands, right now. */
  gain: number;
  /** The most he is worth at the plan's own rate. */
  maxPrice: number;
  /** Which seat he would take: the flex is the one this format contests. */
  seat: 'starter' | 'flex' | 'bench';
}

/**
 * What every player for sale is worth, at the rate the plan sets.
 *
 * This replaced an exact re-solve — "what is the most I could pay for him and
 * still beat the best plan that excludes him" — and the reason is worth stating
 * carefully, because the re-solve is the *more precise* answer to the *wrong
 * question*.
 *
 * The re-solve asks whether to buy him **instead of** the optimal basket. That
 * only makes sense if the basket is guaranteed, and it never is: sixty players
 * come up one at a time in an order nobody controls, and you will be outbid on
 * some of them. Under that uncertainty the re-solve priced fifty-seven of the
 * sixty at zero — advice that has you holding a hundred dollars and a bad
 * roster if two of your three targets go elsewhere.
 *
 * The question actually faced sixty times, once per name called, is *is he
 * better value than the money?* — and that is the knapsack's **dual**. The plan
 * prices a dollar at `perDollar` points; a player is worth exactly the price at
 * which the points he adds per dollar meet that rate, which is `gain ÷ rate`.
 * Every player who helps the lineup at all therefore has a real bid, which is
 * the property that makes this usable at a live auction and the previous
 * version not.
 *
 * The two disagree by the knapsack's duality gap — the plan will pay $47 for a
 * man the rate prices at $46, because he happens to fit the budget exactly. A
 * plan that would pay a price is a demonstration that the price is worth
 * paying, so anybody in it is floored at what it pays for him. The gap closes
 * and neither number has to be explained away.
 */
export const valueBoard = (input: PlanInput, plan: RosterPlan): Map<string, PlayerValue> => {
  const out = new Map<string, PlayerValue>();
  if (!input.candidates.length) return out;
  const shape = shapeOf(input);
  const zero = shape.positions.map(() => 0);
  const base = freeFill(input, shape, zero);
  const planPrice = new Map(plan.buy.map((entry) => [entry.candidate.id, entry.candidate.price]));

  for (const candidate of input.candidates) {
    const slot = shape.positions.indexOf(candidate.position);
    let gain = 0;
    let seat: PlayerValue['seat'] = 'bench';

    if (slot >= 0 && shape.caps[slot] > 0) {
      const counts = zero.slice();
      counts[slot] = 1;
      /*
       * Never below nothing, because owning a player is not an obligation to
       * start him.
       *
       * Forced into the seat, a man behind the free alternative comes out at
       * minus four — as though buying him actively damaged the lineup. He does
       * not: you bench him and start the free man exactly as you would have.
       * What he costs is the dollars, and what he adds is zero, and those are
       * different statements from a negative gain.
       */
      gain = Math.max(0, candidate.points + freeFill(input, shape, counts) - base);
      seat =
        gain <= 0 ? 'bench' : 1 <= (input.openSeats[candidate.position] ?? 0) ? 'starter' : 'flex';
    }

    /*
     * A player who adds nothing is still worth the money the lineup spares,
     * because an unspent auction dollar scores nothing at all. And where the
     * plan cannot use the budget — `perDollar` of zero, the endgame state where
     * the money outlasts anything worth buying — a player who helps is worth
     * every dollar left, since holding it is the one guaranteed way to score
     * nothing with it.
     */
    const rate =
      gain <= 0
        ? plan.slack
        : plan.perDollar > 0
          ? Math.round(gain / plan.perDollar)
          : input.budget;

    out.set(candidate.id, {
      gain: Math.round(gain),
      seat,
      maxPrice: Math.max(
        0,
        Math.min(input.budget, Math.max(rate, plan.slack, planPrice.get(candidate.id) ?? 0))
      ),
    });
  }
  return out;
};
