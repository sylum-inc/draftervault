import { describe, expect, it } from 'vitest';
import { offenceNorm, positionNorm, primeNorms, type NormSubject } from '@/lib/positionNorms';

/**
 * Where an instrument's scale comes from.
 *
 * Twice now the answer has been got wrong in a way nothing failed on: reading
 * the pool file gave empty snap buckets and the role field rendered nothing at
 * all on every card, and taking the cohort over all 628 players put the median
 * running back at 31% of snaps, so every one of the sixty on a commissioner's
 * sheet sat in the same corner of it. Both are the same defect — a scale taken
 * from the wrong population — and both were invisible because a wrong scale
 * still draws.
 */
describe('the scales instruments are drawn against', () => {
  const back = (id: number, points: number, over: Partial<NormSubject> = {}): NormSubject => ({
    position: 'RB',
    projectedPoints: points,
    snapPercentage: 20 + id,
    pointsPerGame: points / 17,
    usage: { carryShare: id, targetShare: id, redZoneTouches: id, adot: id / 10 },
    ...over,
  });

  it('takes the cohort from the men who start, not from the whole pool', () => {
    // Twelve real starters and forty bodies behind them. A median over all
    // fifty-two is a median over the depth chart; a drafter never compares a
    // player to the four hundredth back.
    const players = [
      ...Array.from({ length: 12 }, (_, index) => back(60 + index, 300 - index)),
      ...Array.from({ length: 40 }, (_, index) => back(index, 40 - index)),
    ];
    primeNorms(players, { RB: 12 });

    const snap = positionNorm('RB', 'snap');
    expect(snap).toBeTruthy();
    // The starters' snap shares run 80 to 91, the depth 20 to 59. A median
    // anywhere below 80 means the depth got into the distribution.
    expect(snap!.median).toBeGreaterThanOrEqual(80);
  });

  it('has an average depth of target, which the catch-depth field is drawn on', () => {
    primeNorms(
      Array.from({ length: 12 }, (_, index) => back(60 + index, 300 - index)),
      { RB: 12 }
    );
    expect(positionNorm('RB', 'adot')?.median).toBeGreaterThan(0);
  });

  /*
   * The one decision in the offence half that is not obvious.
   *
   * An offence is a club, so every player on a roster carries the identical
   * reading. Bucketing per player would weight a club by however many of its
   * players the pool happens to hold — a distribution of roster depth wearing
   * the label of a distribution of offences.
   */
  it('weights a club once however many of its players are in the pool', () => {
    const clubbed = (team: string, plays: number): NormSubject => ({
      position: 'RB',
      projectedPoints: 100,
      team,
      teamContext: { playsPerGame: plays, redZoneTripsPerGame: plays / 20 },
    });
    const players = [
      // One fast club with thirty men in the pool, and six slow clubs with one
      // each. Counted per player the median is the fast club; counted per club
      // it is a slow one.
      ...Array.from({ length: 30 }, () => clubbed('KC', 70)),
      ...Array.from({ length: 6 }, (_, index) => clubbed(`T${index}`, 50 + index)),
    ];
    primeNorms(players, { RB: 40 });

    const plays = offenceNorm('plays');
    expect(plays).toBeTruthy();
    expect(plays!.median).toBeLessThan(60);
  });

  it('says it does not know rather than inventing a scale from too little', () => {
    primeNorms([back(1, 100), back(2, 90)], { RB: 12 });
    // Two readings cannot carry a median; the instrument draws nothing rather
    // than drawing against an accident of who happened to be measured.
    expect(positionNorm('RB', 'snap')).toBeNull();
    expect(offenceNorm('plays')).toBeNull();
  });
});
