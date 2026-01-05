// AI Service - Core Implementation
// Connects to Claude/OpenAI for intelligent draft assistance

import type {
  AIConfig,
  AIMessage,
  AIResponse,
  AIResult,
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
} from './types';

// =============================================================================
// AI SERVICE CLASS
// =============================================================================

class AIService {
  private config: AIConfig | null = null;
  private conversationHistory: AIMessage[] = [];
  private rateLimitRemaining = 100;
  private rateLimitResetTime = 0;

  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  initialize(config: AIConfig): void {
    this.config = config;
    this.conversationHistory = [];
  }

  // Alias for initialize to match hook API
  configure(config: AIConfig): void {
    this.initialize(config);
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  getProvider(): string | null {
    return this.config?.provider ?? null;
  }

  // ---------------------------------------------------------------------------
  // CORE API CALL
  // ---------------------------------------------------------------------------

  private async callAPI(
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResult<AIResponse>> {
    if (!this.config) {
      return {
        success: false,
        error: { code: 'auth_error', message: 'AI service not configured' },
      };
    }

    // Rate limiting check
    if (this.rateLimitRemaining <= 0 && Date.now() < this.rateLimitResetTime) {
      return {
        success: false,
        error: {
          code: 'rate_limit',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((this.rateLimitResetTime - Date.now()) / 1000),
        },
      };
    }

    try {
      const fullMessages: AIMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      let response: Response;
      let result: AIResponse;

      if (this.config.provider === 'anthropic') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.config.model || 'claude-sonnet-4-20250514',
            max_tokens: this.config.maxTokens || 4096,
            temperature: this.config.temperature || 0.7,
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role === 'system' ? 'user' : m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            error: {
              code: response.status === 429 ? 'rate_limit' : 'api_error',
              message: errorData.error?.message || 'API request failed',
            },
          };
        }

        const data = await response.json();
        result = {
          content: data.content[0]?.text || '',
          usage: {
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0,
          },
          model: data.model,
          finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
        };
      } else {
        // OpenAI
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model || 'gpt-4-turbo-preview',
            max_tokens: this.config.maxTokens || 4096,
            temperature: this.config.temperature || 0.7,
            messages: fullMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            error: {
              code: response.status === 429 ? 'rate_limit' : 'api_error',
              message: errorData.error?.message || 'API request failed',
            },
          };
        }

