// AI Service Module - Main Export
// Draft Vault AI Integration

// Export all types
export * from './types';

// Export the AI service
export { AIService, aiService, default } from './aiService';

// Re-export commonly used types for convenience
export type {
  AIConfig,
  AIProvider,
  AIMessage,
  AIResponse,
  AIError,
  AIResult,
  // Player Analysis
  PlayerAnalysisRequest,
  PlayerAnalysisResponse,
  PlayerComparison,
  RiskFactor,
  // Draft Recommendations
  DraftRecommendationRequest,
  DraftRecommendationResponse,
  DraftRecommendation,
  DraftSettings,
  DraftStrategy,
  PlayerSummary,
  RosterContext,
  // Trade Analysis
  TradeAnalysisRequest,
  TradeAnalysisResponse,
  LeagueSettings,
  // Chat
  ChatRequest,
  ChatResponse,
  ChatAction,
  DraftState,
  // Rookie Scouting
  RookieScoutRequest,
  RookieScoutResponse,
  CombineMetrics,
  DraftCapital,
  LandingSpot,
  // Waiver Wire
  WaiverAnalysisRequest,
  WaiverAnalysisResponse,
  WaiverRecommendation,
  // Matchup Analysis
  MatchupAnalysisRequest,
  MatchupAnalysisResponse,
  KeyMatchup,
  StartSitAdvice,
  // Natural Language
  NLQueryRequest,
  NLQueryResponse,
  // Feature Flags
  AIFeatureFlags,
} from './types';
