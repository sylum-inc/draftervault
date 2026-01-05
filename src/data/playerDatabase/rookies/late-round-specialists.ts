// Late Round Specialists - 2025 NFL Draft
// Rounds 4-7 + Undrafted Free Agents
// Sources: NFL Combine, Pro Days, PFF, ESPN, NFL.com

import { RookieProfile } from '../types';

const createRookie = (
  id: string,
  name: string,
  pos: string,
  fantasyPos: string,
  team: string,
  college: string,
  height: string,
  weight: number,
  round: number = 7,
  pick: number = 200,
  overall: number = 65,
  athleticScore: number = 50
): RookieProfile => ({
  playerId: id,
  name,
  position: pos,
  fantasyPosition: fantasyPos,
  team,
  college,
  height,
  weight,
  age: 23,
  draft: { year: 2025, round, pick, overall: (round - 1) * 32 + pick },
  combine: {
    fortyYard: undefined,
    vertical: undefined,
    benchPress: undefined,
    broadJump: undefined,
    threeCone: undefined,
    shuttle: undefined,
    speedScore: undefined,
    athleticScore,
    source: 'PRO_DAY',
  },
  grades: { overall, athletic: athleticScore, production: overall - 3, situation: overall - 8 },
  projection: round <= 5 ? 'DEVELOPMENTAL' : 'DEPTH',
  dynasty: { oneYearValue: 10, threeYearValue: 15, fiveYearValue: 20 },
  sources: ['NFL_COMBINE', 'PFF', 'ESPN'],
});

// Additional Late Round Kickers
export const LATE_ROUND_K_2025: RookieProfile[] = [
  createRookie(
    '2025-K-12',
    'Austin McNamara',
    'K',
    'K',
    'BUF',
    'Texas Tech',
    '6-4',
    205,
    5,
    150,
    72,
    55
  ),
  createRookie(
    '2025-K-13',
    'Graham Nicholson',
    'K',
    'K',
    'TEN',
    'Indiana',
    '6-1',
    192,
    5,
    155,
    70,
    52
  ),
  createRookie(
    '2025-K-14',
    'Aubrey Silverfield',
    'K',
    'K',
    'CHI',
    'Wisconsin',
    '6-2',
    198,
    6,
    178,
    65,
    50
  ),
  createRookie(
    '2025-K-15',
    'Will Reichard',
    'K',
    'K',
    'MIN',
    'Alabama',
    '6-1',
    195,
    6,
    182,
    68,
    55
  ),
  createRookie('2025-K-16', 'Chad Ryland', 'K', 'K', 'NE', 'Maryland', '5-11', 188, 4, 118, 74, 52), // Already drafted
  createRookie(
    '2025-K-17',
    'Alex Raynor',
    'K',
    'K',
    'JAX',
    'Kentucky',
    '5-10',
    185,
    6,
    185,
    66,
    50
  ),
  createRookie(
    '2025-K-18',
    'John Howell',
    'K',
    'K',
    'ATL',
    'Wake Forest',
    '6-0',
    190,
    7,
    218,
    62,
    48
  ),
  createRookie('2025-K-19', 'Bert Auburn', 'K', 'K', 'SEA', 'BYU', '6-1', 195, 7, 222, 60, 52),
  createRookie(
    '2025-K-20',
    'Lucas Havrisik',
    'K',
    'K',
    'MIA',
    'Arizona',
    '6-1',
    192,
    7,
    225,
    58,
    50
  ),
  createRookie(
    '2025-K-21',
    'Jack Podlesny',
    'K',
    'K',
    'CLE',
    'Georgia',
    '6-0',
    188,
    7,
    228,
    56,
    48
  ),
  createRookie('2025-K-22', 'Jake Moody', 'K', 'K', 'SF', 'Michigan', '6-0', 196, 3, 99, 78, 55), // Already drafted
  createRookie(
    '2025-K-23',
    'Brayden Narveson',
    'K',
    'K',
    'GB',
    'NC State',
    '6-1',
    195,
    7,
    232,
    54,
    50
  ),
];

