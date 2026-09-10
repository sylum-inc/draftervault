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

  it('never prices a player the market has no opinion about, and ranks him last', () => {
    // Two different claims, and they were once conflated into "leave him
    // alone". Not pricing him is the one that matters and is unchanged:
    // inventing a market opinion for somebody no market spoke about is the
    // thing this module exists to refuse. But he still has to sit *somewhere*
    // in the one order the board is drawn in, and the honest place is after
    // every player the market did speak for — not interleaved with them on a
    // rank from a different scale, which is how a $1 backup quarterback came
    // out at #148 above two hundred and fifty players real drafts were taking.
    const out = consensusOverrides([
      player('ranked', 'TE', 20, 1),
      player('unranked', 'TE', 5, null),
      player('missing', 'TE', 4),
    ]);
    expect(out.ranked.value).toBe(20);
    expect(out.unranked.value).toBeUndefined();
    expect(out.missing.value).toBeUndefined();
    expect(out.ranked.rank).toBeLessThan(out.unranked.rank!);
    expect(out.ranked.rank).toBeLessThan(out.missing.rank!);
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
    expect(out.skip.value).toBeUndefined();
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

  it('carries an overall rank on the merged order, and marks which source spoke', () => {
    // Not the raw ADP and not the raw consensus number: with two sources
    // feeding one ordering, a raw figure is incomparable between rows — 41.2
    // from real drafts beside 55 from a panel — while an index into the merged
    // order means the same thing whichever source produced it.
    //
    // It is an *overall* index rather than a per-position one, which is the
    // correction. A position index is equally comparable and equally free of
    // raw numbers, so it looked like the same answer; it is not, because every
    // consumer of this field reads it as overall. The profile prints it as
    // "#n overall" and both boards sort the whole pool by it, so one rank 1 per
    // position made the default board round-robin them and put the TE4 at $3
    // above Ja'Marr Chase.
    const out = consensusOverrides([
      player('a', 'QB', 15, 7),
      player('b', 'QB', 9, 2),
      player('w', 'WR', 40, 4),
    ]);
    expect(out.b.rank).toBe(1);
    expect(out.w.rank).toBe(2);
    expect(out.a.rank).toBe(3);
    expect(out.a.notes).toBe('consensus');
  });

  it('reports how much of the pool the market actually covers', () => {
    expect(
      consensusCoverage([player('a', 'WR', 1, 4), player('b', 'WR', 1), player('c', 'WR', 1, 9)])
    ).toEqual({ ranked: 2, of: 3, fromAdp: 0, fromConsensus: 2 });
  });

  it('handles an empty pool and a pool nobody ranks', () => {
    expect(consensusOverrides([])).toEqual({});
    // Nobody ranked means nobody repriced. They are still put in an order,
    // because the board has to draw them in one, and it is ours: by price.
    const none = consensusOverrides([player('a', 'WR', 5), player('b', 'RB', 4)]);
    expect(Object.values(none).every((override) => override.value === undefined)).toBe(true);
    expect(none.a.rank).toBe(1);
    expect(none.b.rank).toBe(2);
  });
});
