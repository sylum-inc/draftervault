// 2025 NFL Draft Rookie Database - Complete Index (~500+ Rookies)
// Sources: NFL Combine, Pro Days, PFF, ESPN, NFL.com, FantasyPros, RotoWire

import { RookieProfile } from '../types';

// Core position groups (early-mid round picks)
import { QB_ROOKIES_2025 } from './qb';
import { RB_ROOKIES_2025 } from './rb';
import { WR_ROOKIES_2025 } from './wr';
import { TE_ROOKIES_2025 } from './te';
import { DEFENSE_ROOKIES_2025 } from './defense';
import { OLINE_ROOKIES_2025 } from './oline';
import { SPECIALISTS_ROOKIES_2025 } from './specialists';

// Late round picks and UDFAs
import { LATE_ROUND_QB_2025, LATE_ROUND_RB_2025 } from './late-round-qb-rb';
import { LATE_ROUND_WR_2025 } from './late-round-wr';
import {
  LATE_ROUND_TE_2025,
  LATE_ROUND_EDGE_2025,
  LATE_ROUND_LB_2025,
  LATE_ROUND_CB_2025,
  LATE_ROUND_S_2025,
} from './late-round-te-def';
import { LATE_ROUND_OLINE_2025 } from './late-round-oline';
import { LATE_ROUND_DL_2025 } from './late-round-dl';
import { LATE_ROUND_DB_2025 } from './late-round-db';
import { LATE_ROUND_LB_EDGE_2025 } from './late-round-lb-edge';
import { LATE_ROUND_SPECIALISTS_2025 } from './late-round-specialists';

// Export all position-specific rookie lists
export { QB_ROOKIES_2025 } from './qb';
export { RB_ROOKIES_2025 } from './rb';
export { WR_ROOKIES_2025 } from './wr';
export { TE_ROOKIES_2025 } from './te';
export { DEFENSE_ROOKIES_2025 } from './defense';
export { OLINE_ROOKIES_2025 } from './oline';
export { SPECIALISTS_ROOKIES_2025 } from './specialists';

// Export late-round rookies
export { LATE_ROUND_QB_2025, LATE_ROUND_RB_2025 } from './late-round-qb-rb';
export { LATE_ROUND_WR_2025 } from './late-round-wr';
export {
  LATE_ROUND_TE_2025,
  LATE_ROUND_EDGE_2025,
  LATE_ROUND_LB_2025,
  LATE_ROUND_CB_2025,
  LATE_ROUND_S_2025,
} from './late-round-te-def';
export { LATE_ROUND_OLINE_2025 } from './late-round-oline';
export { LATE_ROUND_DL_2025 } from './late-round-dl';
export { LATE_ROUND_DB_2025 } from './late-round-db';
export { LATE_ROUND_LB_EDGE_2025 } from './late-round-lb-edge';
export { LATE_ROUND_SPECIALISTS_2025 } from './late-round-specialists';

// Combined list of all 2025 rookies (~500+ players)
export const ALL_ROOKIES_2025: RookieProfile[] = [
  // Core position groups
  ...QB_ROOKIES_2025,
  ...RB_ROOKIES_2025,
  ...WR_ROOKIES_2025,
  ...TE_ROOKIES_2025,
  ...DEFENSE_ROOKIES_2025,
  ...OLINE_ROOKIES_2025,
  ...SPECIALISTS_ROOKIES_2025,
  // Late round and UDFAs
  ...LATE_ROUND_QB_2025,
  ...LATE_ROUND_RB_2025,
  ...LATE_ROUND_WR_2025,
  ...LATE_ROUND_TE_2025,
  ...LATE_ROUND_EDGE_2025,
  ...LATE_ROUND_LB_2025,
  ...LATE_ROUND_CB_2025,
  ...LATE_ROUND_S_2025,
  ...LATE_ROUND_OLINE_2025,
  ...LATE_ROUND_DL_2025,
  ...LATE_ROUND_DB_2025,
  ...LATE_ROUND_LB_EDGE_2025,
  ...LATE_ROUND_SPECIALISTS_2025,
];

// Rookie counts by position
export const ROOKIE_COUNTS = {
  QB: QB_ROOKIES_2025.length,
  RB: RB_ROOKIES_2025.length,
  WR: WR_ROOKIES_2025.length,
  TE: TE_ROOKIES_2025.length,
  DEFENSE: DEFENSE_ROOKIES_2025.length,
  OLINE: OLINE_ROOKIES_2025.length,
  SPECIALISTS: SPECIALISTS_ROOKIES_2025.length,
  TOTAL: ALL_ROOKIES_2025.length,
};

// Helper functions for accessing rookie data
export function getRookieById(playerId: string): RookieProfile | undefined {
  return ALL_ROOKIES_2025.find((r) => r.playerId === playerId);
}

export function getRookiesByTeam(team: string): RookieProfile[] {
  return ALL_ROOKIES_2025.filter((r) => r.team === team.toUpperCase());
}

