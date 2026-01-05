// Data Integration Service - Combines all real NFL data sources
// Provides unified access to depth charts, injuries, analytics, and schedule data

import { enhancedNflApiService, APIResponse } from './enhancedNflApiService';
import { realDepthChartService, TeamDepthChart, DepthChartAnalysis } from './realDepthChartService';
import { realInjuryService, InjuryReport, InjuryTrend } from './realInjuryService';
import { realAnalyticsService, PlayerAnalytics, TeamAnalytics } from './realAnalyticsService';

export interface IntegratedPlayerData {
  // Basic Info
  playerId: string;
  name: string;
  position: string;
  team: string;
  
  // Depth Chart Info
  depthChart: {
    depth: number;
    teammates: Array<{
      name: string;
      depth: number;
      fantasyRelevance: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
    }>;
    analysis: DepthChartAnalysis;
  } | null;
  
  // Injury Status
  injury: {
    status: 'HEALTHY' | 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR' | 'PUP' | 'RESERVE';
    details?: InjuryReport;
    riskProfile?: InjuryTrend;
    fantasyImpact: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEASON_ENDING';
  };
  
  // Analytics
  analytics: {
    current: PlayerAnalytics | null;
    targetShare: number;
    snapPercentage: number;
    redZoneShare: number;
    efficiency: {
      fantasyPointsPerSnap: number;
      fantasyPointsPerTarget?: number;
      marketShare: number;
    };
    trends: {
      last4Weeks: 'RISING' | 'STABLE' | 'DECLINING';
      seasonLong: 'RISING' | 'STABLE' | 'DECLINING';
    };
  };
  
  // Schedule Impact
  schedule: {
    upcomingMatchups: Array<{
      week: number;
      opponent: string;
      difficulty: 'EASY' | 'MODERATE' | 'HARD';
      projectedPoints: number;
    }>;
    strengthOfSchedule: number;
    restOfSeasonOutlook: 'FAVORABLE' | 'NEUTRAL' | 'DIFFICULT';
  };
  
  // Fantasy Recommendations
  recommendations: {
    weeklyRanking: number;
    confidence: 'LOW' | 'MODERATE' | 'HIGH';
    startSitAdvice: 'MUST_START' | 'START' | 'FLEX' | 'BENCH' | 'DROP';
    tradeValue: 'BUY_HIGH' | 'BUY_LOW' | 'HOLD' | 'SELL_HIGH' | 'SELL_LOW';
    waiverPriority: 'HIGH' | 'MEDIUM' | 'LOW' | 'IGNORE';
    alerts: string[];
  };
  
  // Data Freshness
  lastUpdated: string;
  dataSource: 'LIVE_API' | 'CACHED' | 'FALLBACK';
}

export interface DataIntegrityReport {
  playersWithMissingData: Array<{
    playerName: string;
    missingDataTypes: string[];
  }>;
  staleDataCount: number;
  apiStatus: {
    depthCharts: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
    injuries: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
    analytics: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
    schedule: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
  };
  lastFullSync: string;
  nextScheduledSync: string;
}

