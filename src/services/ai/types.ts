// AI Service Types and Interfaces
// Draft Vault AI Integration

// =============================================================================
// CORE AI TYPES
// =============================================================================

export type AIProvider = 'anthropic' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'error';
}

// =============================================================================
// PLAYER ANALYSIS TYPES
// =============================================================================

export interface PlayerAnalysisRequest {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  stats: Record<string, number | string>;
  context?: {
    leagueSettings?: LeagueSettings;
    rosterContext?: RosterContext;
    draftPosition?: number;
  };
}

export interface PlayerAnalysisResponse {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  outlook: {
    shortTerm: string; // This season
    longTerm: string; // Dynasty value
  };
  comparisons: PlayerComparison[];
  riskFactors: RiskFactor[];
  recommendedActions: string[];
  confidence: number; // 0-100
}

export interface PlayerComparison {
  playerName: string;
  similarity: number; // 0-100
  reason: string;
}

export interface RiskFactor {
  type: 'injury' | 'age' | 'situation' | 'competition' | 'scheme' | 'coaching';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// =============================================================================
// DRAFT RECOMMENDATION TYPES
// =============================================================================

export interface DraftRecommendationRequest {
  availablePlayers: PlayerSummary[];
  currentRoster: RosterContext;
  draftSettings: DraftSettings;
  currentPick: number;
  budget?: number; // For auction
  strategy?: DraftStrategy;
}

export interface PlayerSummary {
  id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  projectedPoints: number;
  value: number;
  tier: number;
}

export interface RosterContext {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;
  bench: number;
  totalSpots: number;
  filledSpots: number;
  positionNeeds: Record<string, number>;
  projectedPoints: number;
  strengthScore: number;
}

export interface DraftSettings {
  type: 'snake' | 'auction' | 'dynasty';
  teams: number;
  rounds: number;
  scoring: 'standard' | 'ppr' | 'half-ppr';
  rosterSize: number;
  positionLimits: Record<string, number>;
}

export interface DraftStrategy {
  name: string;
  description: string;
  priorities: string[];
  avoidPositions?: string[];
  targetRounds?: Record<string, number[]>;
}

export interface DraftRecommendation {
  player: PlayerSummary;
  score: number; // 0-100
  reasoning: string;
  valueAnalysis: string;
  rosterFit: string;
  riskAssessment: string;
  alternativeConsiderations: string[];
}

export interface DraftRecommendationResponse {
  topPicks: DraftRecommendation[];
  strategyAdvice: string;
  positionPriority: string[];
  marketAnalysis?: string; // For auction
  confidence: number;
}

// =============================================================================
// TRADE ANALYSIS TYPES
// =============================================================================

export interface TradeAnalysisRequest {
  giving: PlayerSummary[];
  receiving: PlayerSummary[];
  myRoster: RosterContext;
  leagueSettings: LeagueSettings;
  isDynasty?: boolean;
}

export interface LeagueSettings {
  teams: number;
  scoring: 'standard' | 'ppr' | 'half-ppr';
  rosterSize: number;
  playoffTeams: number;
  isDynasty: boolean;
  keeperCount?: number;
}

export interface TradeAnalysisResponse {
  verdict: 'accept' | 'reject' | 'negotiate';
  fairnessScore: number; // -100 to +100 (positive = good for you)
  analysis: {
    valueComparison: string;
    rosterImpact: string;
    shortTermOutlook: string;
    longTermOutlook: string;
  };
  counterOfferSuggestions?: string[];
  confidence: number;
}

// =============================================================================
// CHAT/ASSISTANT TYPES
// =============================================================================

export interface ChatRequest {
  message: string;
  context?: {
    currentView?: string;
    selectedPlayer?: PlayerSummary;
    draftState?: DraftState;
    userRoster?: RosterContext;
  };
  conversationHistory?: AIMessage[];
}

export interface DraftState {
  currentPick: number;
  totalPicks: number;
  round: number;
  isUserPick: boolean;
  remainingBudget?: number;
  timeRemaining?: number;
}

export interface ChatResponse {
  message: string;
  suggestions?: string[];
  actions?: ChatAction[];
  relatedPlayers?: PlayerSummary[];
}

export interface ChatAction {
  type: 'draft_player' | 'view_player' | 'compare_players' | 'analyze_trade' | 'show_rankings';
  label: string;
  payload: Record<string, unknown>;
}

// =============================================================================
// ROOKIE SCOUTING TYPES
// =============================================================================

export interface RookieScoutRequest {
  rookieId: string;
  name: string;
  position: string;
  college: string;
  combineMetrics?: CombineMetrics;
  collegeStats?: Record<string, number>;
  draftCapital?: DraftCapital;
  landingSpot?: LandingSpot;
}

export interface CombineMetrics {
  fortyYard?: number;
  vertical?: number;
  benchPress?: number;
  broadJump?: number;
  threeCone?: number;
  shuttle?: number;
  height?: string;
  weight?: number;
  armLength?: number;
  handSize?: number;
}

export interface DraftCapital {
  round: number;
  pick: number;
  overall: number;
}

export interface LandingSpot {
  team: string;
  depthChartPosition: number;
  competitionLevel: 'low' | 'medium' | 'high';
  offensiveScheme?: string;
  coachingStability: 'low' | 'medium' | 'high';
}

export interface RookieScoutResponse {
  overallGrade: number; // 0-100
  athleticProfile: {
    score: number;
    strengths: string[];
    concerns: string[];
    nflComparison?: string;
  };
  productionAnalysis: {
    score: number;
    highlights: string[];
    concerns: string[];
  };
  situationAnalysis: {
    score: number;
    pathToPlaying: string;
    timeline: string;
    upside: string;
    floor: string;
  };
  dynastyOutlook: {
    oneYear: number;
    threeYear: number;
    fiveYear: number;
    recommendation: string;
  };
  bestComparison: string;
  redFlags: string[];
  confidence: number;
}

// =============================================================================
// WAIVER WIRE / FREE AGENT TYPES
// =============================================================================

export interface WaiverAnalysisRequest {
  availablePlayers: PlayerSummary[];
  myRoster: RosterContext;
  leagueSettings: LeagueSettings;
  weekNumber: number;
  injuredPlayers?: string[];
  byeWeekTeams?: string[];
}

export interface WaiverRecommendation {
  player: PlayerSummary;
  priority: number; // 1 = highest
  faabBid?: number; // Suggested bid amount
  reasoning: string;
  rosterMove?: {
    drop: PlayerSummary;
    reason: string;
  };
  urgency: 'must-add' | 'high' | 'medium' | 'low';
}

export interface WaiverAnalysisResponse {
  recommendations: WaiverRecommendation[];
  trendingUp: PlayerSummary[];
  trendingDown: PlayerSummary[];
  weeklyAdvice: string;
  confidence: number;
}

// =============================================================================
// MATCHUP ANALYSIS TYPES
// =============================================================================

export interface MatchupAnalysisRequest {
  myRoster: RosterContext;
  opponentRoster: RosterContext;
  weekNumber: number;
  leagueSettings: LeagueSettings;
}

export interface MatchupAnalysisResponse {
  winProbability: number;
  projectedScore: {
    mine: number;
    opponent: number;
  };
  keyMatchups: KeyMatchup[];
  startSitAdvice: StartSitAdvice[];
  strategyAdvice: string;
  riskLevel: 'safe' | 'moderate' | 'risky';
  confidence: number;
}

export interface KeyMatchup {
  position: string;
  myPlayer: string;
  theirPlayer: string;
  advantage: 'mine' | 'theirs' | 'even';
  analysis: string;
}

export interface StartSitAdvice {
  player: PlayerSummary;
  recommendation: 'start' | 'sit' | 'flex';
  reasoning: string;
  confidence: number;
}

// =============================================================================
// NATURAL LANGUAGE QUERY TYPES
// =============================================================================

export interface NLQueryRequest {
  query: string;
  context?: {
    availablePlayers?: PlayerSummary[];
    userRoster?: RosterContext;
    draftState?: DraftState;
  };
}

export interface NLQueryResponse {
  answer: string;
  dataType: 'player' | 'comparison' | 'ranking' | 'analysis' | 'general';
  relatedData?: unknown;
  followUpQuestions?: string[];
  confidence: number;
}

// =============================================================================
// AI FEATURE FLAGS
// =============================================================================

export interface AIFeatureFlags {
  playerAnalysis: boolean;
  draftRecommendations: boolean;
  tradeAnalysis: boolean;
  chatAssistant: boolean;
  rookieScouting: boolean;
  waiverAnalysis: boolean;
  matchupAnalysis: boolean;
  naturalLanguageQueries: boolean;
  voiceCommands: boolean;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface AIError {
  code: 'rate_limit' | 'invalid_request' | 'api_error' | 'timeout' | 'auth_error';
  message: string;
  retryAfter?: number;
}

export type AIResult<T> = { success: true; data: T } | { success: false; error: AIError };
