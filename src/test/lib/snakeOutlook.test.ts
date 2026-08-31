import { describe, expect, it } from 'vitest';
import {
  outlookHeadline,
  snakeOutlook,
  type OutlookSubject,
  snakeOutlookSpread,
} from '@/lib/snakeOutlook';

const p = (
  id: string,
  position: string,
  points: number,
  order: number,
  price = 1
): OutlookSubject => ({ id, name: id, position, points, price, order });

const POSITIONS = ['RB', 'WR', 'QB'];

/**
 * The arithmetic that is specific to this format.
 *
 * VORP measures a player against the last man the league rosters. In a hybrid
 * draft that is the wrong bar: the alternative is whoever survives to your own
 * snake slot, and the gap between those two bars is where a budget gets wasted.
 */
describe('snakeOutlook', () => {
  const snakePool = [
    p('rb-a', 'RB', 200, 1),
    p('wr-a', 'WR', 190, 2),
    p('rb-b', 'RB', 180, 3),
    p('qb-a', 'QB', 300, 4),
    p('wr-b', 'WR', 170, 5),
    p('rb-c', 'RB', 150, 6),
    p('qb-b', 'QB', 290, 7),
    p('wr-c', 'WR', 140, 8),
  ];
  const forSale = [p('rb-star', 'RB', 280, 0, 50), p('qb-star', 'QB', 320, 0, 30)];

  it('measures against what survives to your slot, not against the pool', () => {
    // Picking 4th: three players are gone, so the best free back is the third
    // in the room's order, not the first.
    const out = snakeOutlook({ snakePool, forSale, yourNextSnakePick: 4, positions: POSITIONS });
    const rb = out.positions!.find((r) => r.position === 'RB')!;
    // Survivors from index 3 are rb-a? no — rb-a and rb-b are gone with wr-a.
    // What is left at RB is rb-c, so that is both the first survivor and the
    // best one; the two orders agree here.
    expect(rb.free?.id).toBe('rb-c');
    expect(rb.goneBefore).toBe(2);
    expect(rb.gain).toBe(280 - 150);
  });

  it('gives a later slot a worse free player and a larger gain', () => {
    const early = snakeOutlook({ snakePool, forSale, yourNextSnakePick: 1, positions: POSITIONS });
    const late = snakeOutlook({ snakePool, forSale, yourNextSnakePick: 6, positions: POSITIONS });
    const rbEarly = early.positions!.find((r) => r.position === 'RB')!;
    const rbLate = late.positions!.find((r) => r.position === 'RB')!;
    expect(rbEarly.free!.points).toBeGreaterThan(rbLate.free!.points);
    expect(rbLate.gain).toBeGreaterThan(rbEarly.gain);
  });

  it('uses the room’s order for who is gone and yours for who you take', () => {
    // Two different orders, and conflating them inflates the gain. The room
    // removes players in its own order; you then take the best of what is left
    // by points, because points are what score. A player the market rates low
    // and this model rates high is exactly the one you would take.
    const pool = [p('market-darling', 'RB', 100, 1), p('undervalued', 'RB', 250, 9)];
    const out = snakeOutlook({
      snakePool: pool,
      forSale: [p('s', 'RB', 300, 0, 10)],
      yourNextSnakePick: 1,
      positions: ['RB'],
    });
    expect(out.positions![0].free?.id).toBe('undervalued');
    expect(out.positions![0].gain).toBe(50);
  });

  it('still lets the room take the best ones first', () => {
    // Who is gone is the room's call: at a later slot the player it rates
    // highest has been taken, whatever this model thinks of him.
    const pool = [p('taken-first', 'RB', 400, 1), p('left-over', 'RB', 120, 2)];
    const out = snakeOutlook({
      snakePool: pool,
      forSale: [p('s', 'RB', 300, 0, 10)],
      yourNextSnakePick: 2,
      positions: ['RB'],
    });
    expect(out.positions![0].free?.id).toBe('left-over');
    expect(out.positions![0].goneBefore).toBe(1);
  });

  it('reports no gain where the snake covers the position as well as the money', () => {
    const out = snakeOutlook({
      snakePool: [p('qb-free', 'QB', 310, 1)],
      forSale: [p('qb-buy', 'QB', 300, 0, 40)],
      yourNextSnakePick: 1,
      positions: ['QB'],
    });
    expect(out.positions![0].gain).toBeLessThan(0);
    expect(outlookHeadline(out)).toMatch(/covers every position/i);
  });

  it('prices the gain per dollar, and does not divide by zero', () => {
    const out = snakeOutlook({ snakePool, forSale, yourNextSnakePick: 4, positions: POSITIONS });
    const rb = out.positions!.find((r) => r.position === 'RB')!;
    expect(rb.gainPerDollar).toBeCloseTo(130 / 50, 1);
    const free = snakeOutlook({
      snakePool,
      forSale: [p('x', 'RB', 200, 0, 0)],
      yourNextSnakePick: 1,
      positions: ['RB'],
    });
    expect(free.positions![0].gainPerDollar).toBe(0);
  });

  it('refuses rather than guessing when it does not know where you pick', () => {
    // An outlook computed without your slot is an outlook for somebody else's
    // draft, and it would look exactly as authoritative as a real one.
    const out = snakeOutlook({
      snakePool,
      forSale,
      yourNextSnakePick: null,
      unavailable: 'Mark which team is yours in league settings.',
      positions: POSITIONS,
    });
    expect(out.positions).toBeNull();
    expect(out.reason).toMatch(/Mark which team is yours/);
    expect(outlookHeadline(out)).toMatch(/Mark which team is yours/);
  });

  it('says nothing rather than something wrong when the snake pool is empty', () => {
    const out = snakeOutlook({
      snakePool: [],
      forSale,
      yourNextSnakePick: 1,
      positions: POSITIONS,
    });
    expect(out.positions).toBeNull();
    expect(out.reason).toMatch(/Nobody left/);
  });

  it('handles a position with nothing free and nothing for sale', () => {
    const out = snakeOutlook({
      snakePool: [p('rb', 'RB', 100, 1)],
      forSale: [],
      yourNextSnakePick: 1,
      positions: ['RB', 'TE'],
    });
    const te = out.positions!.find((r) => r.position === 'TE')!;
    expect(te.free).toBeNull();
    expect(te.forSale).toBeNull();
    expect(te.gain).toBe(0);
  });

  it('names the two positions worth spending on, and what the snake covers', () => {
    const out = snakeOutlook({ snakePool, forSale, yourNextSnakePick: 4, positions: POSITIONS });
    const line = outlookHeadline(out);
    expect(line).toContain('RB');
    expect(line).toMatch(/\+\d+/);
  });
});

