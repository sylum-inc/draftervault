// Comprehensive NFL Player Types with Combine Metrics and Depth Charts

export interface CombineMetrics {
  fortyYard?: number; // 40-yard dash time (seconds)
  vertical?: number; // Vertical jump (inches)
  benchPress?: number; // 225lb reps
  broadJump?: number; // Broad jump (inches)
  threeCone?: number; // 3-cone drill (seconds)
  shuttle?: number; // 20-yard shuttle (seconds)
  height?: string; // e.g., "6'2"
  weight?: number; // pounds
  armLength?: number; // inches
  handSize?: number; // inches
  speedScore?: number; // Calculated speed score (0-100)
  athleticScore?: number; // Overall athletic score (0-100)
}

export interface LastSeasonStats {
  games: number;
  gamesStarted: number;
  // Passing
  passAttempts?: number;
  passCompletions?: number;
  passYards?: number;
  passTDs?: number;
  interceptions?: number;
  // Rushing
  rushAttempts?: number;
  rushYards?: number;
  rushTDs?: number;
  yardsPerCarry?: number;
  // Receiving
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  yardsPerReception?: number;
  catchRate?: number;
  // General
  totalTDs?: number;
  fantasyPointsPPR?: number;
  fantasyPointsHalfPPR?: number;
  fantasyPointsStandard?: number;
  rankPPR?: number;
  // Kicker
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
  extraPointsMade?: number;
  // Defense
  sacks?: number;
  defenseInterceptions?: number;
  fumbleRecoveries?: number;
  defenseTDs?: number;
  pointsAllowed?: number;
}

export interface CareerStats {
  seasons: number;
  totalGames: number;
  totalStarts: number;
  totalYards: number;
  totalTDs: number;
  proBowls: number;
  allPro: number;
  championships: number;
  careerFantasyPoints: number;
  bestSeasonPoints: number;
  averageSeasonPoints: number;
}

export interface DepthChartInfo {
  position: number; // 1 = starter, 2 = backup, 3 = third string, etc.
  role: 'STARTER' | 'ROTATIONAL' | 'BACKUP' | 'SPECIAL_TEAMS' | 'PRACTICE_SQUAD';
  projectedSnaps: number; // Percentage
  projectedOpportunity: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  pathToPlaying: string; // e.g., "Injury to RB1", "Week 10 emergence"
  competitorNames: string[]; // Players competing for same role
  jobSecurityScore: number; // 0-100
  promotionChance: number; // 0-100 chance of moving up depth chart
}

export interface RookieProfile {
  isRookie: boolean;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  college?: string;
  collegeConference?: string;
  collegeStats?: {
    games: number;
    totalYards: number;
    totalTDs: number;
    yardsPerGame: number;
  };
  combine?: CombineMetrics;
  productionScore?: number; // College production (0-100)
  situationScore?: number; // Landing spot quality (0-100)
  breakoutAge?: number;
  comparisons?: string[]; // NFL player comparisons
  rookieProjection?: 'IMMEDIATE_STARTER' | 'ROTATIONAL_YEAR_1' | 'DEVELOPMENTAL' | 'SLEEPER';
}

export interface OffSeasonInfo {
  freeAgentStatus?: 'SIGNED' | 'RE_SIGNED' | 'NEW_TEAM' | 'DRAFTED' | 'UDFA';
  previousTeam?: string;
  contractYearsRemaining?: number;
  contractValue?: number; // Annual average
  offSeasonBuzz: 'HOT' | 'POSITIVE' | 'NEUTRAL' | 'CONCERNING' | 'COLD';
  campReports: string[];
  injuryRecovery?: string;
  holdout?: boolean;
  tradeRumors?: boolean;
  roleChange?: string;
}

export interface WeeklyScheduleAnalysis {
  week: number;
  opponent: string;
  homeAway: 'HOME' | 'AWAY';
  opponentRankVsPosition: number; // 1-32
  projectedPoints: number;
  matchupGrade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  weatherRisk: boolean;
  primetime: boolean;
  byeWeek: boolean;
}

