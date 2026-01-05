// Comprehensive Player Database Types
// Data sourced from: NFL Combine, Pro Days, Team Reports, PFF, ESPN, NFL.com, FantasyPros

export interface DataSource {
  name: string;
  url?: string;
  lastUpdated: string;
  reliability: 'OFFICIAL' | 'VERIFIED' | 'PROJECTED' | 'ESTIMATED';
}

export const DATA_SOURCES: Record<string, DataSource> = {
  NFL_COMBINE: {
    name: 'NFL Scouting Combine',
    url: 'https://www.nfl.com/combine',
    lastUpdated: '2025-03-05',
    reliability: 'OFFICIAL',
  },
  PRO_DAY: {
    name: 'University Pro Days',
    lastUpdated: '2025-04-01',
    reliability: 'OFFICIAL',
  },
  NFL_DRAFT: {
    name: 'NFL Draft Results',
    url: 'https://www.nfl.com/draft',
    lastUpdated: '2025-04-28',
    reliability: 'OFFICIAL',
  },
  PFF: {
    name: 'Pro Football Focus',
    url: 'https://www.pff.com',
    lastUpdated: '2025-09-01',
    reliability: 'VERIFIED',
  },
  ESPN: {
    name: 'ESPN NFL',
    url: 'https://www.espn.com/nfl',
    lastUpdated: '2025-09-01',
    reliability: 'VERIFIED',
  },
  FANTASY_PROS: {
    name: 'FantasyPros',
    url: 'https://www.fantasypros.com',
    lastUpdated: '2025-09-01',
    reliability: 'VERIFIED',
  },
  TEAM_DEPTH_CHART: {
    name: 'Official Team Depth Charts',
    lastUpdated: '2025-09-01',
    reliability: 'OFFICIAL',
  },
  ROTOWIRE: {
    name: 'RotoWire',
    url: 'https://www.rotowire.com',
    lastUpdated: '2025-09-01',
    reliability: 'VERIFIED',
  },
  SPORTS_REFERENCE: {
    name: 'Sports Reference / Pro Football Reference',
    url: 'https://www.pro-football-reference.com',
    lastUpdated: '2025-09-01',
    reliability: 'OFFICIAL',
  },
};

export type NFLTeam =
  | 'ARI'
  | 'ATL'
  | 'BAL'
  | 'BUF'
  | 'CAR'
  | 'CHI'
  | 'CIN'
  | 'CLE'
  | 'DAL'
  | 'DEN'
  | 'DET'
  | 'GB'
  | 'HOU'
  | 'IND'
  | 'JAX'
  | 'KC'
  | 'LAC'
  | 'LAR'
  | 'LV'
  | 'MIA'
  | 'MIN'
  | 'NE'
  | 'NO'
  | 'NYG'
  | 'NYJ'
  | 'PHI'
  | 'PIT'
  | 'SEA'
  | 'SF'
  | 'TB'
  | 'TEN'
  | 'WAS';

export type OffensivePosition = 'QB' | 'RB' | 'FB' | 'WR' | 'TE' | 'LT' | 'LG' | 'C' | 'RG' | 'RT';
export type DefensivePosition =
  | 'DE'
  | 'DT'
  | 'NT'
  | 'OLB'
  | 'ILB'
  | 'MLB'
  | 'CB'
  | 'FS'
  | 'SS'
  | 'DB';
export type SpecialTeamsPosition = 'K' | 'P' | 'LS' | 'KR' | 'PR';
export type Position = OffensivePosition | DefensivePosition | SpecialTeamsPosition | 'DST';

export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' | 'FLEX' | 'IDP';

export interface CombineMetrics {
  fortyYard?: number;
  tenYardSplit?: number;
  vertical?: number;
  benchPress?: number;
  broadJump?: number;
  threeCone?: number;
  shuttle?: number;
  sixtyYardShuttle?: number;
  speedScore?: number;
  athleticScore?: number;
  heightAdjustedSpeedScore?: number;
  burstScore?: number;
  agilityScore?: number;
  source: 'COMBINE' | 'PRO_DAY' | 'PROJECTED';
}