describe('before the order is drawn', () => {
  const at = (id: string, position: string, points: number, order: number, price = 0) => ({
    id,
    name: id,
    position,
    points,
    price,
    order,
  });

  it('bounds the gain instead of refusing, and every end is a real outlook', () => {
    const snakePool = [
      at('free-a', 'RB', 200, 1),
      at('free-b', 'RB', 150, 2),
      at('free-c', 'RB', 100, 3),
    ];
    const forSale = [at('star', 'RB', 260, 0, 40)];
    const draws = [1, 2, 3];

    const spread = snakeOutlookSpread({ snakePool, forSale, positions: ['RB'] }, draws);
    const row = spread.positions![0];

    // Picking first you keep the 200-point man, so the bid buys 60. Picking
    // third he is gone twice over and it buys 160.
    expect(row.low).toBe(60);
    expect(row.high).toBe(160);
    expect(row.settled).toBe(false);
    expect(row.bestFree?.id).toBe('free-a');
    expect(row.worstFree?.id).toBe('free-c');

    // Both ends have to be numbers the single-slot outlook actually prints,
    // or the range would be a claim of its own rather than a bound on that one.
    const ends = draws.map(
      (draw) =>
        snakeOutlook({ snakePool, forSale, yourNextSnakePick: draw, positions: ['RB'] })
          .positions![0].gain
    );
    expect(Math.min(...ends)).toBe(row.low);
    expect(Math.max(...ends)).toBe(row.high);
  });

  it('marks a position the draw cannot move, which is the field worth having', () => {
    // The picks before yours come off the top of the whole snake pool in the
    // room's order, so a tight end the room ranks below everything they will
    // take in the first round survives every draw: this row is decidable a
    // month early. The filler is what makes that true rather than an artefact
    // of a pool too small to slice.
    const snakePool = [
      ...Array.from({ length: 20 }, (_, i) => at(`filler-${i}`, 'WR', 100 - i, i + 1)),
      at('survivor', 'TE', 120, 99),
    ];
    const forSale = [at('bought', 'TE', 170, 0, 20)];

    const row = snakeOutlookSpread({ snakePool, forSale, positions: ['TE'] }, [1, 2, 3])
      .positions![0];

    expect(row.settled).toBe(true);
    expect(row.low).toBe(50);
    expect(row.high).toBe(50);
    expect(row.bestFree?.id).toBe('survivor');
  });

  it('refuses when there is nothing to bound', () => {
    expect(
      snakeOutlookSpread({ snakePool: [], forSale: [], positions: ['RB'] }, []).positions
    ).toBeNull();
    expect(
      snakeOutlookSpread({ snakePool: [], forSale: [], positions: ['RB'] }, [1]).positions
    ).toBeNull();
  });
});