        const data = await response.json();
        result = {
          content: data.choices[0]?.message?.content || '',
          usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
          },
          model: data.model,
          finishReason: data.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length',
        };
      }

      // Update rate limit tracking
      this.rateLimitRemaining--;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'api_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PLAYER ANALYSIS
  // ---------------------------------------------------------------------------

  async analyzePlayer(request: PlayerAnalysisRequest): Promise<AIResult<PlayerAnalysisResponse>> {
    const systemPrompt = `You are an expert fantasy football analyst with deep knowledge of NFL players, statistics, and fantasy value. Analyze players objectively and provide actionable insights.

Always respond in valid JSON format matching this structure:
{
  "summary": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "outlook": { "shortTerm": "string", "longTerm": "string" },
  "comparisons": [{ "playerName": "string", "similarity": number, "reason": "string" }],
  "riskFactors": [{ "type": "string", "severity": "string", "description": "string" }],
  "recommendedActions": ["string"],
  "confidence": number
}`;

    const userMessage = `Analyze this player for fantasy football:

Player: ${request.playerName}
Position: ${request.position}
Team: ${request.team}
Stats: ${JSON.stringify(request.stats, null, 2)}
${request.context?.leagueSettings ? `League: ${JSON.stringify(request.context.leagueSettings)}` : ''}
${request.context?.rosterContext ? `My Roster: ${JSON.stringify(request.context.rosterContext)}` : ''}

Provide a comprehensive analysis including strengths, weaknesses, outlook, comparisons to similar players, and risk factors.`;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as PlayerAnalysisResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: false,
        error: { code: 'api_error', message: 'Failed to parse AI response' },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // DRAFT RECOMMENDATIONS
  // ---------------------------------------------------------------------------

  async getDraftRecommendations(
    request: DraftRecommendationRequest
  ): Promise<AIResult<DraftRecommendationResponse>> {
    const systemPrompt = `You are an elite fantasy football draft strategist. Provide optimal pick recommendations based on value, roster needs, and draft position.

Always respond in valid JSON format matching this structure:
{
  "topPicks": [{
    "player": { "id": "string", "name": "string", "position": "string", "team": "string", "adp": number, "projectedPoints": number, "value": number, "tier": number },
    "score": number,
    "reasoning": "string",
    "valueAnalysis": "string",
    "rosterFit": "string",
    "riskAssessment": "string",
    "alternativeConsiderations": ["string"]
  }],
  "strategyAdvice": "string",
  "positionPriority": ["string"],
  "marketAnalysis": "string",
  "confidence": number
}`;

    const userMessage = `Draft Recommendation Request:

Current Pick: ${request.currentPick}
${request.budget ? `Remaining Budget: $${request.budget}` : ''}
Draft Type: ${request.draftSettings.type}
Scoring: ${request.draftSettings.scoring}
Teams: ${request.draftSettings.teams}

My Current Roster:
- QB: ${request.currentRoster.qb}
- RB: ${request.currentRoster.rb}
- WR: ${request.currentRoster.wr}
- TE: ${request.currentRoster.te}
Position Needs: ${JSON.stringify(request.currentRoster.positionNeeds)}

Top 15 Available Players:
${request.availablePlayers
  .slice(0, 15)
  .map((p) => `- ${p.name} (${p.position}, ${p.team}) - ADP: ${p.adp}, Proj: ${p.projectedPoints}`)
  .join('\n')}

${request.strategy ? `My Strategy: ${request.strategy.name} - ${request.strategy.description}` : ''}

Recommend the best 5 picks with detailed reasoning.`;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as DraftRecommendationResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: false,
        error: { code: 'api_error', message: 'Failed to parse AI response' },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // TRADE ANALYSIS
  // ---------------------------------------------------------------------------

  async analyzeTrade(request: TradeAnalysisRequest): Promise<AIResult<TradeAnalysisResponse>> {
    const systemPrompt = `You are an expert fantasy football trade analyst. Evaluate trades objectively considering value, roster impact, and league context.

Always respond in valid JSON format matching this structure:
{
  "verdict": "accept" | "reject" | "negotiate",
  "fairnessScore": number,
  "analysis": {
    "valueComparison": "string",
    "rosterImpact": "string",
    "shortTermOutlook": "string",
    "longTermOutlook": "string"
  },
  "counterOfferSuggestions": ["string"],
  "confidence": number
}`;

    const userMessage = `Analyze this trade:

GIVING:
${request.giving.map((p) => `- ${p.name} (${p.position}, ${p.team}) - Proj: ${p.projectedPoints}`).join('\n')}

RECEIVING:
${request.receiving.map((p) => `- ${p.name} (${p.position}, ${p.team}) - Proj: ${p.projectedPoints}`).join('\n')}

My Current Roster Context:
${JSON.stringify(request.myRoster, null, 2)}

League Settings:
- Teams: ${request.leagueSettings.teams}
- Scoring: ${request.leagueSettings.scoring}
- Dynasty: ${request.isDynasty ? 'Yes' : 'No'}

Should I accept, reject, or negotiate? Provide detailed analysis.`;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as TradeAnalysisResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: false,
        error: { code: 'api_error', message: 'Failed to parse AI response' },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // CHAT ASSISTANT
  // ---------------------------------------------------------------------------

  async chat(request: ChatRequest): Promise<AIResult<ChatResponse>> {
    const systemPrompt = `You are Draft Vault AI, an expert fantasy football assistant. Help users with draft strategy, player analysis, trade advice, and general fantasy questions.

Be conversational but concise. Provide actionable advice.

If you can suggest specific actions, include them in the "actions" array.
If there are related players to discuss, include them in "relatedPlayers".

Respond in valid JSON format:
{
  "message": "string",
  "suggestions": ["string"],
  "actions": [{ "type": "string", "label": "string", "payload": {} }],
  "relatedPlayers": []
}`;

    // Add conversation history
    const messages: AIMessage[] = [
      ...(request.conversationHistory || []),
      { role: 'user', content: request.message },
    ];

    // Add context if provided
    let contextInfo = '';
    if (request.context) {
      if (request.context.currentView) {
        contextInfo += `User is viewing: ${request.context.currentView}\n`;
      }
      if (request.context.selectedPlayer) {
        contextInfo += `Selected player: ${request.context.selectedPlayer.name}\n`;
      }
      if (request.context.draftState) {
        contextInfo += `Draft state: Pick ${request.context.draftState.currentPick}, Round ${request.context.draftState.round}\n`;
      }
    }

    if (contextInfo) {
      messages[messages.length - 1].content =
        `Context:\n${contextInfo}\n\nUser: ${request.message}`;
    }

    const result = await this.callAPI(messages, systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as ChatResponse;

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: request.message },
        { role: 'assistant', content: result.data.content }
      );

      // Keep history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return { success: true, data: parsed };
    } catch {
      // If not valid JSON, return as plain message
      return {
        success: true,
        data: {
          message: result.data.content,
          suggestions: [],
          actions: [],
          relatedPlayers: [],
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // ROOKIE SCOUTING
  // ---------------------------------------------------------------------------

  async scoutRookie(request: RookieScoutRequest): Promise<AIResult<RookieScoutResponse>> {
    const systemPrompt = `You are an NFL Draft and rookie scouting expert. Evaluate rookies for fantasy football based on athletic profile, college production, draft capital, and landing spot.

Always respond in valid JSON format matching the RookieScoutResponse structure.`;

    const userMessage = `Scout this rookie for fantasy football:

Name: ${request.name}
Position: ${request.position}
College: ${request.college}

Combine Metrics:
${request.combineMetrics ? JSON.stringify(request.combineMetrics, null, 2) : 'Not available'}

Draft Capital:
${request.draftCapital ? `Round ${request.draftCapital.round}, Pick ${request.draftCapital.pick} (Overall: ${request.draftCapital.overall})` : 'Not available'}

Landing Spot:
${request.landingSpot ? JSON.stringify(request.landingSpot, null, 2) : 'Not available'}

Provide comprehensive scouting report with dynasty outlook.`;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as RookieScoutResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: false,
        error: { code: 'api_error', message: 'Failed to parse AI response' },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // WAIVER WIRE ANALYSIS
  // ---------------------------------------------------------------------------

  async analyzeWaivers(request: WaiverAnalysisRequest): Promise<AIResult<WaiverAnalysisResponse>> {
    const systemPrompt = `You are a fantasy football waiver wire expert. Identify the best pickups based on opportunity, talent, and roster needs.

Always respond in valid JSON format matching the WaiverAnalysisResponse structure.`;

    const userMessage = `Analyze waiver wire for Week ${request.weekNumber}:

My Roster:
${JSON.stringify(request.myRoster, null, 2)}

Top Available Players:
${request.availablePlayers
  .slice(0, 20)
  .map((p) => `- ${p.name} (${p.position}, ${p.team}) - Proj: ${p.projectedPoints}`)
  .join('\n')}

${request.injuredPlayers?.length ? `Key Injuries: ${request.injuredPlayers.join(', ')}` : ''}
${request.byeWeekTeams?.length ? `Bye Week Teams: ${request.byeWeekTeams.join(', ')}` : ''}

Recommend top waiver pickups with FAAB bids if applicable.`;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as WaiverAnalysisResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: false,
        error: { code: 'api_error', message: 'Failed to parse AI response' },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // MATCHUP ANALYSIS
  // ---------------------------------------------------------------------------

  async analyzeMatchup(
    request: MatchupAnalysisRequest
  ): Promise<AIResult<MatchupAnalysisResponse>> {
    const systemPrompt = `You are a fantasy football matchup analyst. Evaluate weekly matchups and provide start/sit advice.

Always respond in valid JSON format matching the MatchupAnalysisResponse structure.`;

    const userMessage = `Analyze Week ${request.weekNumber} matchup:

My Team:
${JSON.stringify(request.myRoster, null, 2)}

Opponent:
${JSON.stringify(request.opponentRoster, null, 2)}

League: ${request.leagueSettings.teams} teams, ${request.leagueSettings.scoring} scoring

Provide win probability, key matchups, and start/sit advice.`;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as MatchupAnalysisResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: false,
        error: { code: 'api_error', message: 'Failed to parse AI response' },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // NATURAL LANGUAGE QUERIES
  // ---------------------------------------------------------------------------

  async query(request: NLQueryRequest): Promise<AIResult<NLQueryResponse>> {
    const systemPrompt = `You are Draft Vault AI. Answer fantasy football questions concisely and accurately.

For player questions, include relevant stats and analysis.
For comparisons, be objective and data-driven.
For strategy questions, consider league context.

Respond in JSON format:
{
  "answer": "string",
  "dataType": "player" | "comparison" | "ranking" | "analysis" | "general",
  "relatedData": null,
  "followUpQuestions": ["string"],
  "confidence": number
}`;

    let contextInfo = '';
    if (request.context) {
      if (request.context.userRoster) {
        contextInfo += `User's roster has ${request.context.userRoster.filledSpots} players.\n`;
      }
      if (request.context.draftState) {
        contextInfo += `Currently at pick ${request.context.draftState.currentPick}.\n`;
      }
    }

    const userMessage = contextInfo
      ? `Context: ${contextInfo}\n\nQuestion: ${request.query}`
      : request.query;

    const result = await this.callAPI([{ role: 'user', content: userMessage }], systemPrompt);

    if (!result.success) return result;

    try {
      const parsed = JSON.parse(result.data.content) as NLQueryResponse;
      return { success: true, data: parsed };
    } catch {
      return {
        success: true,
        data: {
          answer: result.data.content,
          dataType: 'general',
          relatedData: null,
          followUpQuestions: [],
          confidence: 70,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export the class for type inference and testing
export { AIService };

// Export singleton instance
export const aiService = new AIService();

export default aiService;