export interface CollegeStats {
  school: string;
  conference: string;
  gamesPlayed: number;
  gamesStarted: number;
  // Passing (QB)
  passingYards?: number;
  passingTDs?: number;
  interceptions?: number;
  completionPct?: number;
  yardsPerAttempt?: number;
  qbRating?: number;
  // Rushing
  rushingYards?: number;
  rushingTDs?: number;
  yardsPerCarry?: number;
  // Receiving
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  yardsPerReception?: number;
  // Production metrics
  scrimmageYards?: number;
  totalTDs?: number;
  productionScore?: number; // 0-100
}

export interface DraftInfo {
  year: number;
  round: number;
  pick: number;
  overallPick: number;
  team: NFLTeam;
  tradeNotes?: string;
}

export interface RookieProfile {
  playerId: string;
  name: string;
  position: Position;
  fantasyPosition: FantasyPosition;
  team: NFLTeam;

  // Physical
  height: string;
  heightInches: number;
  weight: number;
  age: number;
  birthDate: string;
  armLength?: number;
  handSize?: number;
  wingspan?: number;

  // Background
  college: string;
  collegeConference: string;
  hometown?: string;
  highSchoolRating?: number; // 1-5 stars

  // Draft
  draft: DraftInfo;

  // Combine & Athletic Testing
  combine: CombineMetrics;
  proDayMetrics?: Partial<CombineMetrics>;

  // College Production
  collegeStats: CollegeStats;

  // Scouting Grades (0-100)
  grades: {
    overall: number;
    production: number;
    athletic: number;
    situation: number;
    technique: number;
    intangibles: number;
  };

  // NFL Outlook
  playerComparisons: string[];
  projection:
    | 'IMMEDIATE_STARTER'
    | 'YEAR_1_STARTER'
    | 'ROTATIONAL'
    | 'DEVELOPMENTAL'
    | 'PRACTICE_SQUAD';

  // Dynasty Values
  dynasty: {
    rookieRank: number;
    oneYearValue: number;
    threeYearValue: number;
    fiveYearValue: number;
  };

  // Scouting Report
  strengths: string[];
  weaknesses: string[];
  summary: string;

  // Fantasy Outlook
  fantasyOutlook: {
    bestCase: string;
    worstCase: string;
    mostLikely: string;
    rookieADP?: number;
    dynastyADP?: number;
  };

  // Data attribution
  sources: string[];
}

export interface RosterPlayer {
  playerId: string;
  name: string;
  position: Position;
  fantasyPosition?: FantasyPosition;
  jerseyNumber: number;

  // Physical
  height: string;
  weight: number;
  age: number;

  // Experience
  experience: number;
  college: string;

  // Draft Info
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  isUDFA?: boolean;

  // Status
  rosterStatus: 'ACTIVE' | 'IR' | 'PUP' | 'SUSPENDED' | 'PRACTICE_SQUAD' | 'RESERVE_NFI';
  injuryStatus?: 'HEALTHY' | 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR';
  injuryDetails?: string;

  // Depth Chart
  depthChartOrder: number;
  isStarter: boolean;

  // Fantasy
  fantasyRelevance: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

  // Contract
  contractYearsRemaining?: number;
  isFranchiseTagged?: boolean;

  // Combine data (if available)
  combine?: Partial<CombineMetrics>;

  // Career Stats Summary
  careerStats?: {
    gamesPlayed: number;
    gamesStarted: number;
    // Position-specific career totals
    [key: string]: number | undefined;
  };

  sources: string[];
}

export interface TeamRoster {
  teamId: NFLTeam;
  teamName: string;
  city: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
  headCoach: string;
  offensiveCoordinator: string;
  defensiveCoordinator: string;
  offensiveScheme: string;
  defensiveScheme: string;

  lastUpdated: string;
  sources: string[];

  // Full 53-man roster organized by position
  roster: {
    // Offense
    QB: RosterPlayer[];
    RB: RosterPlayer[];
    FB: RosterPlayer[];
    WR: RosterPlayer[];
    TE: RosterPlayer[];
    LT: RosterPlayer[];
    LG: RosterPlayer[];
    C: RosterPlayer[];
    RG: RosterPlayer[];
    RT: RosterPlayer[];

    // Defense
    DE: RosterPlayer[];
    DT: RosterPlayer[];
    NT: RosterPlayer[];
    OLB: RosterPlayer[];
    ILB: RosterPlayer[];
    MLB: RosterPlayer[];
    CB: RosterPlayer[];
    FS: RosterPlayer[];
    SS: RosterPlayer[];
    DB: RosterPlayer[];

    // Special Teams
    K: RosterPlayer[];
    P: RosterPlayer[];
    LS: RosterPlayer[];
  };