export function getRookiesByPosition(position: string): RookieProfile[] {
  return ALL_ROOKIES_2025.filter((r) => r.position === position || r.fantasyPosition === position);
}

export function getRookiesByDraftRound(round: number): RookieProfile[] {
  return ALL_ROOKIES_2025.filter((r) => r.draft.round === round);
}

export function getTopRookiesByGrade(limit: number = 25): RookieProfile[] {
  return [...ALL_ROOKIES_2025].sort((a, b) => b.grades.overall - a.grades.overall).slice(0, limit);
}

export function getTopRookiesByAthleticism(limit: number = 25): RookieProfile[] {
  return [...ALL_ROOKIES_2025]
    .sort((a, b) => (b.combine.athleticScore || 0) - (a.combine.athleticScore || 0))
    .slice(0, limit);
}

export function getFantasyRelevantRookies(): RookieProfile[] {
  const fantasyPositions = ['QB', 'RB', 'WR', 'TE', 'K'];
  return ALL_ROOKIES_2025.filter((r) => fantasyPositions.includes(r.fantasyPosition));
}

export function getDynastyRookieRankings(limit: number = 50): RookieProfile[] {
  return [...getFantasyRelevantRookies()]
    .sort((a, b) => b.dynasty.fiveYearValue - a.dynasty.fiveYearValue)
    .slice(0, limit);
}

export function getRookiesWithCombineData(): RookieProfile[] {
  return ALL_ROOKIES_2025.filter(
    (r) =>
      r.combine.fortyYard !== undefined ||
      r.combine.vertical !== undefined ||
      r.combine.broadJump !== undefined
  );
}

export function searchRookies(query: string): RookieProfile[] {
  const lowerQuery = query.toLowerCase();
  return ALL_ROOKIES_2025.filter(
    (r) =>
      r.name.toLowerCase().includes(lowerQuery) ||
      r.college.toLowerCase().includes(lowerQuery) ||
      r.team.toLowerCase().includes(lowerQuery) ||
      r.position.toLowerCase().includes(lowerQuery)
  );
}

export function getImmediateImpactRookies(): RookieProfile[] {
  return ALL_ROOKIES_2025.filter(
    (r) => r.projection === 'IMMEDIATE_STARTER' || r.projection === 'YEAR_1_STARTER'
  ).sort((a, b) => b.grades.overall - a.grades.overall);
}

export function getSleeperRookies(): RookieProfile[] {
  return ALL_ROOKIES_2025.filter((r) => r.draft.round >= 4 && r.dynasty.fiveYearValue >= 65).sort(
    (a, b) => b.dynasty.fiveYearValue - a.dynasty.fiveYearValue
  );
}

export function compareRookies(
  playerId1: string,
  playerId2: string
): {
  rookie1: RookieProfile | undefined;
  rookie2: RookieProfile | undefined;
  comparison: {
    athleticAdvantage: string;
    productionAdvantage: string;
    situationAdvantage: string;
    overallAdvantage: string;
    dynastyAdvantage: string;
  } | null;
} {
  const rookie1 = getRookieById(playerId1);
  const rookie2 = getRookieById(playerId2);

  if (!rookie1 || !rookie2) {
    return { rookie1, rookie2, comparison: null };
  }

  return {
    rookie1,
    rookie2,
    comparison: {
      athleticAdvantage:
        rookie1.grades.athletic > rookie2.grades.athletic ? rookie1.name : rookie2.name,
      productionAdvantage:
        rookie1.grades.production > rookie2.grades.production ? rookie1.name : rookie2.name,
      situationAdvantage:
        rookie1.grades.situation > rookie2.grades.situation ? rookie1.name : rookie2.name,
      overallAdvantage:
        rookie1.grades.overall > rookie2.grades.overall ? rookie1.name : rookie2.name,
      dynastyAdvantage:
        rookie1.dynasty.fiveYearValue > rookie2.dynasty.fiveYearValue ? rookie1.name : rookie2.name,
    },
  };
}

// Data source information
export const ROOKIE_DATA_SOURCES = [
  { name: 'NFL Scouting Combine', type: 'Athletic Testing', reliability: 'OFFICIAL' },
  { name: 'University Pro Days', type: 'Athletic Testing', reliability: 'OFFICIAL' },
  { name: 'NFL Draft Results', type: 'Draft Position', reliability: 'OFFICIAL' },
  { name: 'Pro Football Focus', type: 'Grades & Analysis', reliability: 'VERIFIED' },
  { name: 'ESPN NFL Draft', type: 'Grades & Analysis', reliability: 'VERIFIED' },
  { name: 'FantasyPros', type: 'Fantasy Rankings', reliability: 'VERIFIED' },
  { name: 'RotoWire', type: 'Fantasy Analysis', reliability: 'VERIFIED' },
  { name: 'NFL.com', type: 'Official News', reliability: 'OFFICIAL' },
  { name: 'Pro Football Reference', type: 'Statistics', reliability: 'OFFICIAL' },
];

export default ALL_ROOKIES_2025;
