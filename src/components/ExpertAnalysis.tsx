import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Crown, Brain, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Player, DraftAnalytics } from '@/services/auctionDraftService';

interface ExpertAnalysisProps {
  player: Player;
  analytics: DraftAnalytics;
  draftProgress: number;
  positionScarcity: number;
  marketTrends: {
    priceInflation: number;
    velocityTrend: 'UP' | 'DOWN' | 'STABLE';
    positionRuns: string[];
  };
}

export const ExpertAnalysis: React.FC<ExpertAnalysisProps> = ({ 
  player, 
  analytics, 
  draftProgress, 
  positionScarcity,
  marketTrends 
}) => {
  const getExpertRecommendation = () => {
    // Analysis based on real player data and performance metrics
    if (analytics.regressionRisk > 0.6) {
      return {
        action: 'AVOID',
        reasoning: `${player.name}: High regression risk based on historical performance and injury profile`,
        icon: AlertTriangle,
        color: 'text-red-500'
      };
    }
    
    if (analytics.breakoutPotential > 0.7 && player.tier >= 3) {
      return {
        action: 'TARGET',
        reasoning: `${player.name}: Strong breakout indicators - opportunity cost analysis favors selection`,
        icon: Zap,
        color: 'text-yellow-500'
      };
    }
    
    if (analytics.valueOverBaseline > 0.3) {
      return {
        action: 'PRIORITY',
        reasoning: `${player.name}: Significantly outperforms position baseline - elite value proposition`,
        icon: Crown,
        color: 'text-purple-500'
      };
    }
    
    if (positionScarcity > 0.7) {
      return {
        action: 'BID AGGRESSIVELY',
        reasoning: `${player.position} scarcity critical - ${player.name} represents limited remaining value`,
        icon: Target,
        color: 'text-orange-500'
      };
    }
    
    if (player.projectedPoints > 275 && player.consistency && player.consistency >= 7) {
      return {
        action: 'STRONG BUY',
        reasoning: `${player.name}: High floor/ceiling combination with consistent production profile`,
        icon: TrendingUp,
        color: 'text-green-500'
      };
    }
    
    return {
      action: 'CONSIDER',
      reasoning: `${player.name}: Solid production expectation with manageable risk profile`,
      icon: Brain,
      color: 'text-blue-500'
    };
  };

  const getMarketTiming = () => {
    if (draftProgress < 0.3 && player.tier <= 2) {
      return 'PREMIUM PHASE - Elite players command top dollar';
    }
    if (draftProgress < 0.6) {
      return 'VALUE PHASE - Best time for tier 2-3 players';
    }
    if (draftProgress < 0.8) {
      return 'SCARCITY PHASE - Position runs likely';
    }
    return 'ENDGAME PHASE - Handcuffs and sleepers';
  };

  const recommendation = getExpertRecommendation();
  const RecommendationIcon = recommendation.icon;

  return (
    <div className="space-y-4">
      {/* Expert Recommendation */}
      <Card className="glass-card border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RecommendationIcon className={`w-5 h-5 ${recommendation.color}`} />
            Expert Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <Badge className={`${recommendation.color.replace('text-', 'bg-')} text-white font-bold`}>
              {recommendation.action}
            </Badge>
            <div className="text-sm text-muted-foreground">
              Confidence: {Math.round(analytics.confidenceLevel)}%
            </div>
          </div>
          <p className="text-sm">{recommendation.reasoning}</p>
        </CardContent>
      </Card>

      {/* Market Analysis */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-accent" />
            Market Timing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Draft Phase</span>
            <span className="text-sm text-muted-foreground">{getMarketTiming()}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Price Inflation</span>
            <div className="flex items-center gap-2">
              {marketTrends.priceInflation > 0.1 ? (
                <TrendingUp className="w-4 h-4 text-red-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-500" />
              )}
              <span className="text-sm font-bold">
                {marketTrends.priceInflation > 0 ? '+' : ''}{Math.round(marketTrends.priceInflation * 100)}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Position Scarcity</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                positionScarcity > 0.7 ? 'bg-red-500' : 
                positionScarcity > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              <span className="text-sm">{Math.round(positionScarcity * 100)}% depleted</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Factors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Injury Risk</span>
              <Badge variant={player.injuryRisk === 'HIGH' ? 'destructive' : 
                            player.injuryRisk === 'MEDIUM' ? 'secondary' : 'default'}>
                {player.injuryRisk}
              </Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span>Age Risk</span>
              <Badge variant={player.ageRisk === 'HIGH' ? 'destructive' : 
                            player.ageRisk === 'MEDIUM' ? 'secondary' : 'default'}>
                {player.ageRisk}
              </Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span>Regression Risk</span>
              <span className="font-bold">{Math.round(analytics.regressionRisk * 100)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upside Factors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Breakout Potential</span>
              <span className="font-bold text-green-500">
                {Math.round(analytics.breakoutPotential * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Consistency</span>
              <span className="font-bold">{player.consistency}/10</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Target Share</span>
              <span className="font-bold">{player.targetShare}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Metrics */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Advanced Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-muted-foreground">Value Over Baseline</div>
              <div className="font-bold text-lg">
                {analytics.valueOverBaseline > 0 ? '+' : ''}{Math.round(analytics.valueOverBaseline * 100)}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Risk-Adjusted Value</div>
              <div className="font-bold text-lg">${analytics.riskAdjustedValue}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Optimal Range</div>
              <div className="font-bold">${analytics.optimalBidRange[0]}-${analytics.optimalBidRange[1]}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Position Rank</div>
              <div className="font-bold">#{Math.round(player.adp)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Notes */}
      {marketTrends.positionRuns.includes(player.position) && (
        <Card className="glass-card border-l-4 border-l-yellow-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="font-bold text-sm">Position Run Alert</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {player.position} position showing increased draft velocity. Consider bidding aggressively.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};