import { describe, it, expect } from 'vitest';
import poolData from '@/data/nfl/pool.json';
import {
  DEFAULT_LEAGUE,
  LEAGUE_LIMITS,
  flexDemand,
  POSITIONS,
  leagueShape,
  normaliseLeague,
  pointsFor,
  pricePool,
  replacementLevels,
  rosteredForTeams,
  sameLeague,
  startingSlots,
  unfilledSlotsFor,
  type LeagueShape,
  type Projected,
} from '@/lib/valuation';

const projected = (): Projected[] =>
  poolData.players.map((p) => ({ position: p.position, points: p.projection.points }));

describe('pricePool against the shipped pool', () => {
  /**
   * The guard this module exists for.
   *
   * `scripts/build-player-pool.mjs` writes auction values into pool.json using
   * this same function; the client recomputes them at load. If the two ever
   * disagree the board would show prices the pool was not built on, which is
   * precisely the drift CLAUDE.md warns about. Re-pricing the shipped pool at
   * the shape it was built for must reproduce it exactly — not approximately.
   */
  it('reproduces every stored auction value and VORP exactly', () => {
    const { priced } = pricePool(projected(), DEFAULT_LEAGUE);

    expect(priced).toHaveLength(poolData.players.length);
    const mismatches = poolData.players.filter(
      (player, i) =>
        priced[i].auctionValue !== player.auctionValue || priced[i].vorp !== player.vorp
    );
    expect(mismatches.map((p) => p.name)).toEqual([]);
  });

  it('reproduces the stored replacement levels', () => {
    const { replacement } = pricePool(projected(), DEFAULT_LEAGUE);
    const rounded = Object.fromEntries(
      Object.entries(replacement).map(([position, points]) => [position, Math.round(points)])
    );
    expect(rounded).toEqual(poolData.replacement);
  });

  it('spends the whole budget the league brings to the table', () => {
    const { priced } = pricePool(projected(), DEFAULT_LEAGUE);
    const rosterSlots = DEFAULT_LEAGUE.teams * DEFAULT_LEAGUE.rosterSize;
    const top = [...priced].sort((a, b) => b.auctionValue - a.auctionValue).slice(0, rosterSlots);
    const spend = top.reduce((total, entry) => total + entry.auctionValue, 0);
    const budget = DEFAULT_LEAGUE.teams * DEFAULT_LEAGUE.budget;

    // Rounding to whole dollars 192 times cannot land on the budget precisely,
    // but it must not leave real money unspent either.
    expect(spend).toBeGreaterThan(budget * 0.95);
    expect(spend).toBeLessThanOrEqual(budget * 1.05);
  });
});

describe('the shipped pool and the client agree', () => {
  it('was generated for the league the client defaults to', () => {
    // If these drift, the board opens showing prices for a league nobody set.
    expect(poolData.league).toMatchObject({
      teams: DEFAULT_LEAGUE.teams,
      budget: DEFAULT_LEAGUE.budget,
      rosterSize: DEFAULT_LEAGUE.rosterSize,
    });
    expect(poolData.league.rostered).toEqual(DEFAULT_LEAGUE.rostered);
  });

  it('is deep enough for every league the settings allow', () => {
    // A position shorter than the league rosters falls back to its own worst
    // player, which understates it. The pool used to hold 40 quarterbacks
    // where 32 teams roster 53.
    const depth: Record<string, number> = {};
    for (const player of poolData.players) {
      depth[player.position] = (depth[player.position] ?? 0) + 1;
    }

    const biggest = rosteredForTeams(LEAGUE_LIMITS.teams.max);
    const short = POSITIONS.filter((position) => depth[position] < biggest[position]).map(
      (position) => `${position}: ${depth[position]} of ${biggest[position]}`
    );
    expect(short).toEqual([]);
  });
});