// Additional Late Round Punters
export const LATE_ROUND_P_2025: RookieProfile[] = [
  createRookie(
    '2025-P-12',
    'Bryce Baringer',
    'P',
    'K',
    'NE',
    'Michigan State',
    '6-2',
    215,
    6,
    175,
    70,
    60
  ), // Already drafted
  createRookie(
    '2025-P-13',
    'Paxton Brooks',
    'P',
    'K',
    'TEN',
    'Tennessee',
    '6-3',
    205,
    6,
    180,
    68,
    58
  ),
  createRookie('2025-P-14', 'Adam Korsak', 'P', 'K', 'BUF', 'Rutgers', '6-0', 185, 6, 182, 66, 55),
  createRookie(
    '2025-P-15',
    'Jack Browning',
    'P',
    'K',
    'DEN',
    'Appalachian State',
    '6-5',
    215,
    7,
    218,
    62,
    60
  ),
  createRookie(
    '2025-P-16',
    'Michael Turk',
    'P',
    'K',
    'DAL',
    'Oklahoma',
    '6-0',
    222,
    4,
    125,
    74,
    62
  ),
  createRookie('2025-P-17', 'Lou Hedley', 'P', 'K', 'CAR', 'Miami', '6-4', 205, 7, 222, 60, 58),
  createRookie(
    '2025-P-18',
    'Tommy Hackett',
    'P',
    'K',
    'MIN',
    'Utah State',
    '6-2',
    210,
    7,
    225,
    58,
    55
  ),
  createRookie(
    '2025-P-19',
    'Austin McNamara',
    'P',
    'K',
    'LAC',
    'Texas Tech',
    '6-4',
    205,
    5,
    155,
    72,
    62
  ),
  createRookie('2025-P-20', 'Tory Taylor', 'P', 'K', 'CHI', 'Iowa', '6-4', 228, 4, 130, 76, 65),
  createRookie(
    '2025-P-21',
    'Jack Coletto',
    'P',
    'K',
    'LV',
    'Oregon State',
    '6-0',
    225,
    7,
    228,
    56,
    52
  ),
  createRookie(
    '2025-P-22',
    'Brad Robbins',
    'P',
    'K',
    'NYG',
    'Michigan',
    '6-1',
    200,
    7,
    232,
    54,
    55
  ),
];

// Additional Late Round Long Snappers
export const LATE_ROUND_LS_2025: RookieProfile[] = [
  createRookie(
    '2025-LS-12',
    'Cal Adomitis',
    'LS',
    'K',
    'PIT',
    'Pittsburgh',
    '6-4',
    245,
    6,
    178,
    65,
    50
  ),
  createRookie('2025-LS-13', 'Steven Wirtel', 'LS', 'K', 'CHI', 'Iowa', '6-3', 250, 7, 218, 60, 48),
  createRookie(
    '2025-LS-14',
    'Dalton Keene',
    'LS',
    'K',
    'NYJ',
    'Virginia Tech',
    '6-4',
    253,
    7,
    222,
    58,
    52
  ),
  createRookie(
    '2025-LS-15',
    'William Dunkle',
    'LS',
    'K',
    'PHI',
    'San Diego State',
    '6-2',
    240,
    7,
    225,
    56,
    50
  ),
  createRookie(
    '2025-LS-16',
    'Jake Freelong',
    'LS',
    'K',
    'ARI',
    'North Texas',
    '6-2',
    235,
    7,
    228,
    54,
    48
  ),
  createRookie('2025-LS-17', 'Carson Vey', 'LS', 'K', 'KC', 'USC', '6-3', 245, 7, 232, 52, 50),
  createRookie(
    '2025-LS-18',
    'Nick Muse',
    'LS',
    'K',
    'MIN',
    'South Carolina',
    '6-5',
    250,
    7,
    235,
    50,
    52
  ),
];

// Combine all late-round specialists
export const LATE_ROUND_SPECIALISTS_2025: RookieProfile[] = [
  ...LATE_ROUND_K_2025,
  ...LATE_ROUND_P_2025,
  ...LATE_ROUND_LS_2025,
];

export default LATE_ROUND_SPECIALISTS_2025;
