import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { aiService } from '@/services/ai';
import type {
  AIConfig,
  AIProvider,
  AIMessage,
  AIError,
  PlayerAnalysisRequest,
  PlayerAnalysisResponse,
  DraftRecommendationRequest,
  DraftRecommendationResponse,
  TradeAnalysisRequest,
  TradeAnalysisResponse,
  ChatRequest,
  ChatResponse,
  RookieScoutRequest,
  RookieScoutResponse,
  WaiverAnalysisRequest,
  WaiverAnalysisResponse,
  MatchupAnalysisRequest,
  MatchupAnalysisResponse,
  NLQueryRequest,
  NLQueryResponse,
  AIFeatureFlags,
} from '@/services/ai/types';

// =============================================================================
// AI STATE TYPES
// =============================================================================

interface AIState {
  isConfigured: boolean;
  isLoading: boolean;
  error: AIError | null;
  provider: AIProvider | null;
  lastRequestTime: number | null;
}

interface UseAIResult {
  // State
  state: AIState;
  isConfigured: boolean;
  isLoading: boolean;
  error: AIError | null;

  // Configuration
  configure: (config: AIConfig) => void;
  clearConfig: () => void;

  // Player Analysis
  analyzePlayer: (request: PlayerAnalysisRequest) => Promise<PlayerAnalysisResponse | null>;

  // Draft Recommendations
  getDraftRecommendations: (
    request: DraftRecommendationRequest
  ) => Promise<DraftRecommendationResponse | null>;

  // Trade Analysis
  analyzeTrade: (request: TradeAnalysisRequest) => Promise<TradeAnalysisResponse | null>;

  // Chat
  chat: (request: ChatRequest) => Promise<ChatResponse | null>;

  // Rookie Scouting
  scoutRookie: (request: RookieScoutRequest) => Promise<RookieScoutResponse | null>;

  // Waiver Analysis
  analyzeWaivers: (request: WaiverAnalysisRequest) => Promise<WaiverAnalysisResponse | null>;

  // Matchup Analysis
  analyzeMatchup: (request: MatchupAnalysisRequest) => Promise<MatchupAnalysisResponse | null>;

  // Natural Language Query
  query: (request: NLQueryRequest) => Promise<NLQueryResponse | null>;

  // Feature flags
  features: AIFeatureFlags;

  // Utilities
  clearError: () => void;
  getConversationHistory: () => AIMessage[];
  clearConversationHistory: () => void;
}

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