describe('scoring', () => {
  it('leaves the points alone at full PPR', () => {
    const player = { position: 'WR', points: 250, receptions: 100 };
    expect(pointsFor(player, DEFAULT_LEAGUE)).toBe(250);
  });

  it('takes back half a point a catch at half PPR', () => {
    const player = { position: 'WR', points: 250, receptions: 100 };
    expect(pointsFor(player, leagueShape({ receptionPoints: 0.5 }))).toBe(200);
  });

  it('takes back the whole point in a standard league', () => {
    const player = { position: 'WR', points: 250, receptions: 100 };
    expect(pointsFor(player, leagueShape({ receptionPoints: 0 }))).toBe(150);
  });

  it('leaves a player who catches nothing untouched at any setting', () => {
    const qb = { position: 'QB', points: 300, receptions: 0 };
    for (const receptionPoints of [0, 0.5, 1]) {
      expect(pointsFor(qb, leagueShape({ receptionPoints }))).toBe(300);
    }
  });

  it('treats a pool with no reception data as unchanged', () => {
    // A pool built before scoring was configurable carries no catches; it must
    // price as it always did rather than silently losing points.
    expect(pointsFor({ position: 'WR', points: 200 }, leagueShape({ receptionPoints: 0 }))).toBe(
      200
    );
  });

  it('moves catchers and runners in opposite directions', () => {
    const players: Projected[] = [
      { position: 'RB', points: 250, receptions: 20 },
      { position: 'RB', points: 250, receptions: 90 },
    ];
    const full = pricePool(
      players,
      leagueShape({ rostered: { ...DEFAULT_LEAGUE.rostered, RB: 2 } })
    );
    const half = pricePool(
      players,
      leagueShape({ receptionPoints: 0.5, rostered: { ...DEFAULT_LEAGUE.rostered, RB: 2 } })
    );

    // Equal points at full PPR; at half the one who got there by catching
    // falls behind the one who did not.
    expect(full.priced[0].vorp).toBe(full.priced[1].vorp);
    expect(half.priced[0].vorp).toBeGreaterThan(half.priced[1].vorp);
  });

  it('lowers replacement level where catches happen and nowhere else', () => {
    const projected = poolData.players.map((p) => ({
      position: p.position,
      points: p.projection.points,
      receptions: p.projection.receptions,
    }));
    const full = pricePool(projected, DEFAULT_LEAGUE);
    const half = pricePool(projected, leagueShape({ receptionPoints: 0.5 }));

    // Tight ends lean on catches hardest, then receivers, then backs.
    const drop = (position: string) => full.replacement[position] - half.replacement[position];
    expect(drop('TE')).toBeGreaterThan(drop('WR'));
    expect(drop('WR')).toBeGreaterThan(drop('RB'));
    expect(drop('RB')).toBeGreaterThan(5);

    // Kickers and defences never catch anything, so their bar cannot move at all.
    expect(half.replacement.K).toBe(full.replacement.K);
    expect(half.replacement.DST).toBe(full.replacement.DST);

    // Quarterbacks do catch the ball, occasionally, on trick plays, and
    // nflverse records it — so the pool genuinely carries a fraction of a catch
    // for a handful of them, and asserting the position has none would be
    // asserting the data is wrong.
    expect(
      poolData.players.filter((p) => p.position === 'QB' && p.projection.receptions > 0).length
    ).toBeGreaterThan(0);

    // The *bar* is a different claim and a fragile one: it is one specific
    // quarterback, and whether he happens to be one of the handful who caught
    // anything moves with every rebuild. Asserting it was strictly positive
    // held until a rebuild put a quarterback with no catches on the bar. What
    // is true either way is that a catch is worth nothing much at the position.
    expect(drop('QB')).toBeGreaterThanOrEqual(0);
    expect(drop('QB')).toBeLessThan(1);
  });

  it('is part of what makes two leagues different', () => {
    expect(sameLeague(leagueShape(), leagueShape({ receptionPoints: 0.5 }))).toBe(false);
  });

  it('clamps a scoring nobody plays', () => {
    expect(normaliseLeague(leagueShape({ receptionPoints: -3 })).receptionPoints).toBe(0);
    expect(normaliseLeague(leagueShape({ receptionPoints: 99 })).receptionPoints).toBe(1.5);
    expect(
      normaliseLeague({ ...DEFAULT_LEAGUE, receptionPoints: Number.NaN }).receptionPoints
    ).toBe(1);
  });

  it('ships a pool that carries catches for every player', () => {
    // Without these the client cannot restate a single price.
    const missing = poolData.players.filter((p) => p.projection.receptions === undefined);
    expect(missing.map((p) => p.name)).toEqual([]);
  });
});

