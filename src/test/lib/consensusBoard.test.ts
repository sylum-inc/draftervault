import { describe, expect, it } from 'vitest';
import { consensusCoverage, consensusOverrides } from '@/lib/consensusBoard';

const player = (
  gsis: string,
  position: string,
  auctionValue: number,
  consensusRank: number | null = null
) => ({ gsis, position, auctionValue, consensusRank });

describe('consensusBoard', () => {
  it('takes the order from the market and the dollars from us', () => {
    // Our board: A $50, B $30, C $10. The market has them the other way round.
    const out = consensusOverrides([
      player('a', 'WR', 50, 3),
      player('b', 'WR', 30, 2),
      player('c', 'WR', 10, 1),
    ]);
    expect(out.c.value).toBe(50);
    expect(out.b.value).toBe(30);
    expect(out.a.value).toBe(10);
  });

  it('spends exactly the money our board was spending', () => {
    // The gaps are what an auction argues about, and a permutation keeps every
    // one of them. If this ever stops holding, the board is inventing or
    // destroying budget rather than reallocating it.
    const squad = [
      player('a', 'RB', 41, 4),
      player('b', 'RB', 27, 1),
      player('c', 'RB', 9, 3),
      player('d', 'RB', 3, 2),
    ];
    const out = consensusOverrides(squad);
    const before = squad.reduce((total, p) => total + p.auctionValue, 0);
    const after = squad.reduce((total, p) => total + (out[p.gsis].value ?? 0), 0);
    expect(after).toBe(before);
  });

  it('never reorders across positions, which is the confound it exists to avoid', () => {
    // A pooled consensus list ranks the best quarterback above every receiver.
    // Letting that cross positions would hand the board the positional
    // ordering — the exact thing that made the backtest's first headline wrong,
    // and the thing no auction pays for.
    const out = consensusOverrides([
      player('qb', 'QB', 12, 1),
      player('wr1', 'WR', 50, 2),
      player('wr2', 'WR', 40, 3),
    ]);
    expect(out.qb.value).toBe(12);
    expect(out.wr1.value).toBe(50);
    expect(out.wr2.value).toBe(40);
  });

  it('leaves a player the market has no opinion about entirely alone', () => {
    const out = consensusOverrides([
      player('ranked', 'TE', 20, 1),
      player('unranked', 'TE', 5, null),
      player('missing', 'TE', 4),
    ]);
    expect(out.ranked).toBeDefined();
    expect(out.unranked).toBeUndefined();
    expect(out.missing).toBeUndefined();
  });

  it('does not let an unranked player absorb a ranked one’s price', () => {
    // The curve is built from the ranked players only. Including the unranked
    // ones in it would hand somebody the market declined to rank a price the
    // market implied for somebody else.
    const out = consensusOverrides([
      player('a', 'WR', 60, 2),
      player('skip', 'WR', 55, null),
      player('b', 'WR', 10, 1),
    ]);
    expect(out.b.value).toBe(60);
    expect(out.a.value).toBe(10);
    expect(out.skip).toBeUndefined();
  });

  it('is deterministic when the market ties two players', () => {
    const twice = () =>
      consensusOverrides([
        player('a', 'RB', 30, 5),
        player('b', 'RB', 20, 5),
        player('c', 'RB', 10, 1),
      ]);
    expect(twice()).toEqual(twice());
    // The tie is broken by our own price, so the dearer of the two takes the
    // better slot rather than whichever happened to be earlier in the pool.
    expect(twice().a.value).toBe(20);
    expect(twice().b.value).toBe(10);
  });

  it('carries the market rank and marks whose number it is', () => {
    const out = consensusOverrides([player('a', 'QB', 15, 7)]);
    expect(out.a.rank).toBe(7);
    expect(out.a.notes).toBe('consensus');
  });

  it('reports how much of the pool the market actually covers', () => {
    expect(
      consensusCoverage([player('a', 'WR', 1, 4), player('b', 'WR', 1), player('c', 'WR', 1, 9)])
    ).toEqual({ ranked: 2, of: 3 });
  });

  it('handles an empty pool and a pool nobody ranks', () => {
    expect(consensusOverrides([])).toEqual({});
    expect(consensusOverrides([player('a', 'WR', 5), player('b', 'RB', 4)])).toEqual({});
  });
});
