// NFL Team Rosters - Complete 53-Man Roster Database (All 32 Teams)
// Sources: Official Team Depth Charts, ESPN, NFL.com, Pro Football Reference, PFF

import { TeamRoster, RosterPlayer, NFLTeam } from '../types';

// NFC Divisions
import {
  NFC_EAST_ROSTERS,
  DALLAS_COWBOYS,
  PHILADELPHIA_EAGLES,
  NEW_YORK_GIANTS,
  WASHINGTON_COMMANDERS,
} from './nfc-east';
import {
  NFC_NORTH_ROSTERS,
  CHICAGO_BEARS,
  DETROIT_LIONS,
  GREEN_BAY_PACKERS,
  MINNESOTA_VIKINGS,
} from './nfc-north';
import {
  NFC_SOUTH_ROSTERS,
  ATLANTA_FALCONS,
  CAROLINA_PANTHERS,
  NEW_ORLEANS_SAINTS,
  TAMPA_BAY_BUCCANEERS,
} from './nfc-south';
import {
  NFC_WEST_ROSTERS,
  ARIZONA_CARDINALS,
  LOS_ANGELES_RAMS,
  SAN_FRANCISCO_49ERS,
  SEATTLE_SEAHAWKS,
} from './nfc-west';

// AFC Divisions
import {
  AFC_EAST_ROSTERS,
  BUFFALO_BILLS,
  MIAMI_DOLPHINS,
  NEW_ENGLAND_PATRIOTS,
  NEW_YORK_JETS,
} from './afc-east';
import {
  AFC_NORTH_ROSTERS,
  BALTIMORE_RAVENS,
  CINCINNATI_BENGALS,
  CLEVELAND_BROWNS,
  PITTSBURGH_STEELERS,
} from './afc-north';
import {
  AFC_SOUTH_ROSTERS,
  HOUSTON_TEXANS,
  INDIANAPOLIS_COLTS,
  JACKSONVILLE_JAGUARS,
  TENNESSEE_TITANS,
} from './afc-south';
import {
  AFC_WEST_ROSTERS,
  DENVER_BRONCOS,
  KANSAS_CITY_CHIEFS,
  LOS_ANGELES_CHARGERS,
  LAS_VEGAS_RAIDERS,
} from './afc-west';

// Re-export all divisions
export {
  NFC_EAST_ROSTERS,
  DALLAS_COWBOYS,
  PHILADELPHIA_EAGLES,
  NEW_YORK_GIANTS,
  WASHINGTON_COMMANDERS,
} from './nfc-east';
export {
  NFC_NORTH_ROSTERS,
  CHICAGO_BEARS,
  DETROIT_LIONS,
  GREEN_BAY_PACKERS,
  MINNESOTA_VIKINGS,
} from './nfc-north';
export {
  NFC_SOUTH_ROSTERS,
  ATLANTA_FALCONS,
  CAROLINA_PANTHERS,
  NEW_ORLEANS_SAINTS,
  TAMPA_BAY_BUCCANEERS,
} from './nfc-south';
export {
  NFC_WEST_ROSTERS,
  ARIZONA_CARDINALS,
  LOS_ANGELES_RAMS,
  SAN_FRANCISCO_49ERS,
  SEATTLE_SEAHAWKS,
} from './nfc-west';
export {
  AFC_EAST_ROSTERS,
  BUFFALO_BILLS,
  MIAMI_DOLPHINS,
  NEW_ENGLAND_PATRIOTS,
  NEW_YORK_JETS,
} from './afc-east';
export {
  AFC_NORTH_ROSTERS,
  BALTIMORE_RAVENS,
  CINCINNATI_BENGALS,
  CLEVELAND_BROWNS,
  PITTSBURGH_STEELERS,
} from './afc-north';
export {
  AFC_SOUTH_ROSTERS,
  HOUSTON_TEXANS,
  INDIANAPOLIS_COLTS,
  JACKSONVILLE_JAGUARS,
  TENNESSEE_TITANS,
} from './afc-south';
export {
  AFC_WEST_ROSTERS,
  DENVER_BRONCOS,
  KANSAS_CITY_CHIEFS,
  LOS_ANGELES_CHARGERS,
  LAS_VEGAS_RAIDERS,
} from './afc-west';

