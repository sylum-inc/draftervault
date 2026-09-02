import { describe, expect, it } from 'vitest';
import { readiness, worstOf, type ReadinessSubject } from '@/lib/readiness';

/**
 * The checks, and what each of them is protecting against.
 *
 * Every failure this list covers is silent — the board renders, the numbers
 * look authoritative, and the first evidence is a roster nobody can explain in
 * December. So the tests are written as the failure each check catches rather
 * than as the string it prints.
 */
const ready = (over: Partial<ReadinessSubject> = {}): ReadinessSubject => ({
  leagueConfirmed: true,
  leagueIsPoolDefault: false,
  poolShortfall: [],
  sheetSize: 60,
  sheetLoss: 0,
  sheetIsGuess: false,
  myTeam: 'The Owner',
  unnamedTeams: 0,
  totalTeams: 12,
  snakeOrderDrawn: true,
  marketDays: 1,
  researchDays: 1,
  drafted: 0,
  ...over,
});

const at = (over: Partial<ReadinessSubject> = {}) =>
  Object.fromEntries(readiness(ready(over)).map((check) => [check.id, check.level]));

describe('is this board set up', () => {
  it('says so when everything it can check is set', () => {
    expect(worstOf(readiness(ready()))).toBe('ready');
    // The things that are fine are listed too: a checklist that only shows
    // problems can say something is wrong but never that nothing is.
    expect(readiness(ready()).length).toBeGreaterThan(4);
  });

  /* Priced under somebody else's rules on every card, and nothing on screen
     says so. The most expensive silent failure this app has. */
  it('blocks on a league nobody confirmed', () => {
    expect(at({ leagueConfirmed: false }).league).toBe('blocking');
  });

  it('doubts a confirmed league that is still the pool’s own defaults', () => {
    expect(at({ leagueIsPoolDefault: true }).league).toBe('warn');
  });

  /* A paste that loses a chunk out of the middle prices the top twenty
     perfectly sensibly with auctionSheetSize quietly forty rather than sixty. */
  it('blocks on a sheet that lost a chunk of itself', () => {
    expect(at({ sheetLoss: 0.2 }).sheet).toBe('blocking');
    expect(at({ sheetLoss: 0.02 }).sheet).toBe('ready');
  });

  /* A size with no list is the model guessing which sixty are for sale — it
     prices players the commissioner never listed and floors ones he did. */
  it('blocks on a sheet size with no list behind it', () => {
    expect(at({ sheetSize: null, sheetIsGuess: true }).sheet).toBe('blocking');
    expect(at({ sheetSize: null, sheetIsGuess: false }).sheet).toBe('warn');
  });

  it('blocks with no team marked, because the plan is then somebody else’s', () => {
    expect(at({ myTeam: null }).mine).toBe('blocking');
  });

  it('blocks on a pool too thin for the league it is being drafted at', () => {
    expect(at({ poolShortfall: ['WR'] }).pool).toBe('blocking');
  });

  /* Neither of these makes a number wrong; both cost precision or speed. */
  it('only nags about names and the draw', () => {
    expect(at({ unnamedTeams: 12 }).names).toBe('warn');
    expect(at({ snakeOrderDrawn: false }).order).toBe('warn');
  });

  /*
   * The market orders the whole board, and pre-season ADP moves fastest in the
   * fortnight before week one — so a stale snapshot is a wrong board, not
   * merely an old one. Once picks exist it is too late to re-price without
   * throwing the draft away, so it drops to a warning rather than demanding
   * something destructive.
   */
  it('blocks on a stale market before the draft and warns once it has started', () => {
    expect(at({ marketDays: 20 }).market).toBe('blocking');
    expect(at({ marketDays: 20, drafted: 14 }).market).toBe('warn');
    expect(at({ marketDays: 2 }).market).toBe('ready');
  });

  it('says nothing about research that is still recent', () => {
    expect(at({ researchDays: 3 }).research).toBeUndefined();
    expect(at({ researchDays: 40 }).research).toBe('warn');
  });

  it('reports the worst thing present, which is what a badge shows', () => {
    expect(worstOf(readiness(ready({ unnamedTeams: 3 })))).toBe('warn');
    expect(worstOf(readiness(ready({ unnamedTeams: 3, myTeam: null })))).toBe('blocking');
  });

  /* A fact module: it states what is true of the setup and never what to bid.
     A dollar figure here would be an opinion wearing a checklist's authority. */
  it('never prices anything', () => {
    for (const check of readiness(ready({ leagueConfirmed: false, myTeam: null }))) {
      expect(check.detail).not.toMatch(/\$\d/);
    }
  });
});
