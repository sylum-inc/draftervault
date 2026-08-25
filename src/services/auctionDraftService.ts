// Premium Fantasy Football Auction Draft Service with Comprehensive Real Data Analytics
export interface Player {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  team: string;
  tier: 1 | 2 | 3 | 4;
  baseValue: number;
  estimatedValue: number;
  projectedPoints: number;
  adp: number; // Average Draft Position
  injuryRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  strengthOfSchedule: number; // 1-10 scale
  valueOverReplacement: number; // VORP
  upside: number; // Ceiling projection
  floor: number; // Floor projection
  consistency: number; // Week-to-wave variance (1-10)
  byeWeek: number;
  ageRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  targetShare: number; // Expected target/touch share %
  redZoneShare: number; // Red zone opportunity %
  // Enhanced real data fields
  age: number;
  experience: number; // Years in NFL
  lastSeasonGames: number;
  careerGames: number;
  injuryHistory: string[]; // List of past injuries
  contractStatus: 'SECURE' | 'EXPIRING' | 'ROOKIE' | 'FRANCHISE_TAG';
  coachingStability: 'STABLE' | 'NEW_COACH' | 'NEW_SYSTEM';
  offensiveLineRank: number; // 1-32 team rank
  defensiveStrengthVsPosition: number; // Opponent strength vs position
  weatherConcerns: boolean; // Dome vs outdoor team
  playoffSchedule: 'EASY' | 'MODERATE' | 'DIFFICULT';
  handcuffValue: number; // Value if starter injured (0-100)
  primaryBackup?: string; // Name of primary backup
  competitionLevel: 'LOCKED_STARTER' | 'MINOR_COMPETITION' | 'TIMESHARE' | 'COMMITTEE';
  teamPaceRank: number; // Team pace ranking (1-32)
  redZoneTouchesLastSeason: number;
  snapPercentage: number; // Expected snap %
  recentTrends: 'RISING' | 'STABLE' | 'DECLINING';
  fantasyRelevantWeeks: number; // Weeks likely to be fantasy relevant
  floorWeeks: number; // Number of weeks hitting floor
  ceilingWeeks: number; // Number of weeks hitting ceiling
  isDrafted: boolean;
  draftedBy?: string;
  draftCost?: number;
  pickNumber?: number;
}

export type PlayerPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

/** Roster counts by position. Every draftable position needs a key here — a
 *  missing one turns `roster[position]++` into NaN and poisons depth scoring. */
export type RosterCounts = Record<PlayerPosition, number>;

export interface BidRejection {
  ok: false;
  /** Machine-readable so the UI can decide how loudly to complain. */
  code:
    | 'unknown-player'
    | 'unknown-team'
    | 'already-drafted'
    | 'invalid-amount'
    | 'insufficient-funds'
    | 'roster-full'
    | 'position-full';
  message: string;
}

export type BidCheck = { ok: true } | BidRejection;

export interface Team {
  id: string;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
  roster: RosterCounts;
  projectedTotal: number;
  strengthScore: number;
  riskScore: number;
  depthScore: number;
  injuryInsurance: number;
}

export interface DraftAnalytics {
  baseValue: number;
  adjustedValue: number;
  maxBid: number;
  openingBid: number;
  targetBid: number;
  walkAwayPoint: number;
  needMultiplier: number;
  scarcityFactor: number;
  confidenceLevel: number;
  marketInflation: number;
  regressionRisk: number;
  breakoutPotential: number;
  positionScarcity: number;
  valueOverBaseline: number;
  riskAdjustedValue: number;
  optimalBidRange: [number, number];
  // Enhanced analytics
  injuryAdjustment: number;
  ageAdjustment: number;
  contractSecurityScore: number;
  coachingStabilityScore: number;
  teamEnvironmentScore: number;
  competitionRisk: number;
  handcuffRecommendation: string;
  backupTargets: string[];
  idealDraftPosition: string;
  rosterId: string;
}

export interface DraftState {
  players: Player[];
  teams: Team[];
  draftedCount: number;
  totalPlayers: number;
  currentPick: number;
}

export interface SnakeDraftPlayer {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  team: string;
  tier: 1 | 2 | 3 | 4 | 5;
  baseValue: number;
  estimatedValue: number;
  projectedPoints: number;
  adp: number;
  injuryRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  strengthOfSchedule: number;
  valueOverReplacement: number;
  upside: number;
  floor: number;
  consistency: number;
  byeWeek: number;
  ageRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  targetShare: number;
  redZoneShare: number;
  age: number;
  experience: number;
  lastSeasonGames: number;
  careerGames: number;
  injuryHistory: string[];
  contractStatus: 'SECURE' | 'EXPIRING' | 'ROOKIE' | 'FRANCHISE_TAG';
  coachingStability: 'STABLE' | 'NEW_COACH' | 'NEW_SYSTEM';
  offensiveLineRank: number;
  defensiveStrengthVsPosition: number;
  weatherConcerns: boolean;
  playoffSchedule: 'EASY' | 'MODERATE' | 'DIFFICULT';
  handcuffValue: number;
  primaryBackup?: string;
  competitionLevel: 'LOCKED_STARTER' | 'MINOR_COMPETITION' | 'TIMESHARE' | 'COMMITTEE';
  teamPaceRank: number;
  redZoneTouchesLastSeason: number;
  snapPercentage: number;
  recentTrends: 'RISING' | 'STABLE' | 'DECLINING';
  fantasyRelevantWeeks: number;
  floorWeeks: number;
  ceilingWeeks: number;
  // Enhanced snake draft specific analytics
  breakoutPotential: number;
  regressionRisk: number;
  rookieProjection?: number;
  coachingFit: number;
  opportunityRank: number;
  depthChart: number;
  sleeper: boolean;
  bustRisk: number;
  weeklyVolatility: number;
  positionalScarcity: number;
  handcuffRecommendation: string;
  isDrafted: boolean;
  draftedBy?: string;
  pickNumber?: number;
}

/** Most a single team may carry at each position. */
const POSITION_LIMITS: RosterCounts = { QB: 3, RB: 6, WR: 7, TE: 3, K: 2, DST: 2 };

/** Roster size bounds for a twelve-team auction. */
const MAX_ROSTER_SIZE = 16;
const STARTING_LINEUP_SIZE = 9;

const EMPTY_ROSTER = (): RosterCounts => ({ QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });

const rosterSize = (roster: RosterCounts): number =>
  Object.values(roster).reduce((total, count) => total + count, 0);

export class AuctionDraftService {
  private players: Player[] = [];
  private teams: Team[] = [];
  private draftedCount = 0;
  /** Pick order, so the last one can be taken back. */
  private history: Array<{ playerId: string; teamId: string; cost: number }> = [];

  constructor() {
    this.initializePlayers();
    this.initializeTeams();
  }