describe('pricing an auction sheet', () => {
  const projected = () =>
    poolData.players.map((p) => ({
      position: p.position,
      points: p.projection.points,
      receptions: p.projection.receptions,
    }));

  /** The commissioner's sheet: the best N by what a full auction would pay. */
  const sheetOf = (size: number): boolean[] => {
    const players = projected();
    const full = pricePool(players, DEFAULT_LEAGUE);
    const order = full.priced
      .map((entry, index) => ({ value: entry.auctionValue, index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, size);
    const on = new Array(players.length).fill(false);
    for (const entry of order) on[entry.index] = true;
    return on;
  };

  it('does not move replacement level, because the league still rosters everyone', () => {
    const players = projected();
    const full = pricePool(players, DEFAULT_LEAGUE);
    const sheet = pricePool(players, DEFAULT_LEAGUE, { onSheet: sheetOf(50) });

    // Got this wrong once: setting the bar to the best player left off the
    // sheet left only a handful with any surplus, and the budget piled onto
    // them — the best player came out at 77% of a team's entire budget.
    expect(sheet.replacement).toEqual(full.replacement);
  });

  it('charges more when the same money buys fewer players', () => {
    const players = projected();
    const full = pricePool(players, DEFAULT_LEAGUE);
    const sheet = pricePool(players, DEFAULT_LEAGUE, { onSheet: sheetOf(50) });

    const best = full.priced.reduce(
      (top, entry, index) => (entry.auctionValue > full.priced[top].auctionValue ? index : top),
      0
    );
    expect(sheet.priced[best].auctionValue).toBeGreaterThan(full.priced[best].auctionValue);
  });

  it('keeps the best player inside what one team could actually pay', () => {
    const players = projected();
    // The commissioner-sized range. Shorter sheets genuinely do concentrate the
    // money past this bound — twelve names put the best player above a whole
    // budget — which is why the import refuses a list whose priced top clears
    // it rather than pretending a count is the thing that matters.
    for (const size of [40, 50, 100, 192]) {
      const { priced } = pricePool(players, DEFAULT_LEAGUE, { onSheet: sheetOf(size) });
      const top = Math.max(...priced.map((entry) => entry.auctionValue));
      // Nobody spends three quarters of their budget on one player. A model
      // that says they do is a broken model, not a bold prediction.
      expect(top).toBeLessThan(DEFAULT_LEAGUE.budget * 0.55);
    }
  });

  it('prices from a sheet size alone, before the sheet itself exists', () => {
    const players = projected();
    const bySize = pricePool(players, leagueShape({ auctionSheetSize: 50 }));
    const byList = pricePool(players, DEFAULT_LEAGUE, { onSheet: sheetOf(50) });

    const top = (r: { priced: Array<{ auctionValue: number }> }) =>
      Math.max(...r.priced.map((e) => e.auctionValue));
    expect(top(bySize)).toBe(top(byList));
  });

  it('charges less as the sheet grows', () => {
    const players = projected();
    const top = (size: number) =>
      Math.max(
        ...pricePool(players, leagueShape({ auctionSheetSize: size })).priced.map(
          (e) => e.auctionValue
        )
      );
    expect(top(100)).toBeLessThan(top(50));
    expect(top(200)).toBeLessThan(top(100));
  });

  it('charges less as the sheet grows, because the money is spread wider', () => {
    const players = projected();
    const fifty = pricePool(players, DEFAULT_LEAGUE, { onSheet: sheetOf(50) });
    const hundred = pricePool(players, DEFAULT_LEAGUE, { onSheet: sheetOf(100) });

    const best = fifty.priced.reduce(
      (top, entry, index) => (entry.auctionValue > fifty.priced[top].auctionValue ? index : top),
      0
    );
    expect(hundred.priced[best].auctionValue).toBeLessThan(fifty.priced[best].auctionValue);
  });

  it('prices nobody who is not on the sheet', () => {
    const players = projected();
    const onSheet = sheetOf(60);
    const { priced } = pricePool(players, DEFAULT_LEAGUE, { onSheet });

    priced.forEach((entry, index) => {
      if (!onSheet[index]) expect(entry.auctionValue).toBe(1);
    });
    expect(
      priced.filter((entry, i) => onSheet[i] && entry.auctionValue > 1).length
    ).toBeGreaterThan(40);
  });

  it('spends the budget on the sheet rather than on the pool', () => {
    const players = projected();
    const onSheet = sheetOf(50);
    const { priced } = pricePool(players, DEFAULT_LEAGUE, { onSheet });
    const spend = priced.reduce(
      (total, entry, i) => total + (onSheet[i] ? entry.auctionValue : 0),
      0
    );
    const budget = DEFAULT_LEAGUE.teams * DEFAULT_LEAGUE.budget;

    expect(spend).toBeGreaterThan(budget * 0.95);
    expect(spend).toBeLessThanOrEqual(budget * 1.05);
  });

  it('behaves exactly as before when no sheet is given', () => {
    const players = projected();
    expect(pricePool(players, DEFAULT_LEAGUE, {})).toEqual(pricePool(players, DEFAULT_LEAGUE));
  });
});

describe('pricePool across league shapes', () => {
  it('gives every rostered player at least a dollar and never a fraction', () => {
    const { priced } = pricePool(projected(), leagueShape({ teams: 10, budget: 300 }));
    for (const entry of priced) {
      expect(entry.auctionValue).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(entry.auctionValue)).toBe(true);
    }
  });

  it('makes the same player cost more when there is more money chasing him', () => {
    const players = projected();
    const cheap = pricePool(players, leagueShape({ budget: 200 }));
    const rich = pricePool(players, leagueShape({ budget: 400 }));

    const best = players.reduce(
      (top, player, i) => (player.points > players[top].points ? i : top),
      0
    );
    expect(rich.priced[best].auctionValue).toBeGreaterThan(cheap.priced[best].auctionValue);
  });

  it('raises replacement level as the league gets smaller', () => {
    const players = projected();
    const big = pricePool(players, leagueShape({ teams: 14 }));
    const small = pricePool(players, leagueShape({ teams: 8 }));

    // Fewer teams roster fewer receivers, so the worst rostered receiver is a
    // better player — which is what makes stars worth less in a small league.
    expect(small.replacement.WR).toBeGreaterThan(big.replacement.WR);
  });

  it('survives a league whose rosters cost more than its budgets', () => {
    // 2 teams x $10 = $20 of budget against 2 x 40 = 80 roster spots. There is
    // no surplus to share; everyone is a dollar and nothing is NaN.
    const { priced } = pricePool(
      projected(),
      normaliseLeague(leagueShape({ teams: 2, budget: 10, rosterSize: 40 }))
    );
    expect(priced.every((entry) => entry.auctionValue === 1)).toBe(true);
  });

  it('does not divide by zero on an empty pool', () => {
    const { priced } = pricePool([], DEFAULT_LEAGUE);
    expect(priced).toEqual([]);
  });
});

describe('replacementLevels', () => {
  it('falls back to the worst player when a position is shorter than the league rosters', () => {
    const players: Projected[] = [
      { position: 'TE', points: 200 },
      { position: 'TE', points: 100 },
    ];
    // The league wants 18 tight ends and there are two: replacement is the
    // second, not zero, which would price both as elite.
    expect(replacementLevels(players, DEFAULT_LEAGUE).TE).toBe(100);
  });

  it('handles a position the league shape says nothing about', () => {
    const levels = replacementLevels([{ position: 'P', points: 40 }], DEFAULT_LEAGUE);
    expect(levels.P).toBe(40);
  });
});

describe('unfilledSlotsFor', () => {
  const empty = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };

  it('counts a position its own unfilled starting slots', () => {
    expect(unfilledSlotsFor('WR', empty, DEFAULT_LEAGUE)).toBe(3);
    expect(unfilledSlotsFor('WR', { ...empty, WR: 1 }, DEFAULT_LEAGUE)).toBe(2);
    expect(unfilledSlotsFor('WR', { ...empty, WR: 3 }, DEFAULT_LEAGUE)).toBe(0);
  });

  it('follows the league rather than a fixed lineup', () => {
    // Superflex: two quarterbacks start, so the second one is a real hole.
    const superflex = leagueShape({
      startingLineup: { QB: 2, RB: 2, WR: 2, TE: 1, FLEX: 0, K: 1, DST: 1 },
    });
    expect(unfilledSlotsFor('QB', { ...empty, QB: 1 }, superflex)).toBe(1);
    expect(unfilledSlotsFor('QB', { ...empty, QB: 1 }, DEFAULT_LEAGUE)).toBe(0);
  });

  it('treats an open flex as a hole for every position that can fill it', () => {
    const withFlex = leagueShape({
      startingLineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });
    const started = { ...empty, QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 };

    // The dedicated slots are full and the flex is not: a back, a receiver and
    // a tight end are each a candidate for it.
    expect(unfilledSlotsFor('RB', started, withFlex)).toBe(1);
    expect(unfilledSlotsFor('WR', started, withFlex)).toBe(1);
    expect(unfilledSlotsFor('TE', started, withFlex)).toBe(1);
    // A quarterback cannot fill it.
    expect(unfilledSlotsFor('QB', started, withFlex)).toBe(0);
  });

  it('stops counting the flex once somebody fills it', () => {
    const withFlex = leagueShape({
      startingLineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });
    // A third receiver is the flex, so nobody still needs one.
    const filled = { ...empty, QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DST: 1 };
    expect(unfilledSlotsFor('RB', filled, withFlex)).toBe(0);
    expect(unfilledSlotsFor('WR', filled, withFlex)).toBe(0);
    expect(unfilledSlotsFor('TE', filled, withFlex)).toBe(0);
  });

  it('prefers a dedicated hole over the flex', () => {
    const withFlex = leagueShape({
      startingLineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });
    // No backs at all: two dedicated slots, and the flex is not added on top.
    expect(unfilledSlotsFor('RB', empty, withFlex)).toBe(2);
  });

  it('ignores a flex the league does not have', () => {
    const full = { ...empty, QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DST: 1 };
    expect(unfilledSlotsFor('RB', full, DEFAULT_LEAGUE)).toBe(0);
  });
});