// All NFL team rosters combined (All 32 teams)
export const ALL_TEAM_ROSTERS: TeamRoster[] = [
  // NFC
  ...NFC_EAST_ROSTERS,
  ...NFC_NORTH_ROSTERS,
  ...NFC_SOUTH_ROSTERS,
  ...NFC_WEST_ROSTERS,
  // AFC
  ...AFC_EAST_ROSTERS,
  ...AFC_NORTH_ROSTERS,
  ...AFC_SOUTH_ROSTERS,
  ...AFC_WEST_ROSTERS,
];

// Team roster lookup by team ID (All 32 teams)
export const TEAM_ROSTER_MAP: Record<NFLTeam, TeamRoster> = {
  // NFC East
  DAL: DALLAS_COWBOYS,
  PHI: PHILADELPHIA_EAGLES,
  NYG: NEW_YORK_GIANTS,
  WAS: WASHINGTON_COMMANDERS,
  // NFC North
  CHI: CHICAGO_BEARS,
  DET: DETROIT_LIONS,
  GB: GREEN_BAY_PACKERS,
  MIN: MINNESOTA_VIKINGS,
  // NFC South
  ATL: ATLANTA_FALCONS,
  CAR: CAROLINA_PANTHERS,
  NO: NEW_ORLEANS_SAINTS,
  TB: TAMPA_BAY_BUCCANEERS,
  // NFC West
  ARI: ARIZONA_CARDINALS,
  LAR: LOS_ANGELES_RAMS,
  SF: SAN_FRANCISCO_49ERS,
  SEA: SEATTLE_SEAHAWKS,
  // AFC East
  BUF: BUFFALO_BILLS,
  MIA: MIAMI_DOLPHINS,
  NE: NEW_ENGLAND_PATRIOTS,
  NYJ: NEW_YORK_JETS,
  // AFC North
  BAL: BALTIMORE_RAVENS,
  CIN: CINCINNATI_BENGALS,
  CLE: CLEVELAND_BROWNS,
  PIT: PITTSBURGH_STEELERS,
  // AFC South
  HOU: HOUSTON_TEXANS,
  IND: INDIANAPOLIS_COLTS,
  JAX: JACKSONVILLE_JAGUARS,
  TEN: TENNESSEE_TITANS,
  // AFC West
  DEN: DENVER_BRONCOS,
  KC: KANSAS_CITY_CHIEFS,
  LAC: LOS_ANGELES_CHARGERS,
  LV: LAS_VEGAS_RAIDERS,
};

// Helper functions
export function getTeamRoster(teamId: NFLTeam): TeamRoster | undefined {
  return TEAM_ROSTER_MAP[teamId];
}

export function getTeamPlayers(teamId: NFLTeam): RosterPlayer[] {
  const roster = getTeamRoster(teamId);
  if (!roster) return [];

  const allPlayers: RosterPlayer[] = [];
  const positions = Object.values(roster.roster);
  positions.forEach((positionGroup) => {
    if (Array.isArray(positionGroup)) {
      allPlayers.push(...positionGroup);
    }
  });
  return allPlayers;
}

export function getPlayerById(playerId: string): RosterPlayer | undefined {
  for (const roster of ALL_TEAM_ROSTERS) {
    const players = getTeamPlayers(roster.teamId);
    const player = players.find((p) => p.playerId === playerId);
    if (player) return player;
  }
  return undefined;
}

export function getPlayersByPosition(position: string): RosterPlayer[] {
  const players: RosterPlayer[] = [];
  for (const roster of ALL_TEAM_ROSTERS) {
    const teamPlayers = getTeamPlayers(roster.teamId);
    players.push(...teamPlayers.filter((p) => p.position === position));
  }
  return players;
}