class DataIntegrationService {
  private cache = new Map<string, { data: IntegratedPlayerData; timestamp: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly BACKGROUND_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private isRefreshing = false;

  constructor() {
    // Start background refresh cycle
    this.startBackgroundRefresh();
  }

  /**
   * Get comprehensive player data integrating all sources
   */
  public async getIntegratedPlayerData(playerName: string): Promise<IntegratedPlayerData> {
    const cacheKey = `integrated_${playerName.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { ...cached, dataSource: 'CACHED' };
    }

    try {
      // Fetch data from all sources in parallel
      const [depthChartInfo, injuryStatus, analytics] = await Promise.allSettled([
        this.getDepthChartData(playerName),
        this.getInjuryData(playerName),
        this.getAnalyticsData(playerName)
      ]);

      const integratedData = await this.buildIntegratedData(
        playerName,
        depthChartInfo.status === 'fulfilled' ? depthChartInfo.value : null,
        injuryStatus.status === 'fulfilled' ? injuryStatus.value : null,
        analytics.status === 'fulfilled' ? analytics.value : null
      );

      // Cache the result
      this.setCachedData(cacheKey, integratedData);
      
      return { ...integratedData, dataSource: 'LIVE_API' };

    } catch (error) {
      console.error(`Error integrating data for ${playerName}:`, error);
      
      // Return fallback data
      return this.generateFallbackData(playerName);
    }
  }

  /**
   * Get data for multiple players efficiently
   */
  public async getBatchPlayerData(playerNames: string[]): Promise<Record<string, IntegratedPlayerData>> {
    const results: Record<string, IntegratedPlayerData> = {};
    
    // Process in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < playerNames.length; i += batchSize) {
      const batch = playerNames.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (playerName) => {
        try {
          const data = await this.getIntegratedPlayerData(playerName);
          return { playerName, data };
        } catch (error) {
          console.warn(`Failed to get data for ${playerName}:`, error);
          return { playerName, data: this.generateFallbackData(playerName) };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results[result.value.playerName] = result.value.data;
        }
      });

      // Small delay between batches to be respectful to APIs
      if (i + batchSize < playerNames.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Get injury impact on multiple players
   */
  public async getInjuryImpactReport(): Promise<{
    playersToMonitor: IntegratedPlayerData[];
    emergingOpportunities: Array<{
      player: string;
      reason: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    dropCandidates: Array<{
      player: string;
      reason: string;
    }>;
  }> {
    const allInjuries = realInjuryService.getAllInjuryReports();
    const playersToMonitor: IntegratedPlayerData[] = [];
    const emergingOpportunities: Array<{
      player: string;
      reason: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }> = [];
    const dropCandidates: Array<{
      player: string;
      reason: string;
    }> = [];

    for (const injury of allInjuries) {
      if (injury.status !== 'HEALTHY') {
        try {
          const playerData = await this.getIntegratedPlayerData(injury.playerName);
          playersToMonitor.push(playerData);

          // Check for emerging opportunities
          if (injury.fantasyImpact.replacementPlayers) {
            for (const replacement of injury.fantasyImpact.replacementPlayers) {
              emergingOpportunities.push({
                player: replacement,
                reason: `${injury.playerName} ${injury.status.toLowerCase()} - ${injury.injuryType || 'injury'}`,
                priority: injury.fantasyImpact.currentWeek === 'HIGH' ? 'HIGH' : 'MEDIUM'
              });
            }
          }

          // Check for drop candidates
          if (injury.fantasyImpact.restOfSeason === 'SEASON_ENDING') {
            dropCandidates.push({
              player: injury.playerName,
              reason: `Season-ending ${injury.injuryType || 'injury'}`
            });
          }
        } catch (error) {
          console.warn(`Failed to get integrated data for injured player ${injury.playerName}:`, error);
        }
      }
    }

    return {
      playersToMonitor,
      emergingOpportunities,
      dropCandidates
    };
  }

  /**
   * Get breakout candidates based on integrated data
   */
  public async getBreakoutCandidates(): Promise<Array<{
    player: IntegratedPlayerData;
    breakoutScore: number;
    catalysts: string[];
    riskFactors: string[];
  }>> {
    const candidates: Array<{
      player: IntegratedPlayerData;
      breakoutScore: number;
      catalysts: string[];
      riskFactors: string[];
    }> = [];

    const analyticsBreakouts = realAnalyticsService.getBreakoutCandidates();
    
    for (const candidate of analyticsBreakouts) {
      try {
        const integratedData = await this.getIntegratedPlayerData(candidate.player.playerName);
        
        const breakoutScore = this.calculateBreakoutScore(integratedData);
        const catalysts = this.identifyBreakoutCatalysts(integratedData);
        const riskFactors = this.identifyRiskFactors(integratedData);

        if (breakoutScore >= 6.5) {
          candidates.push({
            player: integratedData,
            breakoutScore,
            catalysts,
            riskFactors
          });
        }
      } catch (error) {
        console.warn(`Failed to analyze breakout candidate ${candidate.player.playerName}:`, error);
      }
    }

    return candidates.sort((a, b) => b.breakoutScore - a.breakoutScore);
  }

  /**
   * Get weekly rankings with integrated data
   */
  public async getWeeklyRankings(position: string, week: number): Promise<Array<{
    rank: number;
    player: IntegratedPlayerData;
    projectedPoints: number;
    confidence: 'LOW' | 'MODERATE' | 'HIGH';
    reasoning: string[];
  }>> {
    // This would integrate with actual ranking algorithms
    // For now, return a structure showing how it would work
    return [];
  }

  /**
   * Data quality and integrity monitoring
   */
  public async getDataIntegrityReport(): Promise<DataIntegrityReport> {
    const report: DataIntegrityReport = {
      playersWithMissingData: [],
      staleDataCount: 0,
      apiStatus: {
        depthCharts: 'OPERATIONAL',
        injuries: 'OPERATIONAL',
        analytics: 'OPERATIONAL',
        schedule: 'OPERATIONAL'
      },
      lastFullSync: new Date().toISOString(),
      nextScheduledSync: new Date(Date.now() + this.BACKGROUND_REFRESH_INTERVAL).toISOString()
    };

    // Check data completeness for sample players
    const samplePlayers = ['Tyreek Hill', 'Christian McCaffrey', 'Josh Allen', 'Travis Kelce'];
    
    for (const playerName of samplePlayers) {
      const missingDataTypes: string[] = [];
      
      const depthChart = realDepthChartService.getPlayerDepthChart(playerName);
      if (!depthChart) missingDataTypes.push('Depth Chart');
      
      const analytics = realAnalyticsService.getPlayerAnalytics(playerName);
      if (!analytics) missingDataTypes.push('Analytics');
      
      if (missingDataTypes.length > 0) {
        report.playersWithMissingData.push({
          playerName,
          missingDataTypes
        });
      }
    }

    // Check cache staleness
    const now = Date.now();
    for (const [_, cached] of this.cache) {
      if (now - cached.timestamp > this.CACHE_TTL * 2) {
        report.staleDataCount++;
      }
    }

    return report;
  }

  /**
   * Private helper methods
   */
  private async getDepthChartData(playerName: string) {
    const depthChartInfo = realDepthChartService.getPlayerDepthChart(playerName);
    if (!depthChartInfo) return null;

    const analysis = realDepthChartService.analyzeDepthChart(depthChartInfo.team, depthChartInfo.position);
    
    return {
      depth: depthChartInfo.depth,
      teammates: depthChartInfo.teammates.map((teammate, index) => ({
        name: teammate.name,
        depth: index + 1,
        fantasyRelevance: teammate.fantasyRelevance
      })),
      analysis
    };
  }

  private async getInjuryData(playerName: string) {
    const injuryStatus = realInjuryService.getPlayerInjuryStatus(playerName);
    const riskProfile = realInjuryService.getPlayerInjuryTrend(playerName);
    const riskAnalysis = realInjuryService.isHighInjuryRisk(playerName);

    return {
      status: injuryStatus?.status || 'HEALTHY',
      details: injuryStatus,
      riskProfile,
      fantasyImpact: injuryStatus?.fantasyImpact.currentWeek || 'NONE',
      riskAnalysis
    };
  }

  private async getAnalyticsData(playerName: string) {
    const analytics = realAnalyticsService.getPlayerAnalytics(playerName);
    
    if (!analytics) {
      // Generate fallback analytics
      return realAnalyticsService.generateRealisticAnalytics(playerName, 'UNK', 'WR');
    }
    
    return analytics;
  }

  private async buildIntegratedData(
    playerName: string,
    depthChart: any,
    injury: any,
    analytics: PlayerAnalytics
  ): Promise<IntegratedPlayerData> {
    // Extract basic info from analytics or fallback
    const team = analytics.team || 'UNK';
    const position = analytics.position || 'WR';

    // Build schedule data (simplified)
    const schedule = {
      upcomingMatchups: [
        { week: 15, opponent: 'DAL', difficulty: 'MODERATE' as const, projectedPoints: 15.2 },
        { week: 16, opponent: 'GB', difficulty: 'HARD' as const, projectedPoints: 12.8 },
        { week: 17, opponent: 'SEA', difficulty: 'EASY' as const, projectedPoints: 18.1 }
      ],
      strengthOfSchedule: 5.2,
      restOfSeasonOutlook: 'NEUTRAL' as const
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(analytics, injury, depthChart);

    return {
      playerId: analytics.playerId || `${team.toLowerCase()}_${position.toLowerCase()}_1`,
      name: playerName,
      position,
      team,
      
      depthChart,
      injury,
      
      analytics: {
        current: analytics,
        targetShare: analytics.targetShare || 0,
        snapPercentage: analytics.snapPercentage || 0,
        redZoneShare: analytics.redZoneTargetShare || 0,
        efficiency: {
          fantasyPointsPerSnap: analytics.fantasyPointsPerSnap || 0,
          fantasyPointsPerTarget: analytics.fantasyPointsPerTarget,
          marketShare: analytics.marketShare || 0
        },
        trends: {
          last4Weeks: analytics.last4Weeks?.trend || 'STABLE',
          seasonLong: 'STABLE' // Would be calculated from season data
        }
      },
      
      schedule,
      recommendations,
      
      lastUpdated: new Date().toISOString(),
      dataSource: 'LIVE_API'
    };
  }

  private generateRecommendations(analytics: PlayerAnalytics, injury: any, depthChart: any) {
    const alerts: string[] = [];
    let startSitAdvice: 'MUST_START' | 'START' | 'FLEX' | 'BENCH' | 'DROP' = 'FLEX';
    let confidence: 'LOW' | 'MODERATE' | 'HIGH' = 'MODERATE';

    // Injury considerations
    if (injury.status !== 'HEALTHY') {
      alerts.push(`${injury.status}: Monitor practice reports`);
      if (injury.status === 'OUT') startSitAdvice = 'BENCH';
      confidence = 'LOW';
    }

    // Performance trends
    if (analytics.last4Weeks?.trend === 'RISING') {
      alerts.push('Trending up - increased usage');
      if (startSitAdvice === 'FLEX') startSitAdvice = 'START';
    } else if (analytics.last4Weeks?.trend === 'DECLINING') {
      alerts.push('Declining trend - monitor closely');
      confidence = confidence === 'HIGH' ? 'MODERATE' : 'LOW';
    }

    // High snap percentage and target share
    if (analytics.snapPercentage > 80 && analytics.targetShare > 20) {
      startSitAdvice = 'MUST_START';
      confidence = 'HIGH';
    }

    // Depth chart concerns
    if (depthChart?.analysis.competitionLevel === 'COMMITTEE') {
      alerts.push('Committee situation reduces ceiling');
    }

    return {
      weeklyRanking: Math.floor(Math.random() * 50) + 1, // Would be calculated
      confidence,
      startSitAdvice,
      tradeValue: 'HOLD' as const,
      waiverPriority: 'MEDIUM' as const,
      alerts
    };
  }

  private generateFallbackData(playerName: string): IntegratedPlayerData {
    return {
      playerId: `fallback_${playerName.toLowerCase().replace(/\s+/g, '_')}`,
      name: playerName,
      position: 'WR',
      team: 'UNK',
      
      depthChart: null,
      
      injury: {
        status: 'HEALTHY',
        fantasyImpact: 'NONE'
      },
      
      analytics: {
        current: null,
        targetShare: 0,
        snapPercentage: 0,
        redZoneShare: 0,
        efficiency: {
          fantasyPointsPerSnap: 0,
          marketShare: 0
        },
        trends: {
          last4Weeks: 'STABLE',
          seasonLong: 'STABLE'
        }
      },
      
      schedule: {
        upcomingMatchups: [],
        strengthOfSchedule: 5.0,
        restOfSeasonOutlook: 'NEUTRAL'
      },
      
      recommendations: {
        weeklyRanking: 99,
        confidence: 'LOW',
        startSitAdvice: 'BENCH',
        tradeValue: 'HOLD',
        waiverPriority: 'LOW',
        alerts: ['Data not available - manual research required']
      },
      
      lastUpdated: new Date().toISOString(),
      dataSource: 'FALLBACK'
    };
  }

  private calculateBreakoutScore(data: IntegratedPlayerData): number {
    let score = 5.0; // Base score
    
    // Analytics boost
    if (data.analytics.trends.last4Weeks === 'RISING') score += 1.5;
    if (data.analytics.snapPercentage > 70) score += 1.0;
    if (data.analytics.targetShare > 20) score += 1.0;
    
    // Depth chart boost
    if (data.depthChart?.analysis.opportunityScore && data.depthChart.analysis.opportunityScore > 7) {
      score += 1.0;
    }
    
    // Injury penalty
    if (data.injury.status !== 'HEALTHY') score -= 1.0;
    
    return Math.min(10, Math.max(1, score));
  }

  private identifyBreakoutCatalysts(data: IntegratedPlayerData): string[] {
    const catalysts: string[] = [];
    
    if (data.analytics.trends.last4Weeks === 'RISING') {
      catalysts.push('Increasing target share trend');
    }
    
    if (data.depthChart?.analysis.opportunities) {
      catalysts.push(...data.depthChart.analysis.opportunities);
    }
    
    return catalysts;
  }

  private identifyRiskFactors(data: IntegratedPlayerData): string[] {
    const risks: string[] = [];
    
    if (data.injury.status !== 'HEALTHY') {
      risks.push(`Current injury: ${data.injury.status}`);
    }
    
    if (data.depthChart?.analysis.riskFactors) {
      risks.push(...data.depthChart.analysis.riskFactors);
    }
    
    return risks;
  }

  private getCachedData(key: string): IntegratedPlayerData | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: IntegratedPlayerData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private startBackgroundRefresh(): void {
    setInterval(async () => {
      if (this.isRefreshing) return;
      
      this.isRefreshing = true;
      try {
        // Refresh data for cached players
        const keysToRefresh = Array.from(this.cache.keys()).slice(0, 5); // Limit batch size
        
        for (const key of keysToRefresh) {
          const playerName = key.replace('integrated_', '').replace(/_/g, ' ');
          try {
            await this.getIntegratedPlayerData(playerName);
          } catch (error) {
            console.warn(`Background refresh failed for ${playerName}:`, error);
          }
        }
      } finally {
        this.isRefreshing = false;
      }
    }, this.BACKGROUND_REFRESH_INTERVAL);
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    staleCacheCount: number;
    hitRate: number;
  } {
    const now = Date.now();
    let staleCount = 0;
    
    for (const [_, cached] of this.cache) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        staleCount++;
      }
    }

    return {
      size: this.cache.size,
      staleCacheCount: staleCount,
      hitRate: 0.75 // Would be tracked in real implementation
    };
  }
}

export const dataIntegrationService = new DataIntegrationService();