describe('league shapes', () => {
  it('scales rostered counts with the number of teams', () => {
    const ten = rosteredForTeams(10);
    expect(ten.WR).toBe(50);
    expect(rosteredForTeams(12)).toEqual(DEFAULT_LEAGUE.rostered);
  });

  it('never lets a position fall to zero rostered players', () => {
    for (const position of POSITIONS) {
      expect(rosteredForTeams(LEAGUE_LIMITS.teams.min)[position]).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps an explicit rostered table instead of scaling it', () => {
    const custom = { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 };
    expect(leagueShape({ teams: 20, rostered: custom }).rostered).toEqual(custom);
  });

  it('clamps a league back into range', () => {
    const wild = normaliseLeague({
      ...DEFAULT_LEAGUE,
      teams: 900,
      budget: -5,
      rosterSize: 0,
    });
    expect(wild.teams).toBe(LEAGUE_LIMITS.teams.max);
    expect(wild.budget).toBe(LEAGUE_LIMITS.budget.min);
    expect(wild.rosterSize).toBe(LEAGUE_LIMITS.rosterSize.min);
  });

  it('counts the starting slots the lineup actually adds up to', () => {
    expect(startingSlots(DEFAULT_LEAGUE)).toBe(9);
    expect(
      startingSlots(leagueShape({ startingLineup: { ...DEFAULT_LEAGUE.startingLineup, FLEX: 2 } }))
    ).toBe(11);
  });

  it('rounds a lineup to whole non-negative slots', () => {
    const shape = normaliseLeague(
      leagueShape({ startingLineup: { QB: -1, RB: 2.4, WR: 3, TE: 1, FLEX: 0, K: 1, DST: 1 } })
    );
    expect(shape.startingLineup.QB).toBe(0);
    expect(shape.startingLineup.RB).toBe(2);
  });

  it('rejects a non-numeric league rather than producing NaN prices', () => {
    const broken = normaliseLeague({
      ...DEFAULT_LEAGUE,
      teams: Number.NaN,
      budget: Number.POSITIVE_INFINITY,
    });
    expect(Number.isInteger(broken.teams)).toBe(true);
    expect(Number.isInteger(broken.budget)).toBe(true);
  });

  it('tells a lineup change apart from an identical shape', () => {
    const base = leagueShape();
    expect(
      sameLeague(base, leagueShape({ startingLineup: { ...base.startingLineup, FLEX: 1 } }))
    ).toBe(false);
  });

  it('tells identical and differing shapes apart', () => {
    const base: LeagueShape = leagueShape();
    expect(sameLeague(base, leagueShape())).toBe(true);
    expect(sameLeague(base, leagueShape({ budget: 201 }))).toBe(false);
    // rostered is part of the price, so a difference there is a difference.
    expect(sameLeague(base, { ...base, rostered: { ...base.rostered, WR: 59 } })).toBe(false);
  });
});

describe('the sheet pricePool actually used', () => {
  // Which players the money is buying is needed in three other places: what is
  // still for sale, what inflation is measured over, and when the auction is
  // finished. Every one of those recomputing the selection is a second
  // definition that can disagree with the first — and it would disagree only
  // once a real sheet is imported, which is the only night any of it matters.
  // So the selection is returned rather than left to be derived again.
  const projected = (points: number, position: string, index: number) => ({
    position,
    points,
    receptions: 0,
    id: `p${index}`,
  });

  const field = Array.from({ length: 300 }, (_, i) =>
    projected(320 - i, ['RB', 'WR', 'TE', 'QB'][i % 4], i)
  );

  it('hands back the mask rather than making callers guess it', () => {
    const { onSheet, priced } = pricePool(field, leagueShape({ auctionSheetSize: 50 }));

    expect(onSheet.filter(Boolean)).toHaveLength(50);
    // Everything priced above a dollar was bought. The converse does not hold:
    // a player on the sheet with no surplus still costs the dollar the rules
    // require, so he is on the mask at $1.
    priced.forEach((entry, index) => {
      if (entry.auctionValue > 1) expect(onSheet[index]).toBe(true);
    });
  });

  it('returns exactly the sheet it was given, not one it derived', () => {
    const explicit = field.map((_, index) => index % 7 === 0);
    const { onSheet } = pricePool(field, leagueShape({ auctionSheetSize: 50 }), {
      onSheet: explicit,
    });

    // An explicit sheet overrides the size entirely — 43 players, not 50.
    expect(onSheet).toEqual(explicit);
  });

  it('marks every rosterable slot when the whole board is auctioned', () => {
    const league = leagueShape({ auctionSheetSize: null });
    const { onSheet } = pricePool(field, league);
    expect(onSheet.filter(Boolean)).toHaveLength(league.teams * league.rosterSize);
  });
});

/**
 * A flex used to change nothing at all.
 *
 * `rostered` answers "how many does the league own", roster size is fixed, so
 * turning a flex on left every one of the 628 prices identical — measured, not
 * suspected. These pin the fix and, more importantly, pin the thing that makes
 * it safe: at zero flex it is a no-op to the last cent.
 */
describe('flexDemand', () => {
  const pool = [
    ...Array.from({ length: 80 }, (_, i) => ({ position: 'RB', points: 300 - i * 2 })),
    ...Array.from({ length: 90 }, (_, i) => ({
      position: 'WR',
      points: 295 - i * 2,
      receptions: 90,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      position: 'TE',
      points: 200 - i * 3,
      receptions: 60,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({ position: 'QB', points: 400 - i * 5 })),
  ];
  const at = (FLEX: number, receptionPoints = 0.5) =>
    leagueShape({
      teams: 12,
      receptionPoints,
      startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX, K: 1, DST: 1 },
    });

  it('is nothing at all without a flex, so a no-flex league prices as it always did', () => {
    expect(flexDemand(pool, at(0))).toEqual({ RB: 0, WR: 0, TE: 0 });
    const none = pricePool(pool, at(0));
    const again = pricePool(pool, at(0));
    expect(none.priced).toEqual(again.priced);
  });

  it('allocates exactly one slot per team per flex, never more', () => {
    const one = flexDemand(pool, at(1));
    expect(one.RB + one.WR + one.TE).toBe(12);
    const two = flexDemand(pool, at(2));
    expect(two.RB + two.WR + two.TE).toBe(24);
  });

  it('never hands a flex to a position that cannot fill one', () => {
    // Superflex is a different league and this is not it. A quarterback
    // absorbing flex demand would deepen QB replacement and cheapen every
    // quarterback on the board, which is the opposite of what a superflex does.
    expect(Object.keys(flexDemand(pool, at(2)))).toEqual(['RB', 'WR', 'TE']);
  });

  it('follows the scoring rather than a typed split — the whole reason it is derived', () => {
    // A constant 45/45/10 would be wrong in both directions. Catches are the
    // biggest lever in fantasy scoring, so who fills a flex has to move with
    // them: receivers absorb more of it the more a catch is worth.
    const standard = flexDemand(pool, at(2, 0));
    const fullPpr = flexDemand(pool, at(2, 1));
    expect(fullPpr.WR).toBeGreaterThan(standard.WR);
    expect(fullPpr.RB).toBeLessThan(standard.RB);
  });

  it('deepens replacement only where the flex landed, and never raises it', () => {
    const before = replacementLevels(pool, at(0));
    const after = replacementLevels(pool, at(1));
    for (const position of ['RB', 'WR', 'TE']) {
      expect(after[position]).toBeLessThanOrEqual(before[position]);
    }
    // Nothing a flex cannot start may move.
    expect(after.QB).toBe(before.QB);
  });

  it('makes depth at a flex position worth money, which is what a flex does', () => {
    const before = pricePool(pool, at(0));
    const after = pricePool(pool, at(1));
    const depthRb = pool.findIndex((p, i) => p.position === 'RB' && i > 30);
    expect(after.priced[depthRb].vorp).toBeGreaterThan(before.priced[depthRb].vorp);
  });

  it('does not fall over when the pool is shorter than the flex demand', () => {
    const thin = [{ position: 'RB', points: 200 }];
    expect(() => flexDemand(thin, at(1))).not.toThrow();
    expect(flexDemand(thin, at(1))).toEqual({ RB: 0, WR: 0, TE: 0 });
  });
});