export function getFantasyRelevantPlayers(
  minRelevance: 'ELITE' | 'HIGH' | 'MEDIUM' = 'MEDIUM'
): RosterPlayer[] {
  const relevanceLevels = ['ELITE', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];
  const minIndex = relevanceLevels.indexOf(minRelevance);

  const players: RosterPlayer[] = [];
  for (const roster of ALL_TEAM_ROSTERS) {
    const teamPlayers = getTeamPlayers(roster.teamId);
    players.push(
      ...teamPlayers.filter((p) => {
        const playerIndex = relevanceLevels.indexOf(p.fantasyRelevance);
        return playerIndex <= minIndex;
      })
    );
  }
  return players.sort((a, b) => {
    const aIndex = relevanceLevels.indexOf(a.fantasyRelevance);
    const bIndex = relevanceLevels.indexOf(b.fantasyRelevance);
    return aIndex - bIndex;
  });
}

export function getStarters(teamId: NFLTeam): RosterPlayer[] {
  const players = getTeamPlayers(teamId);
  return players.filter((p) => p.isStarter);
}

export function searchPlayers(query: string): RosterPlayer[] {
  const lowerQuery = query.toLowerCase();
  const results: RosterPlayer[] = [];

  for (const roster of ALL_TEAM_ROSTERS) {
    const teamPlayers = getTeamPlayers(roster.teamId);
    results.push(
      ...teamPlayers.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.college.toLowerCase().includes(lowerQuery) ||
          p.position.toLowerCase().includes(lowerQuery)
      )
    );
  }

  return results;
}

// Team analysis helpers
export function getTeamsByOffensiveStrength(): TeamRoster[] {
  return [...ALL_TEAM_ROSTERS].sort(
    (a, b) => b.analysis.offensiveStrength - a.analysis.offensiveStrength
  );
}

export function getTeamsByDefensiveStrength(): TeamRoster[] {
  return [...ALL_TEAM_ROSTERS].sort(
    (a, b) => b.analysis.defensiveStrength - a.analysis.defensiveStrength
  );
}

export function getTeamsByFantasyFriendliness(): TeamRoster[] {
  return [...ALL_TEAM_ROSTERS].sort(
    (a, b) => b.analysis.fantasyFriendliness - a.analysis.fantasyFriendliness
  );
}

// Player count by team
export function getPlayerCount(teamId: NFLTeam): number {
  return getTeamPlayers(teamId).length;
}

// Get all players from all teams
export function getAllPlayers(): RosterPlayer[] {
  const allPlayers: RosterPlayer[] = [];
  for (const roster of ALL_TEAM_ROSTERS) {
    allPlayers.push(...getTeamPlayers(roster.teamId));
  }
  return allPlayers;
}

// Get total player count across all teams
export function getTotalPlayerCount(): number {
  return getAllPlayers().length;
}

// Get teams by division
export function getTeamsByDivision(
  conference: 'NFC' | 'AFC',
  division: 'East' | 'North' | 'South' | 'West'
): TeamRoster[] {
  return ALL_TEAM_ROSTERS.filter((t) => t.conference === conference && t.division === division);
}

// Get teams by conference
export function getTeamsByConference(conference: 'NFC' | 'AFC'): TeamRoster[] {
  return ALL_TEAM_ROSTERS.filter((t) => t.conference === conference);
}

// Roster data sources
export const ROSTER_DATA_SOURCES = [
  { name: 'Official Team Depth Charts', type: 'Roster/Depth', reliability: 'OFFICIAL' },
  { name: 'ESPN NFL Rosters', type: 'Roster/Stats', reliability: 'VERIFIED' },
  { name: 'NFL.com Team Pages', type: 'Roster/News', reliability: 'OFFICIAL' },
  { name: 'Pro Football Reference', type: 'Statistics', reliability: 'OFFICIAL' },
  { name: 'Pro Football Focus', type: 'Grades/Analysis', reliability: 'VERIFIED' },
  { name: 'RotoWire', type: 'Fantasy/Injuries', reliability: 'VERIFIED' },
  { name: 'FantasyPros', type: 'Rankings/ADP', reliability: 'VERIFIED' },
];

// Database stats
export const ROSTER_DATABASE_STATS = {
  totalTeams: 32,
  totalPlayers: () => getTotalPlayerCount(),
  lastUpdated: '2025-01-05',
  season: '2025',
  dataVersion: '2.0.0',
};

export default ALL_TEAM_ROSTERS;
