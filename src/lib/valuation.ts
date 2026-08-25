/**
 * League shape, and the arithmetic that turns projected points into dollars.
 *
 * This module is the single definition of both. It is imported by the browser
 * (`auctionDraftService`) and, through Node's type stripping, by the pool
 * builder (`scripts/build-player-pool.mjs`) — so the values baked into
 * pool.json and the values the draft room shows come from the same code rather
 * than from two copies that drift.
 *
 * Nothing here reads the pool or the DOM: it takes projected points in and
 * gives dollars back, which is what lets the client re-price the whole board
 * the moment somebody changes the league to ten teams at $300.
 */

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

/**
 * Everything about a league that changes what a player is worth.
 *
 * `rostered` is the one that is easy to misread: it is not how many of a
 * position a team may carry, it is how many the league as a whole ends up
 * owning, which is what sets replacement level. Sixty rostered receivers in a
 * twelve-team league means the 60th-best receiver is free, so the 12th-best is
 * only worth the gap between them.
 */
export interface LeagueShape {
  teams: number;
  budget: number;
  rosterSize: number;
  /** Slots a team must field each week; each unfilled one holds back a dollar. */
  starters: number;
  /** Most a single team may carry at each position. */
  positionLimits: Record<Position, number>;
  /** How many of each position the league rosters in total; sets replacement level. */
  rostered: Record<Position, number>;
}

/**
 * The shape every dollar value in the shipped pool assumes.
 *
 * Change this and `npm run build:pool` produces different values — which is
 * fine, because the client recomputes from the same numbers rather than
 * trusting the ones in the file.
 */
export const DEFAULT_LEAGUE: LeagueShape = {
  teams: 12,
  budget: 200,
  rosterSize: 16,
  starters: 9,
  positionLimits: { QB: 3, RB: 6, WR: 7, TE: 3, K: 2, DST: 2 },
  rostered: { QB: 20, RB: 48, WR: 60, TE: 18, K: 12, DST: 12 },
};

/** Bounds a league has to stay inside for the valuation to mean anything. */
export const LEAGUE_LIMITS = {
  teams: { min: 2, max: 32 },
  budget: { min: 10, max: 1000 },
  rosterSize: { min: 1, max: 40 },
} as const;

/**
 * Scale the default's rostered counts to a different number of teams.
 *
 * Replacement level is a property of the league, not of a team, so a ten-team
 * league rosters proportionally fewer receivers and its replacement receiver is
 * correspondingly better — which is exactly why a stud is worth less there.
 * Rounded up so a position never falls to zero rostered players.
 */
export const rosteredForTeams = (
  teams: number,
  base: Record<Position, number> = DEFAULT_LEAGUE.rostered,
  baseTeams: number = DEFAULT_LEAGUE.teams
): Record<Position, number> => {
  const scaled = {} as Record<Position, number>;
  for (const position of POSITIONS) {
    scaled[position] = Math.max(1, Math.round((base[position] * teams) / baseTeams));
  }
  return scaled;
};

/** A league shape built from the parts a person actually chooses. */
export const leagueShape = (
  overrides: Partial<Omit<LeagueShape, 'rostered'>> & { rostered?: Record<Position, number> } = {}
): LeagueShape => {
  const teams = overrides.teams ?? DEFAULT_LEAGUE.teams;
  return {
    teams,
    budget: overrides.budget ?? DEFAULT_LEAGUE.budget,
    rosterSize: overrides.rosterSize ?? DEFAULT_LEAGUE.rosterSize,
    starters: overrides.starters ?? DEFAULT_LEAGUE.starters,
    positionLimits: overrides.positionLimits ?? DEFAULT_LEAGUE.positionLimits,
    // Only scale when the caller left it alone; an explicit table wins.
    rostered: overrides.rostered ?? rosteredForTeams(teams),
  };
};