  // Depth chart analysis
  analysis: {
    offensiveStrength: number; // 1-10
    defensiveStrength: number; // 1-10
    specialTeamsStrength: number; // 1-10
    scheduleStrength: number; // 1-10
    fantasyFriendliness: number; // 1-10
    keyPositionBattles: string[];
    injuryConcerns: string[];
  };
}

export interface DepthChartPrediction {
  team: NFLTeam;
  position: Position;
  currentStarter: string;
  projectedStarter: string;
  confidence: number;
  reasoning: string;
  timeline: 'IMMEDIATE' | 'EARLY_SEASON' | 'MID_SEASON' | 'LATE_SEASON' | 'NEXT_YEAR';
  impactOnFantasy: string;
  sources: string[];
}

export const NFL_TEAMS: Record<
  NFLTeam,
  {
    name: string;
    city: string;
    conference: 'AFC' | 'NFC';
    division: 'North' | 'South' | 'East' | 'West';
  }
> = {
  ARI: { name: 'Cardinals', city: 'Arizona', conference: 'NFC', division: 'West' },
  ATL: { name: 'Falcons', city: 'Atlanta', conference: 'NFC', division: 'South' },
  BAL: { name: 'Ravens', city: 'Baltimore', conference: 'AFC', division: 'North' },
  BUF: { name: 'Bills', city: 'Buffalo', conference: 'AFC', division: 'East' },
  CAR: { name: 'Panthers', city: 'Carolina', conference: 'NFC', division: 'South' },
  CHI: { name: 'Bears', city: 'Chicago', conference: 'NFC', division: 'North' },
  CIN: { name: 'Bengals', city: 'Cincinnati', conference: 'AFC', division: 'North' },
  CLE: { name: 'Browns', city: 'Cleveland', conference: 'AFC', division: 'North' },
  DAL: { name: 'Cowboys', city: 'Dallas', conference: 'NFC', division: 'East' },
  DEN: { name: 'Broncos', city: 'Denver', conference: 'AFC', division: 'West' },
  DET: { name: 'Lions', city: 'Detroit', conference: 'NFC', division: 'North' },
  GB: { name: 'Packers', city: 'Green Bay', conference: 'NFC', division: 'North' },
  HOU: { name: 'Texans', city: 'Houston', conference: 'AFC', division: 'South' },
  IND: { name: 'Colts', city: 'Indianapolis', conference: 'AFC', division: 'South' },
  JAX: { name: 'Jaguars', city: 'Jacksonville', conference: 'AFC', division: 'South' },
  KC: { name: 'Chiefs', city: 'Kansas City', conference: 'AFC', division: 'West' },
  LAC: { name: 'Chargers', city: 'Los Angeles', conference: 'AFC', division: 'West' },
  LAR: { name: 'Rams', city: 'Los Angeles', conference: 'NFC', division: 'West' },
  LV: { name: 'Raiders', city: 'Las Vegas', conference: 'AFC', division: 'West' },
  MIA: { name: 'Dolphins', city: 'Miami', conference: 'AFC', division: 'East' },
  MIN: { name: 'Vikings', city: 'Minnesota', conference: 'NFC', division: 'North' },
  NE: { name: 'Patriots', city: 'New England', conference: 'AFC', division: 'East' },
  NO: { name: 'Saints', city: 'New Orleans', conference: 'NFC', division: 'South' },
  NYG: { name: 'Giants', city: 'New York', conference: 'NFC', division: 'East' },
  NYJ: { name: 'Jets', city: 'New York', conference: 'AFC', division: 'East' },
  PHI: { name: 'Eagles', city: 'Philadelphia', conference: 'NFC', division: 'East' },
  PIT: { name: 'Steelers', city: 'Pittsburgh', conference: 'AFC', division: 'North' },
  SEA: { name: 'Seahawks', city: 'Seattle', conference: 'NFC', division: 'West' },
  SF: { name: '49ers', city: 'San Francisco', conference: 'NFC', division: 'West' },
  TB: { name: 'Buccaneers', city: 'Tampa Bay', conference: 'NFC', division: 'South' },
  TEN: { name: 'Titans', city: 'Tennessee', conference: 'AFC', division: 'South' },
  WAS: { name: 'Commanders', city: 'Washington', conference: 'NFC', division: 'East' },
};