  private initializePlayers(): void {
    // ALL 60 AUCTION PLAYERS - COMPLETE LIST
    this.players = [
      {
        id: '1',
        name: 'J. Chase',
        position: 'WR',
        team: 'CIN',
        tier: 1,
        baseValue: 65,
        estimatedValue: 68,
        projectedPoints: 315,
        adp: 3.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 4,
        valueOverReplacement: 145,
        upside: 365,
        floor: 280,
        consistency: 9,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 29,
        redZoneShare: 25,
        age: 24,
        experience: 4,
        lastSeasonGames: 16,
        careerGames: 63,
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 18,
        defensiveStrengthVsPosition: 6,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 8,
        redZoneTouchesLastSeason: 38,
        snapPercentage: 95,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 16,
        floorWeeks: 12,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '2',
        name: 'B. Robinson',
        position: 'RB',
        team: 'ATL',
        tier: 1,
        baseValue: 58,
        estimatedValue: 61,
        projectedPoints: 295,
        adp: 6.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 3,
        valueOverReplacement: 135,
        upside: 340,
        floor: 260,
        consistency: 8,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 22,
        redZoneShare: 42,
        age: 25,
        experience: 2,
        lastSeasonGames: 17,
        careerGames: 30,
        injuryHistory: ['Knee Sprain 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 8,
        defensiveStrengthVsPosition: 4,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 85,
        primaryBackup: 'Tyler Allgeier',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 5,
        redZoneTouchesLastSeason: 45,
        snapPercentage: 78,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 16,
        floorWeeks: 13,
        ceilingWeeks: 10,
        isDrafted: false,
      },
      {
        id: '3',
        name: 'C. Lamb',
        position: 'WR',
        team: 'DAL',
        tier: 1,
        baseValue: 62,
        estimatedValue: 65,
        projectedPoints: 305,
        adp: 4.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 5,
        valueOverReplacement: 142,
        upside: 350,
        floor: 275,
        consistency: 9,
        byeWeek: 7,
        ageRisk: 'LOW',
        targetShare: 31,
        redZoneShare: 23,
        age: 25,
        experience: 5,
        lastSeasonGames: 17,
        careerGames: 78,
        injuryHistory: ['Ankle 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 12,
        defensiveStrengthVsPosition: 7,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 14,
        redZoneTouchesLastSeason: 32,
        snapPercentage: 92,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 14,
        ceilingWeeks: 9,
        isDrafted: false,
      },
      {
        id: '4',
        name: 'J. Gibbs',
        position: 'RB',
        team: 'DET',
        tier: 1,
        baseValue: 55,
        estimatedValue: 58,
        projectedPoints: 285,
        adp: 8.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 128,
        upside: 330,
        floor: 250,
        consistency: 7,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 18,
        redZoneShare: 35,
        age: 22,
        experience: 2,
        lastSeasonGames: 15,
        careerGames: 29,
        injuryHistory: ['Hamstring 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 6,
        defensiveStrengthVsPosition: 5,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 70,
        primaryBackup: 'David Montgomery',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 3,
        redZoneTouchesLastSeason: 28,
        snapPercentage: 65,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 15,
        floorWeeks: 10,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '5',
        name: 'D. Achane',
        position: 'RB',
        team: 'MIA',
        tier: 1,
        baseValue: 52,
        estimatedValue: 55,
        projectedPoints: 275,
        adp: 12.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 6,
        valueOverReplacement: 120,
        upside: 325,
        floor: 235,
        consistency: 6,
        byeWeek: 6,
        ageRisk: 'LOW',
        targetShare: 15,
        redZoneShare: 28,
        age: 22,
        experience: 2,
        lastSeasonGames: 11,
        careerGames: 24,
        injuryHistory: ['Knee 2023', 'Concussion 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 22,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 65,
        primaryBackup: 'Raheem Mostert',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 1,
        redZoneTouchesLastSeason: 18,
        snapPercentage: 58,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 13,
        floorWeeks: 8,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '6',
        name: 'J. Jefferson',
        position: 'WR',
        team: 'MIN',
        tier: 1,
        baseValue: 68,
        estimatedValue: 71,
        projectedPoints: 325,
        adp: 2.1,
        injuryRisk: 'LOW',
        strengthOfSchedule: 5,
        valueOverReplacement: 152,
        upside: 375,
        floor: 290,
        consistency: 9,
        byeWeek: 6,
        ageRisk: 'LOW',
        targetShare: 32,
        redZoneShare: 27,
        age: 25,
        experience: 5,
        lastSeasonGames: 10,
        careerGames: 60,
        injuryHistory: ['Hamstring 2024'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 16,
        defensiveStrengthVsPosition: 9,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 11,
        redZoneTouchesLastSeason: 28,
        snapPercentage: 94,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 15,
        floorWeeks: 13,
        ceilingWeeks: 10,
        isDrafted: false,
      },
      {
        id: '7',
        name: 'S. Barkley',
        position: 'RB',
        team: 'PHI',
        tier: 1,
        baseValue: 60,
        estimatedValue: 63,
        projectedPoints: 290,
        adp: 5.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 3,
        valueOverReplacement: 132,
        upside: 335,
        floor: 255,
        consistency: 7,
        byeWeek: 5,
        ageRisk: 'MEDIUM',
        targetShare: 20,
        redZoneShare: 38,
        age: 27,
        experience: 7,
        lastSeasonGames: 16,
        careerGames: 81,
        injuryHistory: ['ACL 2020', 'Ankle 2021', 'Shoulder 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 5,
        defensiveStrengthVsPosition: 3,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 80,
        primaryBackup: 'Kenneth Gainwell',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 7,
        redZoneTouchesLastSeason: 42,
        snapPercentage: 75,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 12,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '8',
        name: 'C. McCaffrey',
        position: 'RB',
        team: 'SF',
        tier: 1,
        baseValue: 70,
        estimatedValue: 73,
        projectedPoints: 335,
        adp: 1.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 165,
        upside: 385,
        floor: 295,
        consistency: 8,
        byeWeek: 9,
        ageRisk: 'MEDIUM',
        targetShare: 25,
        redZoneShare: 45,
        age: 28,
        experience: 8,
        lastSeasonGames: 16,
        careerGames: 99,
        injuryHistory: ['Ankle 2020', 'Knee 2021', 'Calf 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 10,
        defensiveStrengthVsPosition: 6,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 90,
        primaryBackup: 'Jordan Mason',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 15,
        redZoneTouchesLastSeason: 52,
        snapPercentage: 85,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 14,
        ceilingWeeks: 12,
        isDrafted: false,
      },
      {
        id: '9',
        name: 'N. Collins',
        position: 'WR',
        team: 'HOU',
        tier: 1,
        baseValue: 48,
        estimatedValue: 51,
        projectedPoints: 265,
        adp: 15.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 115,
        upside: 310,
        floor: 230,
        consistency: 7,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 26,
        redZoneShare: 20,
        age: 22,
        experience: 2,
        lastSeasonGames: 15,
        careerGames: 30,
        injuryHistory: ['Calf 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 20,
        defensiveStrengthVsPosition: 11,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 4,
        redZoneTouchesLastSeason: 24,
        snapPercentage: 88,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 15,
        floorWeeks: 11,
        ceilingWeeks: 7,
        isDrafted: false,
      },
      {
        id: '10',
        name: 'M. Nabers',
        position: 'WR',
        team: 'NYG',
        tier: 1,
        baseValue: 45,
        estimatedValue: 48,
        projectedPoints: 255,
        adp: 18.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 7,
        valueOverReplacement: 108,
        upside: 300,
        floor: 220,
        consistency: 6,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 28,
        redZoneShare: 18,
        age: 21,
        experience: 1,
        lastSeasonGames: 13,
        careerGames: 13,
        injuryHistory: ['Concussion 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 28,
        defensiveStrengthVsPosition: 12,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 23,
        redZoneTouchesLastSeason: 16,
        snapPercentage: 85,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '11',
        name: 'P. Nuka',
        position: 'WR',
        team: 'LAR',
        tier: 2,
        baseValue: 50,
        estimatedValue: 53,
        projectedPoints: 270,
        adp: 11.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 4,
        valueOverReplacement: 118,
        upside: 315,
        floor: 235,
        consistency: 8,
        byeWeek: 6,
        ageRisk: 'LOW',
        targetShare: 30,
        redZoneShare: 22,
        age: 24,
        experience: 4,
        lastSeasonGames: 17,
        careerGames: 62,
        injuryHistory: ['Knee 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 9,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 12,
        redZoneTouchesLastSeason: 35,
        snapPercentage: 91,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 13,
        ceilingWeeks: 9,
        isDrafted: false,
      },
      {
        id: '12',
        name: 'A. Jeanty',
        position: 'RB',
        team: 'LV',
        tier: 2,
        baseValue: 42,
        estimatedValue: 45,
        projectedPoints: 245,
        adp: 22.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 7,
        valueOverReplacement: 95,
        upside: 285,
        floor: 210,
        consistency: 6,
        byeWeek: 10,
        ageRisk: 'LOW',
        targetShare: 24,
        redZoneShare: 32,
        age: 21,
        experience: 1,
        lastSeasonGames: 16,
        careerGames: 16,
        injuryHistory: [],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 25,
        defensiveStrengthVsPosition: 15,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 75,
        primaryBackup: 'Zamir White',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 19,
        redZoneTouchesLastSeason: 22,
        snapPercentage: 62,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 10,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '13',
        name: 'A. St Brown',
        position: 'WR',
        team: 'DET',
        tier: 2,
        baseValue: 47,
        estimatedValue: 50,
        projectedPoints: 260,
        adp: 16.3,
        injuryRisk: 'LOW',
        strengthOfSchedule: 4,
        valueOverReplacement: 112,
        upside: 300,
        floor: 225,
        consistency: 8,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 27,
        redZoneShare: 21,
        age: 25,
        experience: 4,
        lastSeasonGames: 16,
        careerGames: 60,
        injuryHistory: ['Ankle 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 6,
        defensiveStrengthVsPosition: 5,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 3,
        redZoneTouchesLastSeason: 29,
        snapPercentage: 89,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 12,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '14',
        name: 'B. Thomas',
        position: 'WR',
        team: 'JAC',
        tier: 2,
        baseValue: 44,
        estimatedValue: 47,
        projectedPoints: 250,
        adp: 19.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 5,
        valueOverReplacement: 105,
        upside: 290,
        floor: 215,
        consistency: 7,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 29,
        redZoneShare: 19,
        age: 22,
        experience: 2,
        lastSeasonGames: 14,
        careerGames: 28,
        injuryHistory: ['Hamstring 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 26,
        defensiveStrengthVsPosition: 11,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 16,
        redZoneTouchesLastSeason: 21,
        snapPercentage: 86,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 15,
        floorWeeks: 10,
        ceilingWeeks: 7,
        isDrafted: false,
      },
      {
        id: '15',
        name: 'A.J. Brown',
        position: 'WR',
        team: 'PHI',
        tier: 2,
        baseValue: 46,
        estimatedValue: 49,
        projectedPoints: 255,
        adp: 17.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 3,
        valueOverReplacement: 110,
        upside: 295,
        floor: 220,
        consistency: 7,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 26,
        redZoneShare: 24,
        age: 27,
        experience: 6,
        lastSeasonGames: 16,
        careerGames: 82,
        injuryHistory: ['Knee 2024', 'Hamstring 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 5,
        defensiveStrengthVsPosition: 3,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 7,
        redZoneTouchesLastSeason: 31,
        snapPercentage: 87,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 15,
        floorWeeks: 11,
        ceilingWeeks: 7,
        isDrafted: false,
      },
      {
        id: '16',
        name: 'D. Henry',
        position: 'RB',
        team: 'BAL',
        tier: 2,
        baseValue: 43,
        estimatedValue: 46,
        projectedPoints: 240,
        adp: 21.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 5,
        valueOverReplacement: 98,
        upside: 280,
        floor: 205,
        consistency: 7,
        byeWeek: 14,
        ageRisk: 'HIGH',
        targetShare: 20,
        redZoneShare: 35,
        age: 30,
        experience: 8,
        lastSeasonGames: 17,
        careerGames: 118,
        injuryHistory: ['Foot 2021'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 7,
        defensiveStrengthVsPosition: 9,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 70,
        primaryBackup: 'Justice Hill',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 20,
        redZoneTouchesLastSeason: 38,
        snapPercentage: 65,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 15,
        floorWeeks: 11,
        ceilingWeeks: 7,
        isDrafted: false,
      },
      {
        id: '17',
        name: 'J. Jacobs',
        position: 'RB',
        team: 'GB',
        tier: 2,
        baseValue: 41,
        estimatedValue: 44,
        projectedPoints: 235,
        adp: 23.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 6,
        valueOverReplacement: 92,
        upside: 275,
        floor: 200,
        consistency: 6,
        byeWeek: 10,
        ageRisk: 'LOW',
        targetShare: 19,
        redZoneShare: 33,
        age: 26,
        experience: 5,
        lastSeasonGames: 17,
        careerGames: 65,
        injuryHistory: ['Oblique 2023', 'Quad 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 11,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 60,
        primaryBackup: 'AJ Dillon',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 21,
        redZoneTouchesLastSeason: 35,
        snapPercentage: 70,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 15,
        floorWeeks: 10,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '18',
        name: 'B. Bowers',
        position: 'TE',
        team: 'LV',
        tier: 2,
        baseValue: 38,
        estimatedValue: 41,
        projectedPoints: 220,
        adp: 26.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 7,
        valueOverReplacement: 95,
        upside: 260,
        floor: 185,
        consistency: 6,
        byeWeek: 10,
        ageRisk: 'LOW',
        targetShare: 20,
        redZoneShare: 22,
        age: 22,
        experience: 1,
        lastSeasonGames: 16,
        careerGames: 16,
        injuryHistory: [],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 25,
        defensiveStrengthVsPosition: 15,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 19,
        redZoneTouchesLastSeason: 18,
        snapPercentage: 75,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 15,
        floorWeeks: 10,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '19',
        name: 'D. London',
        position: 'WR',
        team: 'ATL',
        tier: 2,
        baseValue: 40,
        estimatedValue: 43,
        projectedPoints: 230,
        adp: 25.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 3,
        valueOverReplacement: 88,
        upside: 270,
        floor: 195,
        consistency: 6,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 24,
        redZoneShare: 17,
        age: 23,
        experience: 3,
        lastSeasonGames: 15,
        careerGames: 43,
        injuryHistory: ['Groin 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 8,
        defensiveStrengthVsPosition: 4,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 5,
        redZoneTouchesLastSeason: 23,
        snapPercentage: 84,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '20',
        name: 'C. Brown',
        position: 'RB',
        team: 'CIN',
        tier: 2,
        baseValue: 39,
        estimatedValue: 42,
        projectedPoints: 225,
        adp: 27.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 85,
        upside: 265,
        floor: 190,
        consistency: 6,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 17,
        redZoneShare: 30,
        age: 24,
        experience: 3,
        lastSeasonGames: 16,
        careerGames: 46,
        injuryHistory: ['Ankle 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 18,
        defensiveStrengthVsPosition: 6,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 55,
        primaryBackup: 'Zack Moss',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 8,
        redZoneTouchesLastSeason: 28,
        snapPercentage: 68,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '21',
        name: 'B. Irving',
        position: 'RB',
        team: 'TB',
        tier: 3,
        baseValue: 36,
        estimatedValue: 39,
        projectedPoints: 215,
        adp: 30.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 4,
        valueOverReplacement: 78,
        upside: 255,
        floor: 180,
        consistency: 5,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 16,
        redZoneShare: 28,
        age: 22,
        experience: 1,
        lastSeasonGames: 14,
        careerGames: 14,
        injuryHistory: [],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 15,
        defensiveStrengthVsPosition: 7,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 50,
        primaryBackup: 'Rachaad White',
        competitionLevel: 'TIMESHARE',
        teamPaceRank: 6,
        redZoneTouchesLastSeason: 15,
        snapPercentage: 55,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 13,
        floorWeeks: 8,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '22',
        name: 'K. Williams',
        position: 'RB',
        team: 'LAR',
        tier: 3,
        baseValue: 37,
        estimatedValue: 40,
        projectedPoints: 220,
        adp: 29.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 82,
        upside: 260,
        floor: 185,
        consistency: 6,
        byeWeek: 6,
        ageRisk: 'LOW',
        targetShare: 18,
        redZoneShare: 31,
        age: 24,
        experience: 3,
        lastSeasonGames: 12,
        careerGames: 42,
        injuryHistory: ['Ankle 2024', 'Back 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 9,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 65,
        primaryBackup: 'Blake Corum',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 12,
        redZoneTouchesLastSeason: 25,
        snapPercentage: 72,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '23',
        name: 'J. Taylor',
        position: 'RB',
        team: 'IND',
        tier: 3,
        baseValue: 35,
        estimatedValue: 38,
        projectedPoints: 210,
        adp: 32.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 5,
        valueOverReplacement: 75,
        upside: 250,
        floor: 175,
        consistency: 5,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 19,
        redZoneShare: 29,
        age: 25,
        experience: 5,
        lastSeasonGames: 10,
        careerGames: 66,
        injuryHistory: ['Ankle 2024', 'Toe 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 17,
        defensiveStrengthVsPosition: 10,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 60,
        primaryBackup: 'Trey Sermon',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 24,
        redZoneTouchesLastSeason: 22,
        snapPercentage: 70,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 12,
        floorWeeks: 7,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '24',
        name: 'T. McBride',
        position: 'TE',
        team: 'AZ',
        tier: 3,
        baseValue: 32,
        estimatedValue: 35,
        projectedPoints: 190,
        adp: 38.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 65,
        upside: 230,
        floor: 155,
        consistency: 6,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 18,
        redZoneShare: 20,
        age: 25,
        experience: 3,
        lastSeasonGames: 17,
        careerGames: 45,
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 21,
        defensiveStrengthVsPosition: 12,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 9,
        redZoneTouchesLastSeason: 16,
        snapPercentage: 78,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '25',
        name: 'T. Higgins',
        position: 'WR',
        team: 'CIN',
        tier: 3,
        baseValue: 38,
        estimatedValue: 41,
        projectedPoints: 235,
        adp: 31.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 85,
        upside: 285,
        floor: 190,
        consistency: 7,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 22,
        redZoneShare: 18,
        age: 25,
        experience: 5,
        lastSeasonGames: 12,
        careerGames: 55,
        injuryHistory: ['Hamstring 2024', 'Rib 2023'],
        contractStatus: 'EXPIRING',
        coachingStability: 'STABLE',
        offensiveLineRank: 18,
        defensiveStrengthVsPosition: 6,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 8,
        redZoneTouchesLastSeason: 26,
        snapPercentage: 88,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 14,
        floorWeeks: 10,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '26',
        name: 'L. McConkey',
        position: 'WR',
        team: 'LAC',
        tier: 3,
        baseValue: 34,
        estimatedValue: 37,
        projectedPoints: 205,
        adp: 35.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 7,
        valueOverReplacement: 72,
        upside: 245,
        floor: 170,
        consistency: 6,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 24,
        redZoneShare: 15,
        age: 22,
        experience: 1,
        lastSeasonGames: 13,
        careerGames: 13,
        injuryHistory: ['Hip 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 13,
        defensiveStrengthVsPosition: 13,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 22,
        redZoneTouchesLastSeason: 12,
        snapPercentage: 82,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 13,
        floorWeeks: 8,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '27',
        name: 'J. Smith-Njigba',
        position: 'WR',
        team: 'SEA',
        tier: 3,
        baseValue: 36,
        estimatedValue: 39,
        projectedPoints: 215,
        adp: 33.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 78,
        upside: 255,
        floor: 180,
        consistency: 6,
        byeWeek: 10,
        ageRisk: 'LOW',
        targetShare: 23,
        redZoneShare: 16,
        age: 22,
        experience: 2,
        lastSeasonGames: 17,
        careerGames: 34,
        injuryHistory: ['Wrist 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 19,
        defensiveStrengthVsPosition: 11,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 17,
        redZoneTouchesLastSeason: 18,
        snapPercentage: 85,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '28',
        name: 'L. Jackson',
        position: 'QB',
        team: 'BAL',
        tier: 2,
        baseValue: 42,
        estimatedValue: 45,
        projectedPoints: 260,
        adp: 28.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 5,
        valueOverReplacement: 85,
        upside: 300,
        floor: 220,
        consistency: 7,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 27,
        experience: 7,
        lastSeasonGames: 16,
        careerGames: 89,
        injuryHistory: ['Knee 2022', 'Ankle 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 7,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 90,
        primaryBackup: 'Josh Johnson',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 20,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 12,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '29',
        name: 'J. Allen',
        position: 'QB',
        team: 'BUF',
        tier: 2,
        baseValue: 44,
        estimatedValue: 47,
        projectedPoints: 275,
        adp: 24.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 92,
        upside: 320,
        floor: 235,
        consistency: 8,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 28,
        experience: 7,
        lastSeasonGames: 17,
        careerGames: 105,
        injuryHistory: ['Elbow 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 14,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 85,
        primaryBackup: 'Mitch Trubisky',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 13,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 14,
        ceilingWeeks: 10,
        isDrafted: false,
      },
      {
        id: '30',
        name: 'J. Daniels',
        position: 'QB',
        team: 'WAS',
        tier: 3,
        baseValue: 32,
        estimatedValue: 35,
        projectedPoints: 195,
        adp: 42.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 7,
        valueOverReplacement: 65,
        upside: 240,
        floor: 155,
        consistency: 5,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 24,
        experience: 1,
        lastSeasonGames: 12,
        careerGames: 12,
        injuryHistory: ['Rib 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 23,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 80,
        primaryBackup: 'Marcus Mariota',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 10,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 13,
        floorWeeks: 8,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      // Continue with remaining players from your exact 60-player list...
      {
        id: '31',
        name: 'T. Hill',
        position: 'WR',
        team: 'MIA',
        tier: 3,
        baseValue: 40,
        estimatedValue: 43,
        projectedPoints: 245,
        adp: 30.1,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 92,
        upside: 295,
        floor: 205,
        consistency: 8,
        byeWeek: 6,
        ageRisk: 'MEDIUM',
        targetShare: 28,
        redZoneShare: 20,
        age: 30,
        experience: 9,
        lastSeasonGames: 16,
        careerGames: 133,
        injuryHistory: ['Thumb 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 22,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 1,
        redZoneTouchesLastSeason: 24,
        snapPercentage: 92,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 12,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '32',
        name: 'K. Walker III',
        position: 'RB',
        team: 'SEA',
        tier: 3,
        baseValue: 33,
        estimatedValue: 36,
        projectedPoints: 200,
        adp: 36.8,
        injuryRisk: 'HIGH',
        strengthOfSchedule: 6,
        valueOverReplacement: 68,
        upside: 245,
        floor: 160,
        consistency: 5,
        byeWeek: 10,
        ageRisk: 'LOW',
        targetShare: 17,
        redZoneShare: 27,
        age: 24,
        experience: 3,
        lastSeasonGames: 13,
        careerGames: 42,
        injuryHistory: ['Oblique 2024', 'Ankle 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 19,
        defensiveStrengthVsPosition: 11,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 70,
        primaryBackup: 'Zach Charbonnet',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 17,
        redZoneTouchesLastSeason: 20,
        snapPercentage: 65,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 12,
        floorWeeks: 7,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '33',
        name: 'D. Adams',
        position: 'WR',
        team: 'LV',
        tier: 3,
        baseValue: 30,
        estimatedValue: 33,
        projectedPoints: 185,
        adp: 44.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 7,
        valueOverReplacement: 58,
        upside: 225,
        floor: 150,
        consistency: 6,
        byeWeek: 10,
        ageRisk: 'HIGH',
        targetShare: 25,
        redZoneShare: 18,
        age: 32,
        experience: 11,
        lastSeasonGames: 17,
        careerGames: 154,
        injuryHistory: ['Hamstring 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 25,
        defensiveStrengthVsPosition: 15,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 19,
        redZoneTouchesLastSeason: 22,
        snapPercentage: 86,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '34',
        name: 'J. Cook',
        position: 'RB',
        team: 'BUF',
        tier: 3,
        baseValue: 35,
        estimatedValue: 38,
        projectedPoints: 210,
        adp: 34.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 6,
        valueOverReplacement: 75,
        upside: 250,
        floor: 175,
        consistency: 6,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 16,
        redZoneShare: 26,
        age: 25,
        experience: 3,
        lastSeasonGames: 15,
        careerGames: 42,
        injuryHistory: ['Toe 2024', 'Ankle 2022'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 14,
        defensiveStrengthVsPosition: 9,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 65,
        primaryBackup: 'Ty Johnson',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 13,
        redZoneTouchesLastSeason: 24,
        snapPercentage: 68,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '35',
        name: 'G. Kittle',
        position: 'TE',
        team: 'SF',
        tier: 3,
        baseValue: 34,
        estimatedValue: 37,
        projectedPoints: 200,
        adp: 36.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 70,
        upside: 240,
        floor: 165,
        consistency: 6,
        byeWeek: 9,
        ageRisk: 'MEDIUM',
        targetShare: 19,
        redZoneShare: 21,
        age: 31,
        experience: 8,
        lastSeasonGames: 15,
        careerGames: 100,
        injuryHistory: ['Groin 2024', 'Knee 2020'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 10,
        defensiveStrengthVsPosition: 6,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 15,
        redZoneTouchesLastSeason: 19,
        snapPercentage: 80,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 14,
        floorWeeks: 9,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      // Continue with remaining exact players to reach 60...
      {
        id: '36',
        name: 'C. Hubbard',
        position: 'RB',
        team: 'CAR',
        tier: 4,
        baseValue: 28,
        estimatedValue: 31,
        projectedPoints: 175,
        adp: 48.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 8,
        valueOverReplacement: 48,
        upside: 215,
        floor: 140,
        consistency: 5,
        byeWeek: 11,
        ageRisk: 'MEDIUM',
        targetShare: 20,
        redZoneShare: 24,
        age: 28,
        experience: 7,
        lastSeasonGames: 10,
        careerGames: 91,
        injuryHistory: ['Calf 2024', 'Ankle 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 32,
        defensiveStrengthVsPosition: 18,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 50,
        primaryBackup: 'Miles Sanders',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 32,
        redZoneTouchesLastSeason: 18,
        snapPercentage: 62,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 11,
        floorWeeks: 6,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '37',
        name: 'O. Hampton',
        position: 'RB',
        team: 'LAC',
        tier: 4,
        baseValue: 26,
        estimatedValue: 29,
        projectedPoints: 165,
        adp: 52.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 7,
        valueOverReplacement: 42,
        upside: 205,
        floor: 130,
        consistency: 5,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 18,
        redZoneShare: 22,
        age: 22,
        experience: 1,
        lastSeasonGames: 14,
        careerGames: 14,
        injuryHistory: [],
        contractStatus: 'ROOKIE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 13,
        defensiveStrengthVsPosition: 13,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 45,
        primaryBackup: 'Gus Edwards',
        competitionLevel: 'TIMESHARE',
        teamPaceRank: 22,
        redZoneTouchesLastSeason: 12,
        snapPercentage: 55,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 12,
        floorWeeks: 7,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '38',
        name: 'B. Hall',
        position: 'RB',
        team: 'NYJ',
        tier: 4,
        baseValue: 29,
        estimatedValue: 32,
        projectedPoints: 180,
        adp: 46.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 8,
        valueOverReplacement: 52,
        upside: 220,
        floor: 145,
        consistency: 5,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 19,
        redZoneShare: 25,
        age: 23,
        experience: 3,
        lastSeasonGames: 14,
        careerGames: 31,
        injuryHistory: ['Knee 2022', 'Ankle 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 27,
        defensiveStrengthVsPosition: 16,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 55,
        primaryBackup: 'Braelon Allen',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 30,
        redZoneTouchesLastSeason: 16,
        snapPercentage: 65,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 12,
        floorWeeks: 7,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '39',
        name: 'G. Wilson',
        position: 'WR',
        team: 'NYJ',
        tier: 4,
        baseValue: 31,
        estimatedValue: 34,
        projectedPoints: 190,
        adp: 43.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 8,
        valueOverReplacement: 62,
        upside: 230,
        floor: 155,
        consistency: 6,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 26,
        redZoneShare: 17,
        age: 24,
        experience: 3,
        lastSeasonGames: 11,
        careerGames: 40,
        injuryHistory: ['Concussion 2024'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 27,
        defensiveStrengthVsPosition: 16,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 30,
        redZoneTouchesLastSeason: 14,
        snapPercentage: 83,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 13,
        floorWeeks: 8,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '40',
        name: 'J. Burrow',
        position: 'QB',
        team: 'CIN',
        tier: 3,
        baseValue: 38,
        estimatedValue: 41,
        projectedPoints: 230,
        adp: 38.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 78,
        upside: 275,
        floor: 190,
        consistency: 7,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 28,
        experience: 5,
        lastSeasonGames: 17,
        careerGames: 57,
        injuryHistory: ['Wrist 2023', 'Appendix 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 18,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 85,
        primaryBackup: 'Jake Browning',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 8,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 15,
        floorWeeks: 11,
        ceilingWeeks: 7,
        isDrafted: false,
      },
      // Complete remaining 20 players from your exact list...
      {
        id: '41',
        name: 'A. Kamara',
        position: 'RB',
        team: 'NO',
        tier: 4,
        baseValue: 27,
        estimatedValue: 30,
        projectedPoints: 170,
        adp: 50.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 9,
        valueOverReplacement: 45,
        upside: 210,
        floor: 135,
        consistency: 5,
        byeWeek: 12,
        ageRisk: 'MEDIUM',
        targetShare: 21,
        redZoneShare: 23,
        age: 29,
        experience: 8,
        lastSeasonGames: 13,
        careerGames: 104,
        injuryHistory: ['Groin 2024', 'Rib 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 29,
        defensiveStrengthVsPosition: 17,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 60,
        primaryBackup: 'Jamaal Williams',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 26,
        redZoneTouchesLastSeason: 19,
        snapPercentage: 68,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 11,
        floorWeeks: 6,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '42',
        name: 'J. Hurts',
        position: 'QB',
        team: 'PHI',
        tier: 3,
        baseValue: 36,
        estimatedValue: 39,
        projectedPoints: 220,
        adp: 40.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 3,
        valueOverReplacement: 72,
        upside: 265,
        floor: 180,
        consistency: 6,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 26,
        experience: 5,
        lastSeasonGames: 15,
        careerGames: 77,
        injuryHistory: ['Finger 2024', 'Shoulder 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 5,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 80,
        primaryBackup: 'Kenny Pickett',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 7,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 14,
        floorWeeks: 10,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '43',
        name: 'T. Henderson',
        position: 'RB',
        team: 'NE',
        tier: 4,
        baseValue: 28,
        estimatedValue: 31,
        projectedPoints: 175,
        adp: 46.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 4,
        valueOverReplacement: 48,
        upside: 215,
        floor: 140,
        consistency: 7,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 20,
        redZoneShare: 32,
        age: 24,
        experience: 3,
        lastSeasonGames: 17,
        careerGames: 50,
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 18,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 70,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 12,
        redZoneTouchesLastSeason: 28,
        snapPercentage: 78,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 15,
        floorWeeks: 11,
        ceilingWeeks: 7,
        isDrafted: false,
      },
      {
        id: '44',
        name: 'DK. Metcalf',
        position: 'WR',
        team: 'PIT',
        tier: 4,
        baseValue: 27,
        estimatedValue: 30,
        projectedPoints: 165,
        adp: 48.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 3,
        valueOverReplacement: 42,
        upside: 205,
        floor: 130,
        consistency: 7,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 24,
        redZoneShare: 16,
        age: 25,
        experience: 4,
        lastSeasonGames: 17,
        careerGames: 68,
        injuryHistory: ['Hamstring 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 8,
        defensiveStrengthVsPosition: 4,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 5,
        redZoneTouchesLastSeason: 18,
        snapPercentage: 85,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 14,
        floorWeeks: 10,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '45',
        name: 'C. Sutton',
        position: 'WR',
        team: 'DEN',
        tier: 4,
        baseValue: 26,
        estimatedValue: 29,
        projectedPoints: 155,
        adp: 52.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 5,
        valueOverReplacement: 38,
        upside: 195,
        floor: 120,
        consistency: 6,
        byeWeek: 12,
        ageRisk: 'LOW',
        targetShare: 18,
        redZoneShare: 28,
        age: 25,
        experience: 3,
        lastSeasonGames: 16,
        careerGames: 45,
        injuryHistory: ['Foot 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 26,
        defensiveStrengthVsPosition: 11,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 65,
        primaryBackup: 'Tank Bigsby',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 16,
        redZoneTouchesLastSeason: 24,
        snapPercentage: 68,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 13,
        floorWeeks: 9,
        ceilingWeeks: 5,
        isDrafted: false,
      },
      {
        id: '46',
        name: 'M. Evans',
        position: 'WR',
        team: 'TB',
        tier: 4,
        baseValue: 25,
        estimatedValue: 28,
        projectedPoints: 148,
        adp: 55.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 35,
        upside: 188,
        floor: 115,
        consistency: 6,
        byeWeek: 11,
        ageRisk: 'HIGH',
        targetShare: 22,
        redZoneShare: 20,
        age: 31,
        experience: 11,
        lastSeasonGames: 13,
        careerGames: 158,
        injuryHistory: ['Hamstring 2024'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 15,
        defensiveStrengthVsPosition: 9,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 6,
        redZoneTouchesLastSeason: 22,
        snapPercentage: 82,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 12,
        floorWeeks: 8,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '47',
        name: 'J. Connor',
        position: 'RB',
        team: 'ARI',
        tier: 4,
        baseValue: 24,
        estimatedValue: 27,
        projectedPoints: 142,
        adp: 58.1,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 32,
        upside: 182,
        floor: 108,
        consistency: 5,
        byeWeek: 11,
        ageRisk: 'LOW',
        targetShare: 26,
        redZoneShare: 14,
        age: 28,
        experience: 7,
        lastSeasonGames: 17,
        careerGames: 105,
        injuryHistory: ['Ankle 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 28,
        defensiveStrengthVsPosition: 12,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 22,
        redZoneTouchesLastSeason: 16,
        snapPercentage: 88,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 13,
        floorWeeks: 9,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '48',
        name: 'M. Harrison Jr.',
        position: 'WR',
        team: 'ARI',
        tier: 4,
        baseValue: 23,
        estimatedValue: 26,
        projectedPoints: 138,
        adp: 61.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 30,
        upside: 175,
        floor: 105,
        consistency: 6,
        byeWeek: 5,
        ageRisk: 'MEDIUM',
        targetShare: 27,
        redZoneShare: 15,
        age: 30,
        experience: 7,
        lastSeasonGames: 17,
        careerGames: 76,
        injuryHistory: ['Suspension 2021-2022'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 30,
        defensiveStrengthVsPosition: 13,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 29,
        redZoneTouchesLastSeason: 14,
        snapPercentage: 88,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 12,
        floorWeeks: 8,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '49',
        name: 'X. Worthy',
        position: 'WR',
        team: 'KC',
        tier: 4,
        baseValue: 22,
        estimatedValue: 25,
        projectedPoints: 135,
        adp: 64.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 6,
        valueOverReplacement: 28,
        upside: 172,
        floor: 102,
        consistency: 6,
        byeWeek: 6,
        ageRisk: 'LOW',
        targetShare: 23,
        redZoneShare: 12,
        age: 25,
        experience: 4,
        lastSeasonGames: 16,
        careerGames: 51,
        injuryHistory: ['Concussion 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 22,
        defensiveStrengthVsPosition: 8,
        weatherConcerns: false,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 1,
        redZoneTouchesLastSeason: 12,
        snapPercentage: 82,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 11,
        floorWeeks: 7,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '50',
        name: 'T. McMillan',
        position: 'WR',
        team: 'CAR',
        tier: 4,
        baseValue: 21,
        estimatedValue: 24,
        projectedPoints: 132,
        adp: 67.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 7,
        valueOverReplacement: 26,
        upside: 168,
        floor: 98,
        consistency: 7,
        byeWeek: 10,
        ageRisk: 'MEDIUM',
        targetShare: 26,
        redZoneShare: 14,
        age: 30,
        experience: 9,
        lastSeasonGames: 15,
        careerGames: 123,
        injuryHistory: ['Ankle 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 19,
        defensiveStrengthVsPosition: 14,
        weatherConcerns: true,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 25,
        redZoneTouchesLastSeason: 13,
        snapPercentage: 86,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 12,
        floorWeeks: 8,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '51',
        name: 'RJ. Harvey',
        position: 'RB',
        team: 'DEN',
        tier: 4,
        baseValue: 20,
        estimatedValue: 23,
        projectedPoints: 128,
        adp: 70.5,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 6,
        valueOverReplacement: 24,
        upside: 165,
        floor: 95,
        consistency: 5,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 15,
        redZoneShare: 22,
        age: 27,
        experience: 5,
        lastSeasonGames: 16,
        careerGames: 73,
        injuryHistory: ['Ankle 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 30,
        defensiveStrengthVsPosition: 13,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 55,
        primaryBackup: 'Tyjae Spears',
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 29,
        redZoneTouchesLastSeason: 18,
        snapPercentage: 58,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 11,
        floorWeeks: 7,
        ceilingWeeks: 2,
        isDrafted: false,
      },
      {
        id: '52',
        name: 'DJ. Moore',
        position: 'WR',
        team: 'CHI',
        tier: 4,
        baseValue: 19,
        estimatedValue: 22,
        projectedPoints: 125,
        adp: 73.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 5,
        valueOverReplacement: 22,
        upside: 162,
        floor: 92,
        consistency: 6,
        byeWeek: 7,
        ageRisk: 'LOW',
        targetShare: 25,
        redZoneShare: 16,
        age: 27,
        experience: 6,
        lastSeasonGames: 17,
        careerGames: 84,
        injuryHistory: ['Ankle 2022'],
        contractStatus: 'SECURE',
        coachingStability: 'NEW_COACH',
        offensiveLineRank: 24,
        defensiveStrengthVsPosition: 10,
        weatherConcerns: true,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 28,
        redZoneTouchesLastSeason: 15,
        snapPercentage: 85,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 12,
        floorWeeks: 8,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '53',
        name: 'T. McLaurin',
        position: 'WR',
        team: 'WAS',
        tier: 4,
        baseValue: 18,
        estimatedValue: 21,
        projectedPoints: 122,
        adp: 76.2,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 5,
        valueOverReplacement: 45,
        upside: 158,
        floor: 88,
        consistency: 6,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 18,
        redZoneShare: 24,
        age: 29,
        experience: 7,
        lastSeasonGames: 10,
        careerGames: 95,
        injuryHistory: ['Ankle 2024', 'Knee 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 7,
        defensiveStrengthVsPosition: 15,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 20,
        redZoneTouchesLastSeason: 20,
        snapPercentage: 82,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 11,
        floorWeeks: 7,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '54',
        name: 'D. Swift',
        position: 'RB',
        team: 'CHI',
        tier: 4,
        baseValue: 17,
        estimatedValue: 20,
        projectedPoints: 118,
        adp: 79.5,
        injuryRisk: 'LOW',
        strengthOfSchedule: 5,
        valueOverReplacement: 42,
        upside: 155,
        floor: 85,
        consistency: 9,
        byeWeek: 10,
        ageRisk: 'HIGH',
        targetShare: 22,
        redZoneShare: 28,
        age: 35,
        experience: 12,
        lastSeasonGames: 16,
        careerGames: 159,
        injuryHistory: ['Knee 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 11,
        defensiveStrengthVsPosition: 18,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 18,
        redZoneTouchesLastSeason: 25,
        snapPercentage: 85,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 12,
        floorWeeks: 9,
        ceilingWeeks: 4,
        isDrafted: false,
      },
      {
        id: '55',
        name: 'J. Jeudy',
        position: 'WR',
        team: 'CLE',
        tier: 4,
        baseValue: 16,
        estimatedValue: 19,
        projectedPoints: 115,
        adp: 82.8,
        injuryRisk: 'HIGH',
        strengthOfSchedule: 7,
        valueOverReplacement: 18,
        upside: 152,
        floor: 82,
        consistency: 4,
        byeWeek: 10,
        ageRisk: 'MEDIUM',
        targetShare: 0,
        redZoneShare: 0,
        age: 29,
        experience: 7,
        lastSeasonGames: 6,
        careerGames: 84,
        injuryHistory: ['Shoulder 2024', 'Suspension 2022-2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 19,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: true,
        playoffSchedule: 'DIFFICULT',
        handcuffValue: 75,
        primaryBackup: 'Jameis Winston',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 25,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'DECLINING',
        fantasyRelevantWeeks: 10,
        floorWeeks: 6,
        ceilingWeeks: 2,
        isDrafted: false,
      },
      {
        id: '56',
        name: 'T. Pollard',
        position: 'RB',
        team: 'TEN',
        tier: 4,
        baseValue: 15,
        estimatedValue: 18,
        projectedPoints: 112,
        adp: 85.1,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 4,
        valueOverReplacement: 16,
        upside: 148,
        floor: 78,
        consistency: 5,
        byeWeek: 14,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 22,
        experience: 2,
        lastSeasonGames: 4,
        careerGames: 17,
        injuryHistory: ['Concussion 2024', 'Shoulder 2023'],
        contractStatus: 'ROOKIE',
        coachingStability: 'STABLE',
        offensiveLineRank: 14,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 80,
        primaryBackup: 'Joe Flacco',
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 15,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'RISING',
        fantasyRelevantWeeks: 11,
        floorWeeks: 7,
        ceilingWeeks: 3,
        isDrafted: false,
      },
      {
        id: '57',
        name: 'T. Hunter',
        position: 'WR',
        team: 'JAX',
        tier: 4,
        baseValue: 8,
        estimatedValue: 11,
        projectedPoints: 135,
        adp: 125.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 3,
        valueOverReplacement: 15,
        upside: 155,
        floor: 115,
        consistency: 8,
        byeWeek: 14,
        ageRisk: 'MEDIUM',
        targetShare: 0,
        redZoneShare: 0,
        age: 35,
        experience: 13,
        lastSeasonGames: 17,
        careerGames: 201,
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 7,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 20,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 17,
        floorWeeks: 15,
        ceilingWeeks: 8,
        isDrafted: false,
      },
      {
        id: '58',
        name: 'J. Williams',
        position: 'WR',
        team: 'DET',
        tier: 4,
        baseValue: 7,
        estimatedValue: 10,
        projectedPoints: 128,
        adp: 135.8,
        injuryRisk: 'LOW',
        strengthOfSchedule: 5,
        valueOverReplacement: 12,
        upside: 148,
        floor: 108,
        consistency: 7,
        byeWeek: 10,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 29,
        experience: 8,
        lastSeasonGames: 16,
        careerGames: 126,
        injuryHistory: ['Knee 2024'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 11,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 18,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 14,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '59',
        name: 'R. Rice',
        position: 'WR',
        team: 'KC',
        tier: 4,
        baseValue: 6,
        estimatedValue: 9,
        projectedPoints: 125,
        adp: 145.2,
        injuryRisk: 'LOW',
        strengthOfSchedule: 2,
        valueOverReplacement: 12,
        upside: 145,
        floor: 105,
        consistency: 7,
        byeWeek: 9,
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 0,
        experience: 0,
        lastSeasonGames: 17,
        careerGames: 17,
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 0,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: false,
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: 15,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 16,
        floorWeeks: 12,
        ceilingWeeks: 6,
        isDrafted: false,
      },
      {
        id: '60',
        name: 'D. Smith',
        position: 'WR',
        team: 'PHI',
        tier: 4,
        baseValue: 25,
        estimatedValue: 28,
        projectedPoints: 158,
        adp: 54.8,
        injuryRisk: 'MEDIUM',
        strengthOfSchedule: 3,
        valueOverReplacement: 35,
        upside: 198,
        floor: 122,
        consistency: 6,
        byeWeek: 5,
        ageRisk: 'LOW',
        targetShare: 21,
        redZoneShare: 15,
        age: 26,
        experience: 4,
        lastSeasonGames: 17,
        careerGames: 64,
        injuryHistory: ['Hamstring 2023'],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 5,
        defensiveStrengthVsPosition: 3,
        weatherConcerns: false,
        playoffSchedule: 'EASY',
        handcuffValue: 0,
        competitionLevel: 'MINOR_COMPETITION',
        teamPaceRank: 7,
        redZoneTouchesLastSeason: 13,
        snapPercentage: 80,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 12,
        floorWeeks: 7,
        ceilingWeeks: 4,
        isDrafted: false,
      },
    ];
  }

  private initializeTeams(): void {
    this.teams = Array.from({ length: 12 }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      budget: 200,
      spent: 0,
      remaining: 200,
      roster: EMPTY_ROSTER(),
      projectedTotal: 0,
      strengthScore: 0,
      riskScore: 0,
      depthScore: 0,
      injuryInsurance: 0,
    }));
  }

  /** A fresh array each call: callers compare references to detect changes. */
  getPlayers(): Player[] {
    return [...this.players];
  }

  getTeams(): Team[] {
    return [...this.teams];
  }

  getDraftState(): DraftState {
    return {
      players: [...this.players],
      teams: [...this.teams],
      draftedCount: this.draftedCount,
      totalPlayers: this.players.length,
      currentPick: this.draftedCount + 1,
    };
  }

  /**
   * Whether this bid is legal, and if not, why.
   *
   * Callers should run this before offering a bid so the reason can be shown;
   * draftPlayer enforces it again regardless.
   */
  validateBid(playerId: string, teamId: string, cost: number): BidCheck {
    const player = this.players.find((p) => p.id === playerId);
    if (!player)
      return { ok: false, code: 'unknown-player', message: 'That player is not in the pool.' };
    if (player.isDrafted) {
      const owner = this.teams.find((t) => t.id === player.draftedBy);
      return {
        ok: false,
        code: 'already-drafted',
        message: `${player.name} already went to ${owner?.name ?? 'another team'} for $${player.draftCost}.`,
      };
    }

    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return { ok: false, code: 'unknown-team', message: 'Pick a team first.' };

    // NaN fails every comparison, so it has to be rejected explicitly or it
    // sails through the budget check and turns the team's money into NaN.
    if (!Number.isInteger(cost) || cost < 1) {
      return {
        ok: false,
        code: 'invalid-amount',
        message: 'A bid must be a whole dollar amount of $1 or more.',
      };
    }

    const filled = rosterSize(team.roster);
    if (filled >= MAX_ROSTER_SIZE) {
      return {
        ok: false,
        code: 'roster-full',
        message: `${team.name} already has ${MAX_ROSTER_SIZE} players.`,
      };
    }
    if (team.roster[player.position] >= POSITION_LIMITS[player.position]) {
      return {
        ok: false,
        code: 'position-full',
        message: `${team.name} cannot carry more than ${POSITION_LIMITS[player.position]} at ${player.position}.`,
      };
    }

    // Every remaining starting slot still needs at least a dollar to fill.
    const slotsToFill = Math.max(0, STARTING_LINEUP_SIZE - filled - 1);
    const spendable = team.remaining - slotsToFill;
    if (cost > spendable) {
      return {
        ok: false,
        code: 'insufficient-funds',
        message:
          slotsToFill > 0
            ? `${team.name} can spend $${Math.max(0, spendable)} — $${slotsToFill} is held back for ${slotsToFill} open starting spot${slotsToFill === 1 ? '' : 's'}.`
            : `${team.name} only has $${team.remaining} left.`,
      };
    }

    return { ok: true };
  }

  draftPlayer(playerId: string, teamId: string, cost: number): boolean {
    if (!this.validateBid(playerId, teamId, cost).ok) return false;

    const player = this.players.find((p) => p.id === playerId)!;
    const team = this.teams.find((t) => t.id === teamId)!;

    player.isDrafted = true;
    player.draftedBy = teamId;
    player.draftCost = cost;
    player.pickNumber = this.draftedCount + 1;

    team.spent += cost;
    team.remaining -= cost;
    team.roster[player.position]++;
    team.projectedTotal += player.projectedPoints;

    this.draftedCount++;
    this.history.push({ playerId, teamId, cost });
    this.updateTeamMetrics(team);
    this.persist();

    return true;
  }

  /** Takes back the most recent pick. Returns the undone pick, or null. */
  undoLastPick(): { player: Player; team: Team; cost: number } | null {
    const last = this.history.pop();
    if (!last) return null;

    const player = this.players.find((p) => p.id === last.playerId);
    const team = this.teams.find((t) => t.id === last.teamId);
    if (!player || !team) return null;

    player.isDrafted = false;
    delete player.draftedBy;
    delete player.draftCost;
    delete player.pickNumber;

    team.spent -= last.cost;
    team.remaining += last.cost;
    team.roster[player.position] = Math.max(0, team.roster[player.position] - 1);
    team.projectedTotal -= player.projectedPoints;

    this.draftedCount = Math.max(0, this.draftedCount - 1);
    this.updateTeamMetrics(team);
    this.persist();

    return { player, team, cost: last.cost };
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  private updateTeamMetrics(team: Team): void {
    const teamPlayers = this.players.filter((p) => p.draftedBy === team.id);

    // Calculate strength score (average projected points)
    team.strengthScore =
      teamPlayers.length > 0
        ? teamPlayers.reduce((sum, p) => sum + p.projectedPoints, 0) / teamPlayers.length
        : 0;

    // Calculate risk score (average injury risk)
    const riskValues = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    team.riskScore =
      teamPlayers.length > 0
        ? teamPlayers.reduce((sum, p) => sum + riskValues[p.injuryRisk], 0) / teamPlayers.length
        : 0;

    // Calculate depth score (players beyond starting lineup). Every position
    // needs an entry: an undefined starter count makes the subtraction NaN.
    const startingPositions: RosterCounts = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 };
    team.depthScore = Object.entries(team.roster).reduce((total, [pos, count]) => {
      const starting = startingPositions[pos as PlayerPosition] ?? 0;
      return total + Math.max(0, count - starting);
    }, 0);

    // Calculate injury insurance (handcuff value)
    team.injuryInsurance = teamPlayers.reduce((sum, p) => sum + p.handcuffValue, 0) / 100;
  }

  generateDraftAnalytics(playerId: string, teamId: string): DraftAnalytics {
    const player = this.players.find((p) => p.id === playerId);
    const team = this.teams.find((t) => t.id === teamId);

    if (!player || !team) {
      throw new Error('Player or team not found');
    }

    const positionScarcity = this.calculatePositionScarcity(player.position);
    const needMultiplier = this.calculateNeedMultiplier(player.position, team);
    const marketInflation = this.calculateMarketInflation();

    const baseValue = player.baseValue;
    const scarcityAdjustment = positionScarcity * 0.1;
    const needAdjustment = (needMultiplier - 1) * 0.15;
    const inflationAdjustment = marketInflation * 0.05;

    const adjustedValue =
      baseValue * (1 + scarcityAdjustment + needAdjustment + inflationAdjustment);

    const riskAdjustment = this.calculateRiskAdjustment(player);
    const riskAdjustedValue = adjustedValue * (1 - riskAdjustment);

    const maxBid = Math.min(riskAdjustedValue * 1.2, team.remaining);
    const targetBid = riskAdjustedValue;
    const walkAwayPoint = Math.min(riskAdjustedValue * 1.1, maxBid * 0.95); // 110% of target or 95% of max, whichever is lower
    const openingBid = Math.max(1, Math.floor(targetBid * 0.7));

    return {
      baseValue,
      adjustedValue,
      maxBid,
      openingBid,
      targetBid,
      walkAwayPoint,
      needMultiplier,
      scarcityFactor: positionScarcity,
      confidenceLevel: this.calculateConfidenceLevel(player),
      marketInflation,
      regressionRisk: this.calculateRegressionRisk(player),
      breakoutPotential: this.calculateBreakoutPotential(player),
      positionScarcity,
      valueOverBaseline: player.valueOverReplacement,
      riskAdjustedValue,
      optimalBidRange: [walkAwayPoint, maxBid],
      injuryAdjustment: this.calculateInjuryAdjustment(player),
      ageAdjustment: this.calculateAgeAdjustment(player),
      contractSecurityScore: this.calculateContractSecurity(player),
      coachingStabilityScore: this.calculateCoachingStability(player),
      teamEnvironmentScore: this.calculateTeamEnvironment(player),
      competitionRisk: this.calculateCompetitionRisk(player),
      handcuffRecommendation: this.getHandcuffRecommendation(player),
      backupTargets: this.getBackupTargets(player),
      idealDraftPosition: this.getIdealDraftPosition(player, team),
      rosterId: team.id,
    };
  }

  private calculatePositionScarcity(position: string): number {
    const positionPlayers = this.players.filter((p) => p.position === position && !p.isDrafted);
    const totalPositionPlayers = this.players.filter((p) => p.position === position);
    return 1 - positionPlayers.length / totalPositionPlayers.length;
  }

  private calculateNeedMultiplier(position: string, team: Team): number {
    const positionCount = team.roster[position as keyof typeof team.roster];
    const positionNeeds = { QB: 2, RB: 4, WR: 4, TE: 2 };
    const maxNeed = positionNeeds[position as keyof typeof positionNeeds];

    if (positionCount === 0) return 1.5; // High need
    if (positionCount < maxNeed / 2) return 1.2; // Medium need
    if (positionCount < maxNeed) return 1.0; // Low need
    return 0.8; // Minimal need
  }

  private calculateMarketInflation(): number {
    const totalSpent = this.teams.reduce((sum, team) => sum + team.spent, 0);
    const totalBudget = this.teams.reduce((sum, team) => sum + 200, 0);
    const spentPercentage = totalSpent / totalBudget;

    // Inflation increases as more money is spent
    return Math.min(spentPercentage * 2, 1);
  }

  private calculateRiskAdjustment(player: Player): number {
    let risk = 0;

    // Injury risk
    const injuryRisk = { LOW: 0.05, MEDIUM: 0.1, HIGH: 0.2 };
    risk += injuryRisk[player.injuryRisk];

    // Age risk
    const ageRisk = { LOW: 0.02, MEDIUM: 0.08, HIGH: 0.15 };
    risk += ageRisk[player.ageRisk];

    // Consistency risk
    risk += (10 - player.consistency) * 0.01;

    return Math.min(risk, 0.3); // Cap at 30% risk adjustment
  }

  private calculateConfidenceLevel(player: Player): number {
    let confidence = 0.5; // Base confidence

    // Experience bonus
    confidence += Math.min(player.experience * 0.02, 0.1);

    // Games played bonus
    confidence += Math.min((player.lastSeasonGames / 17) * 0.1, 0.1);

    // Consistency bonus
    confidence += player.consistency * 0.03;

    // Reduce for injury history
    confidence -= player.injuryHistory.length * 0.02;

    return Math.max(0.2, Math.min(confidence, 0.9));
  }

  private calculateRegressionRisk(player: Player): number {
    let risk = 0.3; // Base regression risk

    // Age increases regression risk
    if (player.age > 30) risk += 0.2;
    else if (player.age > 28) risk += 0.1;

    // High previous performance increases risk
    if (player.projectedPoints > player.floor * 1.3) risk += 0.1;

    // Contract year reduces risk
    if (player.contractStatus === 'EXPIRING') risk -= 0.1;

    return Math.max(0.1, Math.min(risk, 0.7));
  }

  private calculateBreakoutPotential(player: Player): number {
    let potential = 0.2; // Base potential

    // Young players have higher potential
    if (player.age < 25) potential += 0.2;
    else if (player.age < 27) potential += 0.1;

    // Opportunity increases potential
    if (player.targetShare > 20) potential += 0.1;
    if (player.redZoneShare > 15) potential += 0.1;

    // Coaching stability helps
    if (player.coachingStability === 'STABLE') potential += 0.05;

    return Math.max(0.1, Math.min(potential, 0.6));
  }

  // Additional calculation methods...
  private calculateInjuryAdjustment(player: Player): number {
    const riskValues = { LOW: 0, MEDIUM: -0.05, HIGH: -0.15 };
    return riskValues[player.injuryRisk];
  }

  private calculateAgeAdjustment(player: Player): number {
    if (player.age < 25) return 0.05;
    if (player.age > 30) return -0.1;
    if (player.age > 32) return -0.2;
    return 0;
  }

  private calculateContractSecurity(player: Player): number {
    const securityScores = { SECURE: 0.9, ROOKIE: 0.8, FRANCHISE_TAG: 0.7, EXPIRING: 0.4 };
    return securityScores[player.contractStatus];
  }

  private calculateCoachingStability(player: Player): number {
    const stabilityScores = { STABLE: 0.9, NEW_COACH: 0.6, NEW_SYSTEM: 0.5 };
    return stabilityScores[player.coachingStability];
  }

  private calculateTeamEnvironment(player: Player): number {
    let score = 0.5;

    // Offensive line quality
    score += ((33 - player.offensiveLineRank) / 32) * 0.2;

    // Team pace
    score += ((33 - player.teamPaceRank) / 32) * 0.1;

    // Weather concerns
    if (player.weatherConcerns) score -= 0.1;

    return Math.max(0.2, Math.min(score, 0.9));
  }

  private calculateCompetitionRisk(player: Player): number {
    const competitionRisk = {
      LOCKED_STARTER: 0.1,
      MINOR_COMPETITION: 0.3,
      TIMESHARE: 0.6,
      COMMITTEE: 0.8,
    };
    return competitionRisk[player.competitionLevel];
  }

  private getHandcuffRecommendation(player: Player): string {
    return player.primaryBackup || 'None';
  }

  private getBackupTargets(player: Player): string[] {
    if (player.primaryBackup) {
      return [player.primaryBackup];
    }
    return [];
  }

  private getIdealDraftPosition(player: Player, team: Team): string {
    const positionNeed = this.calculateNeedMultiplier(player.position, team);

    if (positionNeed > 1.3) return 'Target Early';
    if (positionNeed > 1.1) return 'Good Value';
    if (positionNeed > 0.9) return 'Wait for Value';
    return 'Luxury Pick';
  }

  // Additional required methods for compatibility
  isDraftComplete(): boolean {
    return this.draftedCount >= 60;
  }

  searchPlayers(query: string): Player[] {
    if (!query) return this.players;
    return this.players.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.position.toLowerCase().includes(query.toLowerCase()) ||
        p.team.toLowerCase().includes(query.toLowerCase())
    );
  }

  getPlayerAnalytics(playerId: string, teamId: string = 'team-1'): DraftAnalytics {
    return this.generateDraftAnalytics(playerId, teamId);
  }

  getDraftedPlayers(): Player[] {
    return this.players.filter((p) => p.isDrafted);
  }

  getAvailablePlayers(): Player[] {
    return this.players.filter((p) => !p.isDrafted);
  }

  resetDraft(): void {
    this.players.forEach((p) => {
      p.isDrafted = false;
      delete p.draftedBy;
      delete p.draftCost;
      delete p.pickNumber;
    });
    this.draftedCount = 0;
    this.history = [];
    this.teams.forEach((team) => {
      team.spent = 0;
      team.remaining = team.budget;
      team.roster = EMPTY_ROSTER();
      team.projectedTotal = 0;
      // Derived metrics too: leaving these behind makes a reset draft report
      // the strength and risk of the roster it just threw away.
      team.strengthScore = 0;
      team.riskScore = 0;
      team.depthScore = 0;
      team.injuryInsurance = 0;
    });
    this.persist();
  }

  // -------------------------------------------------------------------------
  // persistence
  //
  // Only the picks are stored: replaying them rebuilds every derived number, so
  // a saved draft can never disagree with the current valuation logic.
  // -------------------------------------------------------------------------

  private persist(): void {
    try {
      if (!this.history.length) {
        localStorage.removeItem(AuctionDraftService.STORAGE_KEY);
        return;
      }
      localStorage.setItem(
        AuctionDraftService.STORAGE_KEY,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          budgets: this.teams.map((t) => ({ id: t.id, budget: t.budget })),
          picks: this.history,
        })
      );
    } catch {
      /* storage unavailable (private mode, quota) — the draft simply won't resume */
    }
  }

  /** Replays a saved draft. Returns how many picks were restored. */
  restore(): number {
    let saved: {
      version?: number;
      budgets?: Array<{ id: string; budget: number }>;
      picks?: Array<{ playerId: string; teamId: string; cost: number }>;
    } | null = null;
    try {
      const raw = localStorage.getItem(AuctionDraftService.STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      saved = null;
    }
    if (!saved?.picks?.length || saved.version !== 1) return 0;

    this.resetDraft();
    for (const { id, budget } of saved.budgets ?? []) this.updateTeamBudget(id, budget);

    let restored = 0;
    for (const pick of saved.picks) {
      if (this.draftPlayer(pick.playerId, pick.teamId, pick.cost)) restored++;
    }
    return restored;
  }

  /** Whether a resumable draft is sitting in storage. */
  static hasSavedDraft(): boolean {
    try {
      return !!localStorage.getItem(AuctionDraftService.STORAGE_KEY);
    } catch {
      return false;
    }
  }

  private static readonly STORAGE_KEY = 'draft-vault:auction-draft:v1';

  getHistory(): ReadonlyArray<{ playerId: string; teamId: string; cost: number }> {
    return this.history;
  }

  getValueGrade(estimatedValue: number, actualCost: number): string {
    const ratio = actualCost / estimatedValue;
    if (ratio <= 0.8) return 'A+';
    if (ratio <= 0.9) return 'A';
    if (ratio <= 1.0) return 'B+';
    if (ratio <= 1.1) return 'B';
    if (ratio <= 1.2) return 'C';
    return 'D';
  }

  getProgressPercentage(): number {
    return (this.draftedCount / 60) * 100;
  }

  updateTeamBudget(teamId: string, budget: number): void {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return;
    if (!Number.isFinite(budget)) return;
    // A budget below what the team already committed would leave it with
    // negative money to spend, so it cannot go under the amount already spent.
    team.budget = Math.max(team.spent, Math.round(budget));
    team.remaining = team.budget - team.spent;
  }

  getAuctionPlayers(): Player[] {
    return this.players;
  }

  getSnakeDraftPlayers(): SnakeDraftPlayer[] {
    // Return empty array since snake draft uses separate database
    return [];
  }
}
