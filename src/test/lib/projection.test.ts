import { describe, it, expect } from 'vitest';
import poolData from '@/data/nfl/pool.json';
import {
  AGE_CURVE,
  RECENCY_WEIGHTS,
  ageMultiplier,
  expectedGames,
  positionBaselines,
  projectPlayer,
  projectionSeasons,
  regressedDefensePoints,
  rookieBaselines,
  rookieCurveThrough,
  seasonAge,
  type PositionBaselines,
  type SeasonProduction,
} from '@/lib/projection';

const season = (games: number, pprPoints: number, receptions = 0): SeasonProduction => ({
  games,
  pprPoints,
  receptions,
});

/** A baseline table, so a test can say what a position regresses toward. */
const baselinesOf = (points: Record<string, number>, receptions: Record<string, number> = {}) =>
  ({
    points: new Map(Object.entries(points)),
    receptions: new Map(Object.entries(receptions)),
  }) as PositionBaselines;

const noRookies = new Map();

describe('the tape a projection is drawn from', () => {
  /**
   * The weights shipped as a literal `{ 2023: 0.2, 2024: 0.3, 2025: 0.5 }` when
   * 2026 was the only season anybody projected. Keyed by lag they have to say
   * exactly the same thing about 2026, or the extraction changed a number.
   */
  it('reads the same three seasons the builder always read', () => {
    expect(projectionSeasons(2026)).toEqual([2023, 2024, 2025]);
    expect(RECENCY_WEIGHTS).toEqual([0.5, 0.3, 0.2]);
  });

  it('weights the season just finished the heaviest', () => {
    const older = projectPlayer(
      { position: 'WR', age: 26, seasons: new Map([[2023, season(17, 340)]]) },
      baselinesOf({ WR: 10 }),
      noRookies,
      2026
    );
    const newer = projectPlayer(
      { position: 'WR', age: 26, seasons: new Map([[2025, season(17, 340)]]) },
      baselinesOf({ WR: 10 }),
      noRookies,
      2026
    );
    // Identical production, differing only in when it happened. Both are shrunk
    // by the same 17 games of sample, so the weights cancel out of the mean —
    // what must not happen is the older season being read at all when it falls
    // outside the window.
    expect(newer.points).toBeCloseTo(older.points, 6);
    const outsideWindow = projectPlayer(
      { position: 'WR', age: 26, seasons: new Map([[2021, season(17, 340)]]) },
      baselinesOf({ WR: 10 }),
      noRookies,
      2026
    );
    expect(outsideWindow.games).toBe(0);
    expect(outsideWindow.basis).not.toBe('production');
  });
});

describe('shrinkage', () => {
  /**
   * The whole point of a prior. Two players scoring at the same rate are not
   * equally believable if one did it for two games, and an auction that priced
   * them the same would be paying full price for noise.
   */
  it('pulls a short sample harder toward the positional baseline', () => {
    const baselines = baselinesOf({ RB: 10 });
    const brief = projectPlayer(
      { position: 'RB', age: 25, seasons: new Map([[2025, season(2, 60)]]) },
      baselines,
      noRookies,
      2026
    );
    const long = projectPlayer(
      { position: 'RB', age: 25, seasons: new Map([[2025, season(16, 480)]]) },
      baselines,
      noRookies,
      2026
    );
    // Both scored 30 a game. Shrunk against eight games of prior at a baseline
    // of ten, the two-game sample lands nearer ten and the sixteen-game one
    // nearer thirty.
    expect(brief.ppg).toBeCloseTo((2 * 30 + 8 * 10) / 10, 6);
    expect(long.ppg).toBeCloseTo((16 * 30 + 8 * 10) / 24, 6);
    expect(brief.ppg).toBeLessThan(long.ppg);
  });

  it('shrinks kickers until they are nearly indistinguishable', () => {
    const baselines = baselinesOf({ K: 8 });
    const best = projectPlayer(
      { position: 'K', age: 28, seasons: new Map([[2025, season(17, 204)]]) },
      baselines,
      noRookies,
      2026
    );
    const worst = projectPlayer(
      { position: 'K', age: 28, seasons: new Map([[2025, season(17, 68)]]) },
      baselines,
      noRookies,
      2026
    );
    // Twelve points a game against four — a threefold gap — and sixty games of
    // prior closes it to under two, which is why an auction pays a dollar for
    // any of them.
    expect(best.ppg - worst.ppg).toBeLessThan(2);
  });

  /**
   * Receptions run through the identical pipeline, and CLAUDE.md says why: the
   * client prices a non-PPR league by subtracting catches from points, and a
   * shrunk points figure minus an unshrunk reception figure is neither one
   * thing nor the other.
   */
  it('shrinks receptions on exactly the same terms as points', () => {
    const projection = projectPlayer(
      { position: 'WR', age: 26, seasons: new Map([[2025, season(10, 200, 80)]]) },
      baselinesOf({ WR: 10 }, { WR: 3 }),
      noRookies,
      2026
    );
    const expectedPpg = (10 * 20 + 8 * 10) / 18;
    const expectedRec = (10 * 8 + 8 * 3) / 18;
    expect(projection.ppg).toBeCloseTo(expectedPpg, 6);
    expect(projection.receptions / projection.expectedGames).toBeCloseTo(expectedRec, 6);
  });
});

