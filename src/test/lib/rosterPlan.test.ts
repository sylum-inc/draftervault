import { describe, expect, it } from 'vitest';
import { rosterPlan, valueBoard, type PlanInput } from '@/lib/rosterPlan';

/** What one player is worth at the rate the plan sets. */
const priceOf = (input: PlanInput, id: string): number =>
  valueBoard(input, rosterPlan(input)).get(id)?.maxPrice ?? 0;
const gainOf = (input: PlanInput, id: string): number =>
  valueBoard(input, rosterPlan(input)).get(id)?.gain ?? 0;

/**
 * The plan, and the price of a dollar.
 *
 * Every case here is small enough to work out by hand, because the whole point
 * of the module is that the answer is exact rather than a multiplier somebody
 * chose — and an exact answer nobody has checked by hand is just a longer
 * multiplier.
 */
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  candidates: [],
  freeByPosition: {},
  openSeats: { RB: 2, WR: 3, TE: 1, QB: 1 },
  flexOpen: 1,
  flexPositions: ['RB', 'WR', 'TE'],
  budget: 100,
  ...over,
});

const player = (id: string, position: string, price: number, points: number) => ({
  id,
  name: id,
  position,
  price,
  points,
});

describe('the best affordable roster', () => {
  it('buys nothing when the snake hands you the same players', () => {
    const plan = rosterPlan(
      base({
        candidates: [player('a', 'RB', 20, 150), player('b', 'WR', 15, 120)],
        // Deep enough to fill the flex too: a free list shorter than the seats
        // it has to cover makes an empty seat score zero, and then *any*
        // purchase looks like an improvement for a reason that is about the
        // fixture rather than about the format.
        freeByPosition: {
          RB: [160, 160, 160],
          WR: [130, 130, 130, 130],
          TE: [90, 90],
          QB: [200, 200],
        },
      })
    );
    // Paying for a man the snake would have handed over is the one thing this
    // format punishes hardest, and it is what half a commissioner's sheet is.
    expect(plan.buy).toHaveLength(0);
    expect(plan.gain).toBe(0);
    expect(plan.perDollar).toBe(0);
  });

  it('spends where the gap is, not where the points are', () => {
    const plan = rosterPlan(
      base({
        openSeats: { RB: 1, WR: 1 },
        flexOpen: 0,
        candidates: [
          // More points, but the snake nearly matches him.
          player('rich', 'RB', 30, 300),
          // Fewer points, and the snake has nothing behind him.
          player('scarce', 'WR', 30, 200),
        ],
        freeByPosition: { RB: [290], WR: [80] },
        budget: 30,
      })
    );
    expect(plan.buy.map((entry) => entry.candidate.id)).toEqual(['scarce']);
    expect(plan.gain).toBe(120);
  });

  /*
   * The worked example from the module's own doc block, and the reason the
   * objective is lineup points rather than a sum of per-player gains.
   */
  it('measures the first of two backs against the worse free man, not the better', () => {
    const plan = rosterPlan(
      base({
        openSeats: { RB: 2 },
        flexOpen: 0,
        candidates: [player('gibbs', 'RB', 40, 278)],
        freeByPosition: { RB: [196, 154] },
        budget: 100,
      })
    );
    // Buying nobody scores 196 + 154 = 350. Buying Gibbs scores 278 + 196 = 474,
    // because the *other* seat still takes the best free back. So the gain is
    // against 154, the one you no longer need — 124, not 82.
    expect(plan.gain).toBe(124);
    expect(plan.buy[0].gain).toBe(124);
  });

  it('puts a second man at a one-seat position into the flex', () => {
    const plan = rosterPlan(
      base({
        openSeats: { RB: 1 },
        flexOpen: 1,
        flexPositions: ['RB'],
        candidates: [player('rb1', 'RB', 10, 250), player('rb2', 'RB', 10, 240)],
        freeByPosition: { RB: [100, 90, 80] },
        budget: 20,
      })
    );
    // Both are worth buying against free backs of 100 and 90; the first takes
    // the dedicated seat and the second can only be in the lineup through the
    // flex, which is the seat this format's third back is really competing for.
    expect(plan.buy).toHaveLength(2);
    expect(plan.buy.map((entry) => entry.seat).sort()).toEqual(['flex', 'starter']);
  });

  it('leaves the flex to the snake when nothing for sale beats what is free', () => {
    const plan = rosterPlan(
      base({
        openSeats: { RB: 1 },
        flexOpen: 1,
        flexPositions: ['RB'],
        candidates: [player('rb1', 'RB', 10, 250), player('rb2', 'RB', 30, 95)],
        freeByPosition: { RB: [100, 90, 80] },
        budget: 100,
      })
    );
    // rb2 at 95 points is behind the second free back at 90 by five, which
    // thirty dollars does not buy. The seat is filled for nothing instead.
    expect(plan.buy.map((entry) => entry.candidate.id)).toEqual(['rb1']);
  });

  it('respects the budget exactly', () => {
    const plan = rosterPlan(
      base({
        openSeats: { RB: 2 },
        flexOpen: 0,
        candidates: [
          player('a', 'RB', 60, 300),
          player('b', 'RB', 40, 280),
          player('c', 'RB', 30, 250),
        ],
        freeByPosition: { RB: [100, 90] },
        budget: 70,
      })
    );
    expect(plan.spend).toBeLessThanOrEqual(70);
    // b + c is 70 for 530 points; a alone is 60 for 300 and leaves one seat at 100.
    expect(plan.buy.map((entry) => entry.candidate.id).sort()).toEqual(['b', 'c']);
  });

  it('never buys a kicker or a defence, whatever they cost', () => {
    const plan = rosterPlan(
      base({
        openSeats: { K: 1, DST: 1, RB: 1 },
        flexOpen: 0,
        candidates: [player('k', 'K', 1, 140), player('d', 'DST', 1, 130)],
        freeByPosition: { K: [120], DST: [110], RB: [100] },
        budget: 100,
      })
    );
    // The snake hands both over and the pool prices them at a dollar or two; a
    // plan that buys one has misunderstood the format.
    expect(plan.buy).toHaveLength(0);
  });
});

