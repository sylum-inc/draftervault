import { describe, expect, it } from 'vitest';
import { maxPriceFor, rosterPlan, type PlanInput } from '@/lib/rosterPlan';

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
    // The same board with a quarter of the money: now every dollar is contested.
    const plan = rosterPlan({ ...board, budget: 40 });
    expect(plan.perDollar).toBeGreaterThan(0);
    expect(plan.spend).toBeLessThanOrEqual(40);
  });

  /*
   * The defect this whole module replaces. `maxBid` was `price * 1.15`, so it
   * ranked players in exactly the order their prices already did and told the
   * owner to pay $28 for a man who makes the lineup forty-two points worse.
   */
  /*
   * A player the snake matches is not a player worth nothing.
   *
   * This asserted zero first, because the search forced a bought man into a
   * seat — so somebody behind the free alternative *reduced* the lineup, as
   * though owning him were an act of self-harm. Nobody starts a player worse
   * than the one the snake handed them: you bench him, and benching costs the
   * lineup nothing. What he is worth is whatever the best lineup has no other
   * use for, because a dollar left unspent at the end of an auction scores
   * nothing at all.
   */
  it('is worth the leftover money for a player the snake matches', () => {
    const plan = rosterPlan(board);
    // `meh` is 120 against free backs of 196 and 154 — behind both, so he adds
    // nothing to the lineup and is worth exactly the money the lineup spares.
    expect(maxPriceFor(board, 'meh')).toBe(plan.slack);
    expect(plan.slack).toBeGreaterThan(0);
  });

  it('spares less as the budget tightens, and prices him at exactly that', () => {
    // The invariant, not a number: a player who adds nothing to the lineup is
    // worth precisely the money the lineup has no use for — at every budget.
    // Prices are whole dollars, so an optimum almost never lands exactly on the
    // budget and there is usually a little change; what changes with the budget
    // is how much.
    const wide = rosterPlan({ ...board, budget: 100 });
    const tight = rosterPlan({ ...board, budget: 30 });
    expect(maxPriceFor({ ...board, budget: 100 }, 'meh')).toBe(wide.slack);
    expect(maxPriceFor({ ...board, budget: 30 }, 'meh')).toBe(tight.slack);
    expect(tight.slack).toBeLessThan(wide.slack);
  });

  it('is worth more than his price when the gap is big', () => {
    const cheap = maxPriceFor(board, 'cheap')!;
    // 200 points against a fourth free receiver: worth well past the $8 asked.
    expect(cheap).toBeGreaterThan(8);
  });

  it('never exceeds the budget, and never goes negative', () => {
    for (const entry of board.candidates) {
      const price = maxPriceFor(board, entry.id)!;
      expect(price).toBeGreaterThanOrEqual(0);
      expect(price).toBeLessThanOrEqual(board.budget);
    }
  });

  it('still prices a man whose every seat is taken, at what the plan spares', () => {
    const filled = { ...board, openSeats: { RB: 0, WR: 0 }, flexOpen: 0 };
    // Nothing left to buy, so the whole budget is spare and he is worth all of
    // it — which is the correct instruction at the end of an auction, where
    // holding money is the one guaranteed way to score nothing with it.
    expect(maxPriceFor(filled, 'star')).toBe(rosterPlan(filled).slack);
  });

  it('says nothing rather than guessing when he is not on the board', () => {
    expect(maxPriceFor(board, 'nobody')).toBeNull();
  });
});
