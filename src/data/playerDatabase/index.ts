// Comprehensive NFL Player Database
// Sources: NFL Combine, Pro Days, Team Depth Charts, PFF, ESPN, NFL.com, FantasyPros, RotoWire

// Export all types
export * from './types';

// Export all rookie data
export * from './rookies';
export { ALL_ROOKIES_2025, ROOKIE_COUNTS, ROOKIE_DATA_SOURCES } from './rookies';

// Export all team rosters
export * from './rosters';
export { ALL_TEAM_ROSTERS, ROSTER_DATA_SOURCES } from './rosters';

// Import for aggregated stats
import { ALL_ROOKIES_2025, ROOKIE_COUNTS } from './rookies';
import { ALL_TEAM_ROSTERS } from './rosters';
import { RosterPlayer, RookieProfile, NFLTeam } from './types';

// Database statistics
export const DATABASE_STATS = {
  totalRookies: ROOKIE_COUNTS.TOTAL,
  rookiesByPosition: ROOKIE_COUNTS,
  totalTeams: ALL_TEAM_ROSTERS.length,
  totalRosterPlayers: ALL_TEAM_ROSTERS.reduce((sum, team) => {
    const playerCount = Object.values(team.roster).reduce(
      (posSum, pos) => posSum + (Array.isArray(pos) ? pos.length : 0),
      0
    );
    return sum + playerCount;
  }, 0),
  lastUpdated: '2025-09-01',
  dataSources: [
    'NFL Scouting Combine',
    'University Pro Days',
    'NFL Draft Results',
    'Official Team Depth Charts',
    'Pro Football Focus',
    'ESPN NFL',
    'NFL.com',
    'Pro Football Reference',
    'FantasyPros',
    'RotoWire',
  ],
};

// Unified player search across rookies and rosters
export function searchAllPlayers(query: string): (RookieProfile | RosterPlayer)[] {
  const lowerQuery = query.toLowerCase();
  const results: (RookieProfile | RosterPlayer)[] = [];

  // Search rookies
  results.push(
    ...ALL_ROOKIES_2025.filter(
      (r) =>
        r.name.toLowerCase().includes(lowerQuery) ||
        r.college.toLowerCase().includes(lowerQuery) ||
        r.team.toLowerCase().includes(lowerQuery)
    )
  );

  // Search roster players
  for (const team of ALL_TEAM_ROSTERS) {
    const positions = Object.values(team.roster);
    for (const positionGroup of positions) {
      if (Array.isArray(positionGroup)) {
        results.push(
          ...positionGroup.filter(
            (p) =>
              p.name.toLowerCase().includes(lowerQuery) ||
              p.college.toLowerCase().includes(lowerQuery)
          )
        );
      }
    }
  }

  return results;
}

// Get all players for a specific team (rookies + roster)
export function getAllTeamPlayers(teamId: NFLTeam): (RookieProfile | RosterPlayer)[] {
  const results: (RookieProfile | RosterPlayer)[] = [];

  // Get rookies for team
  results.push(...ALL_ROOKIES_2025.filter((r) => r.team === teamId));

  // Get roster players for team
  const teamRoster = ALL_TEAM_ROSTERS.find((t) => t.teamId === teamId);
  if (teamRoster) {
    const positions = Object.values(teamRoster.roster);
    for (const positionGroup of positions) {
      if (Array.isArray(positionGroup)) {
        results.push(...positionGroup);
      }
    }
  }

  return results;
}

// Get fantasy-relevant players with rankings
export function getFantasyPlayerRankings(position?: string): (RookieProfile | RosterPlayer)[] {
  const fantasyPositions = ['QB', 'RB', 'WR', 'TE', 'K'];
  const players: (RookieProfile | RosterPlayer)[] = [];

  // Add fantasy-relevant rookies
  const rookies = position
    ? ALL_ROOKIES_2025.filter((r) => r.fantasyPosition === position)
    : ALL_ROOKIES_2025.filter((r) => fantasyPositions.includes(r.fantasyPosition));
  players.push(...rookies);

  // Add fantasy-relevant roster players
  for (const team of ALL_TEAM_ROSTERS) {
    const positions = Object.values(team.roster);
    for (const positionGroup of positions) {
      if (Array.isArray(positionGroup)) {
        const relevantPlayers = positionGroup.filter((p) => {
          const isFantasyPosition =
            fantasyPositions.includes(p.position) ||
            (p.fantasyPosition && fantasyPositions.includes(p.fantasyPosition));
          const positionMatch =
            !position ||
            p.position === position ||
            (p.fantasyPosition && p.fantasyPosition === position);
          const isRelevant = ['ELITE', 'HIGH', 'MEDIUM'].includes(p.fantasyRelevance);
          return isFantasyPosition && positionMatch && isRelevant;
        });
        players.push(...relevantPlayers);
      }
    }
  }

  return players;
}

// Export default combined database object
export default {
  rookies: ALL_ROOKIES_2025,
  teams: ALL_TEAM_ROSTERS,
  stats: DATABASE_STATS,
  search: searchAllPlayers,
  getTeamPlayers: getAllTeamPlayers,
  getFantasyRankings: getFantasyPlayerRankings,
};
