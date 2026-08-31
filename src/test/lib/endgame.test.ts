import { describe, expect, it } from 'vitest';
import { endgame, PACE_WINDOW, type EndgameTeam } from '@/lib/endgame';

const room = (each: number, n = 12): EndgameTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `Team ${i + 1}`, remaining: each }));

const at = (over: Partial<Parameters<typeof endgame>[0]> = {}) =>
  endgame({
    moneyLeft: 1200,
    playersLeft: 30,
    recentPrices: [40, 40, 40],
    teams: room(100),
    myTeamId: null,
    ...over,
  });

/**
 * The arithmetic that says *when* to buy. `snakeOutlook` says what a dollar
 * buys; this says when it goes furthest, and it rests on a constraint rather
 * than a forecast: the money in the room divided by the players still for sale
 * is what the rest must average, whatever anybody believes.
 */
describe('endgame', () => {
  it('computes par as money left over players left', () => {
    expect(at({ moneyLeft: 1200, playersLeft: 30 }).par).toBe(40);
    expect(at({ moneyLeft: 900, playersLeft: 30 }).par).toBe(30);
  });

  it('calls a room spending ahead of its budget a reason to hold', () => {
    // Every auction ends in a fire sale for this reason: the money goes before
    // the players do.
    const out = at({ moneyLeft: 1200, playersLeft: 30, recentPrices: [70, 65, 60] });
    expect(out.lean).toBe('wait');
    expect(out.verdict).toMatch(/have to come down/);
  });

  it('calls money piling up behind few players a reason to buy now', () => {
    const out = at({ moneyLeft: 1200, playersLeft: 30, recentPrices: [20, 22, 18] });
    expect(out.lean).toBe('buy');
    expect(out.verdict).toMatch(/have to rise/);
  });

  it('says nothing useful when the room is paying about par', () => {
    expect(at({ recentPrices: [40, 41, 39] }).lean).toBe('even');
  });

  it('treats a collapsed field of bidders as the strongest signal there is', () => {
    // Beats the pace comparison on purpose: with nobody able to pay, what a
    // player is worth stops mattering.
    const out = at({
      moneyLeft: 1200,
      playersLeft: 30,
      recentPrices: [90, 90, 90],
      teams: [
        { id: 'a', name: 'A', remaining: 600 },
        { id: 'b', name: 'B', remaining: 600 },
        ...room(5, 10),
      ],
    });
    expect(out.liveBidders).toBe(2);
    expect(out.lean).toBe('buy');
    expect(out.verdict).toMatch(/near the floor/);
  });

  it('does not count a team that cannot cover par as competition', () => {
    // A team with $8 left is a spectator. Counting it is how a room reads as
    // richer than it is, right up until it stops bidding.
    const out = at({
      teams: [...room(100, 4), ...room(3, 8)],
      moneyLeft: 424,
      playersLeft: 10,
    });
    expect(out.par).toBe(42);
    expect(out.liveBidders).toBe(4);
    expect(out.teamCount).toBe(12);
  });

  it('reads a pace off recent sales only, so it can still move late', () => {
    // An average over the whole auction is dominated by the opening stars and
    // stops moving, which is the opposite of what a pace is for.
    const opening = Array.from({ length: 20 }, () => 90);
    const out = at({ recentPrices: [10, 10, 10, 10, 10, 10, 10, 10, ...opening] });
    expect(out.pace).toBe(10);
    expect(PACE_WINDOW).toBe(8);
  });

  it('reports your own money as a share of what is left', () => {
    const out = at({
      moneyLeft: 1200,
      teams: [{ id: 'me', name: 'Me', remaining: 300 }, ...room(75, 11)],
      myTeamId: 'me',
    });
    expect(out.yourMoney).toBe(300);
    expect(out.yourShare).toBeCloseTo(0.25, 2);
  });

  it('says nothing about you when no team is marked', () => {
    expect(at().yourMoney).toBeNull();
    expect(at().yourShare).toBeNull();
  });

  it('handles the start and the end without dividing by zero', () => {
    const start = at({ recentPrices: [] });
    expect(start.pace).toBeNull();
    expect(start.verdict).toMatch(/Nothing has sold yet/);
    const done = at({ playersLeft: 0, moneyLeft: 400 });
    expect(done.par).toBe(0);
    expect(done.verdict).toMatch(/auction is over/);
  });
});