describe('the price of a dollar', () => {
  const board: PlanInput = base({
    openSeats: { RB: 2, WR: 3 },
    flexOpen: 1,
    flexPositions: ['RB', 'WR'],
    candidates: [
      player('star', 'RB', 48, 278),
      player('good', 'WR', 28, 240),
      player('meh', 'RB', 26, 120),
      player('cheap', 'WR', 8, 200),
    ],
    freeByPosition: { RB: [196, 154, 120, 90], WR: [180, 170, 160, 150, 140] },
    budget: 100,
  });

  it('never lets more money buy less', () => {
    const plan = rosterPlan(board);
    for (let d = 1; d < plan.curve.length; d += 1) {
      expect(plan.curve[d]).toBeGreaterThanOrEqual(plan.curve[d - 1]);
    }
  });

  /*
   * Zero is a real reading, and an important one.
   *
   * With four candidates and a hundred dollars the whole worthwhile board costs
   * $84, so the last ten dollars buy nothing — the budget is not the binding
   * constraint, the board is. That is the state a hybrid draft spends its
   * endgame in, and it is the opposite instruction from a scarce dollar: bid
   * up, because the money has nowhere better to go.
   */
  it('is zero when the money outlasts anything worth buying', () => {
    expect(rosterPlan(board).perDollar).toBe(0);
    expect(rosterPlan(board).spend).toBeLessThan(board.budget);
  });

  it('is positive when the budget is what binds', () => {
    const plan = rosterPlan({ ...board, budget: 40 });
    expect(plan.perDollar).toBeGreaterThan(0);
    expect(plan.spend).toBeLessThanOrEqual(40);
  });
});