describe('age', () => {
  it('holds a player flat through the peak window', () => {
    for (let age = AGE_CURVE.RB.peakStart; age <= AGE_CURVE.RB.peakEnd; age++) {
      expect(ageMultiplier('RB', age)).toBe(1);
    }
  });

  it('discounts a back faster than a quarterback past the peak', () => {
    expect(ageMultiplier('RB', 30)).toBeLessThan(ageMultiplier('QB', 30));
  });

  it('never discounts below the floor, however old', () => {
    expect(ageMultiplier('RB', 60)).toBe(0.45);
  });

  it('leaves a player alone when the age or the position is unknown', () => {
    expect(ageMultiplier('RB', null)).toBe(1);
    expect(ageMultiplier('DST', 30)).toBe(1);
  });

  it('reads an age off a birth date, and declines to guess without one', () => {
    expect(seasonAge('1996-05-21', 2026)).toBe(30);
    expect(seasonAge(null, 2026)).toBeNull();
    expect(seasonAge('not a date', 2026)).toBeNull();
  });
});

describe('expected games', () => {
  it('is a full season for a player who missed nothing', () => {
    expect(expectedGames(0)).toBe(17);
  });

  it('stops discounting at six missed, and never goes below ten', () => {
    expect(expectedGames(6)).toBe(11);
    expect(expectedGames(12)).toBe(11);
    expect(expectedGames(17)).toBe(11);
  });

  it('is the volume half of the model', () => {
    const projection = projectPlayer(
      { position: 'WR', age: 26, seasons: new Map([[2025, season(17, 340)]]), gamesMissed: 4 },
      baselinesOf({ WR: 10 }),
      noRookies,
      2026
    );
    expect(projection.expectedGames).toBe(13);
    expect(projection.points).toBeCloseTo(projection.ppg * projection.ageMultiplier * 13, 6);
  });
});

describe('positional baselines', () => {
  it('takes the median of last season, ignoring anyone with too little of it', () => {
    const baselines = positionBaselines([
      { position: 'WR', ...season(17, 340) }, // 20 a game
      { position: 'WR', ...season(17, 170) }, // 10 a game
      { position: 'WR', ...season(17, 85) }, // 5 a game
      // Three games is a rumour, not a sample, and must not move the median.
      { position: 'WR', ...season(3, 300) },
    ]);
    expect(baselines.points.get('WR')).toBe(10);
  });

  it('falls back to a fixed baseline for a position it has never seen', () => {
    const projection = projectPlayer(
      { position: 'FB', age: 26, seasons: new Map([[2025, season(1, 6)]]) },
      positionBaselines([]),
      noRookies,
      2026
    );
    // One game at six points, against eight games of prior at the fallback six.
    expect(projection.ppg).toBeCloseTo(6, 6);
  });
});

