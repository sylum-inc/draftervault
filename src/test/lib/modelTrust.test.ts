import { describe, expect, it } from 'vitest';
import { CONSENSUS_VERDICT, modelCaveats } from '@/lib/modelTrust';

/**
 * These thresholds are not style. Each one is a bucket `npm run backtest`
 * printed, and a caveat that has drifted off the bucket it was measured on is
 * an unsupported claim wearing the authority of a measurement — which is the
 * exact failure `researchContract.ts` exists to prevent one register over.
 */
describe('modelTrust', () => {
  const at = (over: Partial<Parameters<typeof modelCaveats>[0]> = {}) =>
    modelCaveats({ position: 'WR', age: 25, gamesObserved: 45, ...over }).map((c) => c.id);

  it('flags nothing for a player outside every measured blind spot', () => {
    expect(at()).toEqual([]);
  });

  it('flags one to sixteen games of tape, and neither side of it', () => {
    expect(at({ gamesObserved: 1 })).toContain('tape:WR');
    expect(at({ gamesObserved: 16 })).toContain('tape:WR');
    expect(at({ gamesObserved: 17 })).not.toContain('tape:WR');
  });

  it('does not call a player with no tape at all a partial-tape risk', () => {
    // A rookie is a different bucket with a different score (rho 0.33-0.51,
    // against 0.04-0.21 for a partial season), so claiming the partial-season
    // finding about him would be quoting the wrong number at him.
    expect(at({ gamesObserved: 0 })).toEqual([]);
    expect(at({ gamesObserved: null })).toEqual([]);
    expect(at({ gamesObserved: undefined })).toEqual([]);
  });

  it('flags thirty and over, and not twenty-nine', () => {
    expect(at({ age: 30 })).toContain('age:30');
    expect(at({ age: 34 })).toContain('age:30');
    expect(at({ age: 29 })).not.toContain('age:30');
    expect(at({ age: null })).not.toContain('age:30');
  });

  it('flags tight end, the position the market beat us at every season', () => {
    expect(at({ position: 'TE' })).toContain('position:TE');
    expect(at({ position: 'RB' })).not.toContain('position:TE');
  });

  it('stacks every caveat that applies, with ids stable enough to key on', () => {
    const ids = at({ position: 'TE', age: 31, gamesObserved: 9 });
    expect(ids).toEqual(['tape:TE', 'age:30', 'position:TE']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('quotes numbers rather than adjectives, and never a price', () => {
    const all = modelCaveats({ position: 'TE', age: 31, gamesObserved: 9 });
    for (const caveat of all) {
      expect(caveat.detail).toMatch(/\d/);
      // An opinion layer may say "pay up"; a measurement may not, and a dollar
      // figure invented next to a computed one is the thing researchContract
      // refuses too.
      expect(caveat.detail).not.toMatch(/\$/);
    }
  });

  it('states the direction of the finding, not a hedge about it', () => {
    expect(CONSENSUS_VERDICT).toContain('11 of 12');
    expect(CONSENSUS_VERDICT).toMatch(/not a bargain/);
  });
});