export interface ComprehensivePlayer {
  // Core Identity
  id: string;
  name: string;
  fullName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  team: string;
  number?: number;

  // Physical Profile
  age: number;
  height?: string;
  weight?: number;
  birthDate?: string;
  college?: string;

  // Draft Capital
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;

  // Experience
  experience: number; // Years in NFL
  nflDebut?: number; // Year

  // Fantasy Value
  tier: 1 | 2 | 3 | 4 | 5;
  adp: number;
  auctionValue: number;
  projectedPoints: number;
  pprProjection: number;
  halfPprProjection: number;
  standardProjection: number;

  // Risk/Reward Profile
  upside: number;
  floor: number;
  ceiling: number;
  consistency: number; // 1-10
  bustRisk: number; // 0-100
  breakoutPotential: number; // 0-100
  injuryRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  ageRisk: 'LOW' | 'MEDIUM' | 'HIGH';

  // Opportunity Metrics
  targetShare: number;
  redZoneShare: number;
  snapPercentage: number;
  opportunityRank: number;
  valueOverReplacement: number;

  // Team Context
  offensiveLineRank: number;
  teamPaceRank: number;
  byeWeek: number;
  weatherConcerns: boolean;
  coachingStability: 'STABLE' | 'NEW_COACH' | 'NEW_SYSTEM';

  // Contract/Status
  contractStatus: 'SECURE' | 'EXPIRING' | 'ROOKIE' | 'FRANCHISE_TAG';
  competitionLevel: 'LOCKED_STARTER' | 'MINOR_COMPETITION' | 'TIMESHARE' | 'COMMITTEE';
  recentTrends: 'RISING' | 'STABLE' | 'DECLINING';

  // Enhanced Data
  lastSeasonStats?: LastSeasonStats;
  careerStats?: CareerStats;
  depthChart: DepthChartInfo;
  rookie?: RookieProfile;
  offSeason?: OffSeasonInfo;
  scheduleAnalysis?: WeeklyScheduleAnalysis[];

  // Injury History
  injuryHistory: string[];
  currentInjury?: string;
  injuryDesignation?: 'HEALTHY' | 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR' | 'PUP';

  // Additional Insights
  strengthOfSchedule: number; // 1-10
  playoffSchedule: 'EASY' | 'MODERATE' | 'DIFFICULT';
  handcuffValue: number;
  primaryBackup?: string;
  handcuffRecommendation?: string;
  sleeper: boolean;

  // Misc
  tags?: string[]; // e.g., ['Breakout Candidate', 'Injury Risk', 'Handcuff']
  notes?: string;

  // Draft State
  isDrafted: boolean;
  draftedBy?: string;
  draftCost?: number;
  pickNumber?: number;
}

// Position-specific interfaces
export interface QBPlayer extends ComprehensivePlayer {
  position: 'QB';
  rushingUpside: boolean;
  weaponsScore: number; // Quality of receivers (0-100)
  protectionScore: number; // O-line pass protection (0-100)
  playAction: boolean;
  deepBall: boolean;
}

export interface RBPlayer extends ComprehensivePlayer {
  position: 'RB';
  receivingBack: boolean;
  goalLineBack: boolean;
  threeDownBack: boolean;
  rushingGrade: number;
  receivingGrade: number;
  passBlockingGrade: number;
}

export interface WRPlayer extends ComprehensivePlayer {
  position: 'WR';
  route: 'X' | 'Z' | 'SLOT' | 'VERSATILE';
  separationAbility: number;
  contestedCatchRate: number;
  deepThreatAbility: number;
  yacAbility: number;
}

export interface TEPlayer extends ComprehensivePlayer {
  position: 'TE';
  receivingTE: boolean;
  blockingTE: boolean;
  inlineSnaps: number;
  slotSnaps: number;
  redZoneTarget: boolean;
}