describe('a player with no tape at all', () => {
  const curve = new Map([['RB:1', { median: 12, n: 40 }]]);

  it('is priced off what his draft round has produced', () => {
    const projection = projectPlayer(
      { position: 'RB', age: 22, seasons: null, draftRound: 1 },
      baselinesOf({ RB: 10 }),
      curve,
      2026
    );
    expect(projection.basis).toBe('draft round 1');
    expect(projection.games).toBe(0);
    expect(projection.ppg).toBe(12);
  });

  it('falls to a fraction of the baseline when nobody drafted him', () => {
    const projection = projectPlayer(
      { position: 'RB', age: 22, seasons: null, draftRound: null },
      baselinesOf({ RB: 10 }),
      curve,
      2026
    );
    expect(projection.basis).toBe('undrafted baseline');
    expect(projection.ppg).toBeCloseTo(4.5, 6);
  });

  it('assumes he catches in proportion to how much he is expected to score', () => {
    const projection = projectPlayer(
      // Aged into the peak window, so the age multiplier is one and the ratio
      // is the only thing on show.
      { position: 'RB', age: 25, seasons: null, draftRound: 1, gamesMissed: 0 },
      baselinesOf({ RB: 10 }, { RB: 2 }),
      curve,
      2026
    );
    // 12 points against a baseline of 10, so 1.2 times the baseline's catches.
    expect(projection.receptions / 17).toBeCloseTo(2.4, 6);
  });
});

describe('the rookie curve', () => {
  const seasons = new Map([
    ['a', new Map([[2015, season(16, 160)]])], // 10 a game
    ['b', new Map([[2016, season(16, 320)]])], // 20 a game
    ['c', new Map([[2017, season(16, 480)]])], // 30 a game
    ['brief', new Map([[2018, season(2, 200)]])], // 100 a game, over two games
  ]);

  it('is the median of what that round has actually produced', () => {
    const curve = rookieBaselines(
      [
        { playerId: 'a', season: 2015, round: 1, position: 'RB' },
        { playerId: 'b', season: 2016, round: 1, position: 'RB' },
        { playerId: 'c', season: 2017, round: 1, position: 'RB' },
      ],
      seasons,
      { through: 2024 }
    );
    expect(curve.get('RB:1')).toEqual({ median: 20, n: 3 });
  });

  it('ignores a rookie year too short to be a sample', () => {
    const curve = rookieBaselines(
      [
        { playerId: 'a', season: 2015, round: 2, position: 'RB' },
        { playerId: 'brief', season: 2018, round: 2, position: 'RB' },
      ],
      seasons,
      { through: 2024 }
    );
    expect(curve.get('RB:2')?.n).toBe(1);
  });

  it('leaves kickers out, because a kicker rookie year predicts nothing', () => {
    const curve = rookieBaselines(
      [{ playerId: 'a', season: 2015, round: 1, position: 'K' }],
      seasons,
      { through: 2024 }
    );
    expect(curve.size).toBe(0);
  });

  /**
   * Two seasons back, not one. It looks like an off-by-one and is not: the
   * constant shipped as 2024 while the builder projected 2026, and keeping it
   * where it was is what made the extraction change no number.
   */
  it('stops two draft classes short of the season being projected', () => {
    expect(rookieCurveThrough(2026)).toBe(2024);
    const curve = rookieBaselines(
      [{ playerId: 'c', season: 2017, round: 1, position: 'RB' }],
      seasons,
      { through: 2016 }
    );
    expect(curve.size).toBe(0);
  });
});

describe('team defense', () => {
  it('is pulled most of the way to the league mean', () => {
    expect(regressedDefensePoints(200, 100)).toBeCloseTo(135, 6);
    expect(regressedDefensePoints(0, 100)).toBeCloseTo(65, 6);
  });
});

describe('the shipped pool against the model that built it', () => {
  /**
   * The model's whole identity is `points = ppg x age x games`, and pool.json
   * stores all four numbers. It cannot re-derive the projections — the
   * baselines are taken over every rostered player, not only the 628 who made
   * the pool — but it can check that the file the app ships still satisfies the
   * equation the model is. If an extraction or a refactor ever broke that
   * multiply, every price on the board would move and nothing else would say so.
   */
  it('satisfies points = ppg x age multiplier x expected games for every player', () => {
    const broken = poolData.players.filter((player) => {
      const {
        points,
        pointsPerGame,
        ageMultiplier: multiplier,
        expectedGames: games,
      } = player.projection;
      // Each factor is stored rounded, so the product carries about a point of
      // slack at seventeen games. A real break moves it by tens.
      return Math.abs(points - pointsPerGame * multiplier * games) > 1;
    });
    expect(broken.map((p) => p.name)).toEqual([]);
  });
});