const STORAGE_KEYS = {
  CONFIG: 'draft-vault-ai-config',
  CONVERSATION: 'draft-vault-ai-conversation',
} as const;

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useAI(): UseAIResult {
  // State
  const [state, setState] = useState<AIState>({
    isConfigured: false,
    isLoading: false,
    error: null,
    provider: null,
    lastRequestTime: null,
  });

  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);

  // Load saved configuration on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (savedConfig) {
        const config: AIConfig = JSON.parse(savedConfig);
        aiService.configure(config);
        setState((prev) => ({
          ...prev,
          isConfigured: true,
          provider: config.provider,
        }));
      }

      const savedConversation = localStorage.getItem(STORAGE_KEYS.CONVERSATION);
      if (savedConversation) {
        setConversationHistory(JSON.parse(savedConversation));
      }
    } catch {
      // Ignore parse errors, start fresh
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Save conversation history when it changes
  useEffect(() => {
    if (conversationHistory.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CONVERSATION, JSON.stringify(conversationHistory));
    }
  }, [conversationHistory]);

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  const configure = useCallback((config: AIConfig) => {
    aiService.configure(config);
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    setState((prev) => ({
      ...prev,
      isConfigured: true,
      provider: config.provider,
      error: null,
    }));
  }, []);

  const clearConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    setState({
      isConfigured: false,
      isLoading: false,
      error: null,
      provider: null,
      lastRequestTime: null,
    });
  }, []);

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const handleError = useCallback((error: AIError) => {
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, error, isLoading: false }));
    }
  }, []);

  // =============================================================================
  // API WRAPPER
  // =============================================================================

  const wrapAPICall = useCallback(
    async <T>(
      apiCall: () => Promise<{ success: true; data: T } | { success: false; error: AIError }>
    ): Promise<T | null> => {
      if (!mountedRef.current) return null;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await apiCall();

        if (!mountedRef.current) return null;

        if (result.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            lastRequestTime: Date.now(),
          }));
          return result.data;
        } else {
          handleError(result.error);
          return null;
        }
      } catch (err) {
        if (mountedRef.current) {
          const error: AIError = {
            code: 'api_error',
            message: err instanceof Error ? err.message : 'Unknown error occurred',
          };
          handleError(error);
        }
        return null;
      }
    },
    [handleError]
  );

  // =============================================================================
  // AI METHODS
  // =============================================================================

  const analyzePlayer = useCallback(
    async (request: PlayerAnalysisRequest) => {
      return wrapAPICall(() => aiService.analyzePlayer(request));
    },
    [wrapAPICall]
  );

  const getDraftRecommendations = useCallback(
    async (request: DraftRecommendationRequest) => {
      return wrapAPICall(() => aiService.getDraftRecommendations(request));
    },
    [wrapAPICall]
  );

  const analyzeTrade = useCallback(
    async (request: TradeAnalysisRequest) => {
      return wrapAPICall(() => aiService.analyzeTrade(request));
    },
    [wrapAPICall]
  );

  const chat = useCallback(
    async (request: ChatRequest) => {
      // Add message to history
      const userMessage: AIMessage = {
        role: 'user',
        content: request.message,
      };

      const historyToSend = [...conversationHistory, userMessage];

      const result = await wrapAPICall(() =>
        aiService.chat({
          ...request,
          conversationHistory: historyToSend,
        })
      );

      if (result && mountedRef.current) {
        // Add both user and assistant messages to history
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: result.message,
        };
        setConversationHistory((prev) => [...prev, userMessage, assistantMessage]);
      }

      return result;
    },
    [wrapAPICall, conversationHistory]
  );

  const scoutRookie = useCallback(
    async (request: RookieScoutRequest) => {
      return wrapAPICall(() => aiService.scoutRookie(request));
    },
    [wrapAPICall]
  );

  const analyzeWaivers = useCallback(
    async (request: WaiverAnalysisRequest) => {
      return wrapAPICall(() => aiService.analyzeWaivers(request));
    },
    [wrapAPICall]
  );

  const analyzeMatchup = useCallback(
    async (request: MatchupAnalysisRequest) => {
      return wrapAPICall(() => aiService.analyzeMatchup(request));
    },
    [wrapAPICall]
  );

  const query = useCallback(
    async (request: NLQueryRequest) => {
      return wrapAPICall(() => aiService.query(request));
    },
    [wrapAPICall]
  );

  // =============================================================================
  // CONVERSATION MANAGEMENT
  // =============================================================================

  const getConversationHistory = useCallback(() => {
    return conversationHistory;
  }, [conversationHistory]);

  const clearConversationHistory = useCallback(() => {
    setConversationHistory([]);
    localStorage.removeItem(STORAGE_KEYS.CONVERSATION);
  }, []);

  // =============================================================================
  // FEATURE FLAGS
  // =============================================================================

  const features: AIFeatureFlags = {
    playerAnalysis: state.isConfigured,
    draftRecommendations: state.isConfigured,
    tradeAnalysis: state.isConfigured,
    chatAssistant: state.isConfigured,
    rookieScouting: state.isConfigured,
    waiverAnalysis: state.isConfigured,
    matchupAnalysis: state.isConfigured,
    naturalLanguageQueries: state.isConfigured,
    voiceCommands: false, // Not yet implemented
  };

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    state,
    isConfigured: state.isConfigured,
    isLoading: state.isLoading,
    error: state.error,
    configure,
    clearConfig,
    analyzePlayer,
    getDraftRecommendations,
    analyzeTrade,
    chat,
    scoutRookie,
    analyzeWaivers,
    analyzeMatchup,
    query,
    features,
    clearError,
    getConversationHistory,
    clearConversationHistory,
  };
}

// =============================================================================
// CONTEXT FOR GLOBAL AI STATE
// =============================================================================

const AIContext = createContext<UseAIResult | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const ai = useAI();
  return React.createElement(AIContext.Provider, { value: ai }, children);
}

export function useAIContext(): UseAIResult {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAIContext must be used within an AIProvider');
  }
  return context;
}

export default useAI;