/*
 * The dual, and the property the primal could not have.
 *
 * "What is the most I could pay and still beat the best plan without him" is
 * the more precise answer to the wrong question: it assumes the plan is
 * guaranteed, and priced fifty-seven of sixty auction players at zero. Sixty
 * players come up one at a time and you will be outbid on some, so the question
 * actually faced is whether he is better value than the money — which is the
 * rate the plan sets, and gives every player who helps at all a real bid.
 */
describe('what a player is worth at that rate', () => {
  const tight: PlanInput = base({
    openSeats: { RB: 2, WR: 3 },
    flexOpen: 1,
    flexPositions: ['RB', 'WR'],
    candidates: [
      player('star', 'RB', 30, 278),
      player('good', 'WR', 20, 240),
      player('marginal', 'RB', 10, 160),
      player('behind', 'RB', 10, 100),
    ],
    freeByPosition: { RB: [196, 154, 120, 90], WR: [180, 170, 160, 150, 140] },
    budget: 40,
  });

  it('gives every player who helps the lineup a price above nothing', () => {
    const values = valueBoard(tight, rosterPlan(tight));
    for (const [id, value] of values) {
      if (value.gain > 0) expect(value.maxPrice, id).toBeGreaterThan(0);
    }
    // `good` is not in the plan and is still worth bidding on, which is the
    // whole point: he is what you buy when somebody outbids you on `star`, and
    // the version this replaced priced him at nothing for exactly that reason.
    expect(rosterPlan(tight).buy.map((entry) => entry.candidate.id)).not.toContain('good');
    expect(priceOf(tight, 'good')).toBeGreaterThan(0);
  });

  it('never prices a man below what the plan itself would pay for him', () => {
    // Primal and dual disagree by the knapsack's duality gap, and a plan that
    // would pay a price is a demonstration that the price is worth paying.
    for (const entry of rosterPlan(tight).buy) {
      expect(priceOf(tight, entry.candidate.id)).toBeGreaterThanOrEqual(entry.candidate.price);
    }
  });

  it('is worth more the more he adds, off one line for the whole board', () => {
    const values = valueBoard(tight, rosterPlan(tight));
    const ranked = ['star', 'good', 'marginal', 'behind'].map((id) => values.get(id)!);
    // One rate the whole board is read off, not sixty separate judgements: more
    // gain can never fetch a lower price. Ties are the budget capping the top,
    // which is the rules speaking rather than the valuation.
    for (let index = 1; index < ranked.length; index += 1) {
      expect(ranked[index - 1].gain).toBeGreaterThan(ranked[index].gain);
      expect(ranked[index - 1].maxPrice).toBeGreaterThanOrEqual(ranked[index].maxPrice);
    }
  });

  it('never asks for more than the budget allows', () => {
    for (const value of valueBoard(tight, rosterPlan(tight)).values()) {
      expect(value.maxPrice).toBeLessThanOrEqual(tight.budget);
    }
  });

  it('names the seat, because the flex is what this format contests', () => {
    const values = valueBoard(tight, rosterPlan(tight));
    expect(values.get('star')!.seat).toBe('starter');
    // A man behind both free backs adds nothing to the lineup and is bench
    // depth however much he costs.
    expect(values.get('behind')!.seat).toBe('bench');
  });

  /*
   * The bookkeeping that makes a gain worth computing rather than stating.
   *
   * Two RB seats with free men at 196 and 154: the first back bought displaces
   * the *worse* of them, so a 278-point back is +124 rather than the +82 a gap
   * to the best free man would report. And then the flex, which had been taking
   * the best free receiver at 150, can take the freed-up back at 154 instead —
   * so the real figure is 128. Every hand-worked version of this arithmetic in
   * this file has come out four points light by forgetting that second step,
   * which is the argument for the search doing it.
   */
  it('measures the gain against the seat he takes and the flex it frees', () => {
    expect(gainOf(tight, 'star')).toBe(128);
  });
});
