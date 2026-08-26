import { describe, it, expect } from 'vitest';
import poolData from '@/data/nfl/pool.json';
import {
  DEFAULT_LEAGUE,
  LEAGUE_LIMITS,
  POSITIONS,
  leagueShape,
  normaliseLeague,
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