// Team Depth Chart
export interface TeamDepthChart {
  team: string;
  teamFullName: string;
  conference: 'AFC' | 'NFC';
  division: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';
  offensiveScheme: string;
  headCoach: string;
  offensiveCoordinator: string;
  byeWeek: number;
  projectedWins: number;

  depth: {
    QB: string[]; // Player IDs in depth order
    RB: string[];
    WR: string[];
    TE: string[];
    K: string[];
    DST: string[];
  };

  offensiveLineRank: number;
  passingAttemptsPerGame: number;
  rushingAttemptsPerGame: number;
  playsPerGame: number;
  redZoneTripsPerGame: number;
}

export type PlayerPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

export const NFL_TEAMS = {
  ARI: { name: 'Arizona Cardinals', conference: 'NFC', division: 'WEST' },
  ATL: { name: 'Atlanta Falcons', conference: 'NFC', division: 'SOUTH' },
  BAL: { name: 'Baltimore Ravens', conference: 'AFC', division: 'NORTH' },
  BUF: { name: 'Buffalo Bills', conference: 'AFC', division: 'EAST' },
  CAR: { name: 'Carolina Panthers', conference: 'NFC', division: 'SOUTH' },
  CHI: { name: 'Chicago Bears', conference: 'NFC', division: 'NORTH' },
  CIN: { name: 'Cincinnati Bengals', conference: 'AFC', division: 'NORTH' },
  CLE: { name: 'Cleveland Browns', conference: 'AFC', division: 'NORTH' },
  DAL: { name: 'Dallas Cowboys', conference: 'NFC', division: 'EAST' },
  DEN: { name: 'Denver Broncos', conference: 'AFC', division: 'WEST' },
  DET: { name: 'Detroit Lions', conference: 'NFC', division: 'NORTH' },
  GB: { name: 'Green Bay Packers', conference: 'NFC', division: 'NORTH' },
  HOU: { name: 'Houston Texans', conference: 'AFC', division: 'SOUTH' },
  IND: { name: 'Indianapolis Colts', conference: 'AFC', division: 'SOUTH' },
  JAX: { name: 'Jacksonville Jaguars', conference: 'AFC', division: 'SOUTH' },
  KC: { name: 'Kansas City Chiefs', conference: 'AFC', division: 'WEST' },
  LV: { name: 'Las Vegas Raiders', conference: 'AFC', division: 'WEST' },
  LAC: { name: 'Los Angeles Chargers', conference: 'AFC', division: 'WEST' },
  LAR: { name: 'Los Angeles Rams', conference: 'NFC', division: 'WEST' },
  MIA: { name: 'Miami Dolphins', conference: 'AFC', division: 'EAST' },
  MIN: { name: 'Minnesota Vikings', conference: 'NFC', division: 'NORTH' },
  NE: { name: 'New England Patriots', conference: 'AFC', division: 'EAST' },
  NO: { name: 'New Orleans Saints', conference: 'NFC', division: 'SOUTH' },
  NYG: { name: 'New York Giants', conference: 'NFC', division: 'EAST' },
  NYJ: { name: 'New York Jets', conference: 'AFC', division: 'EAST' },
  PHI: { name: 'Philadelphia Eagles', conference: 'NFC', division: 'EAST' },
  PIT: { name: 'Pittsburgh Steelers', conference: 'AFC', division: 'NORTH' },
  SF: { name: 'San Francisco 49ers', conference: 'NFC', division: 'WEST' },
  SEA: { name: 'Seattle Seahawks', conference: 'NFC', division: 'WEST' },
  TB: { name: 'Tampa Bay Buccaneers', conference: 'NFC', division: 'SOUTH' },
  TEN: { name: 'Tennessee Titans', conference: 'AFC', division: 'SOUTH' },
  WAS: { name: 'Washington Commanders', conference: 'NFC', division: 'EAST' },
} as const;

export type NFLTeamCode = keyof typeof NFL_TEAMS;