/** Clamp a league into the range the maths can handle, keeping starters ≤ roster. */
export const normaliseLeague = (shape: LeagueShape): LeagueShape => {
  const clamp = (n: number, { min, max }: { min: number; max: number }) =>
    Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
  const rosterSize = clamp(shape.rosterSize, LEAGUE_LIMITS.rosterSize);
  return {
    ...shape,
    teams: clamp(shape.teams, LEAGUE_LIMITS.teams),
    budget: clamp(shape.budget, LEAGUE_LIMITS.budget),
    rosterSize,
    // A league cannot be required to start more players than it may roster.
    starters: Math.min(rosterSize, Math.max(0, Math.round(shape.starters))),
  };
};

/** Two shapes price the board identically, so a change between them costs nothing. */
export const sameLeague = (a: LeagueShape, b: LeagueShape): boolean =>
  a.teams === b.teams &&
  a.budget === b.budget &&
  a.rosterSize === b.rosterSize &&
  a.starters === b.starters &&
  POSITIONS.every(
    (p) => a.positionLimits[p] === b.positionLimits[p] && a.rostered[p] === b.rostered[p]
  );

/** The least a valuation needs to know about a player. */
export interface Projected {
  position: string;
  /** Projected points for the season. */
  points: number;
}

export interface Priced {
  /** Points above the last player at this position the league bothers to roster. */
  vorp: number;
  /** Whole dollars, never below one. */
  auctionValue: number;
}

/**
 * Points scored by the last player at each position the league rosters.
 *
 * Positions shorter than their rostered count fall back to their own worst
 * player rather than to zero, which would price every one of them as a stud.
 */
export const replacementLevels = (
  players: readonly Projected[],
  league: LeagueShape
): Record<string, number> => {
  const byPosition = new Map<string, number[]>();
  for (const player of players) {
    const list = byPosition.get(player.position);
    if (list) list.push(player.points);
    else byPosition.set(player.position, [player.points]);
  }

  const levels: Record<string, number> = {};
  for (const [position, points] of byPosition) {
    points.sort((a, b) => b - a);
    const wanted = league.rostered[position as Position] ?? league.teams;
    const index = Math.min(points.length - 1, Math.max(0, wanted - 1));
    levels[position] = points[index] ?? 0;
  }
  return levels;
};

/**
 * Turn projected points into auction dollars for one league.
 *
 * Every roster spot in the league costs at least a dollar, so that money is
 * spoken for before bidding starts; what is left over is shared out in
 * proportion to value over replacement among the players good enough to be
 * rostered at all. Everyone else is a dollar, which is what they go for.
 *
 * Returns one entry per input player, in the same order.
 */
export const pricePool = (
  players: readonly Projected[],
  league: LeagueShape
): { replacement: Record<string, number>; priced: Priced[] } => {
  const replacement = replacementLevels(players, league);

  const vorps = players.map(
    (player) =>
      Math.round(Math.max(0, player.points - (replacement[player.position] ?? 0)) * 10) / 10
  );

  const rosterSlots = league.teams * league.rosterSize;
  const discretionary = league.teams * league.budget - rosterSlots;

  // Only the players who will actually be rostered share the surplus. Ranking
  // by VORP rather than points keeps a replacement-level quarterback from
  // displacing a startable tight end.
  const draftable = vorps
    .map((vorp, index) => ({ vorp, index }))
    .sort((a, b) => b.vorp - a.vorp)
    .slice(0, rosterSlots);
  const inPool = new Set(draftable.map((entry) => entry.index));
  const totalVorp = draftable.reduce((total, entry) => total + entry.vorp, 0) || 1;

  const priced = vorps.map((vorp, index) => ({
    vorp,
    auctionValue:
      // A negative surplus (a league whose rosters cost more than its budgets)
      // still leaves every player at the dollar the rules require.
      inPool.has(index) && vorp > 0 && discretionary > 0
        ? Math.max(1, Math.round(1 + (vorp / totalVorp) * discretionary))
        : 1,
  }));

  return { replacement, priced };
};
