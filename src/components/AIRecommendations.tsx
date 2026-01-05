import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, Target, TrendingUp, AlertTriangle, Star, 
  Users, Clock, BarChart3, Activity, Award,
  Lightbulb, Shield, Zap, Eye
} from 'lucide-react';
import { SnakeDraftPlayer, Team } from '@/services/auctionDraftService';

interface AIRecommendationsProps {
  currentTeam: Team | null;
  availablePlayers: SnakeDraftPlayer[];
  draftHistory: Array<{
    pick: number;
    round: number;
    teamId: string;
    player: SnakeDraftPlayer;
  }>;
  currentRound: number;
  currentPick: number;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  currentTeam,
  availablePlayers,
  draftHistory,
  currentRound,
  currentPick
}) => {
  if (!currentTeam) return null;

  const teamRoster = draftHistory.filter(h => h.teamId === currentTeam.id);
  const positionCounts = {
    QB: teamRoster.filter(h => h.player.position === 'QB').length,
    RB: teamRoster.filter(h => h.player.position === 'RB').length,
    WR: teamRoster.filter(h => h.player.position === 'WR').length,
    TE: teamRoster.filter(h => h.player.position === 'TE').length,
    K: teamRoster.filter(h => h.player.position === 'K').length,
    DST: teamRoster.filter(h => h.player.position === 'DST').length,
  };

  const undraftedPlayers = availablePlayers.filter(p => !p.isDrafted);

  // Advanced roster analysis
  const analyzeRosterStrengths = () => {
    const rosterPlayers = teamRoster.map(h => h.player);
    const analysis = {
      averageProjection: rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.projectedPoints, 0) / rosterPlayers.length : 0,
      totalProjection: rosterPlayers.reduce((sum, p) => sum + p.projectedPoints, 0),
      riskProfile: rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.bustRisk, 0) / rosterPlayers.length : 0,
      averageAge: rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.age, 0) / rosterPlayers.length : 0,
      upside: rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.upside, 0) / rosterPlayers.length : 0,
      injuryRisk: rosterPlayers.filter(p => p.injuryRisk === 'HIGH').length / Math.max(rosterPlayers.length, 1),
      positionScarcity: calculatePositionScarcity()
    };
    return analysis;
  };

  const calculatePositionScarcity = () => {
    const scarcity = {
      QB: undraftedPlayers.filter(p => p.position === 'QB' && p.tier <= 3).length,
      RB: undraftedPlayers.filter(p => p.position === 'RB' && p.tier <= 3).length,
      WR: undraftedPlayers.filter(p => p.position === 'WR' && p.tier <= 3).length,
      TE: undraftedPlayers.filter(p => p.position === 'TE' && p.tier <= 2).length,
    };
    return scarcity;
  };

  const analyzeMarket = () => {
    const recentPicks = draftHistory.slice(-8); // Last 8 picks
    const positionTrends = {
      QB: recentPicks.filter(h => h.player.position === 'QB').length,
      RB: recentPicks.filter(h => h.player.position === 'RB').length,
      WR: recentPicks.filter(h => h.player.position === 'WR').length,
      TE: recentPicks.filter(h => h.player.position === 'TE').length,
    };

    // Calculate average ADP deviation
    const adpDeviations = recentPicks.map(h => h.pick - h.player.adp);
    const avgDeviation = adpDeviations.length ? adpDeviations.reduce((sum, dev) => sum + dev, 0) / adpDeviations.length : 0;

    return { positionTrends, avgDeviation };
  };

  // Enhanced AI recommendations algorithm
  const getTopRecommendations = () => {
    const rosterAnalysis = analyzeRosterStrengths();
    const marketAnalysis = analyzeMarket();
    const scarcity = rosterAnalysis.positionScarcity;

    const recommendations = undraftedPlayers.map(player => {
      // 1. Position Need (40% weight)
      const positionNeed = getAdvancedPositionNeed(player.position, rosterAnalysis, scarcity);
      
      // 2. Value Analysis (25% weight) 
      const valueScore = calculateValueScore(player, currentPick, marketAnalysis.avgDeviation);
      
      // 3. Roster Fit (20% weight)
      const rosterFit = calculateRosterFit(player, rosterAnalysis);
      
      // 4. Market Timing (10% weight)
      const marketTiming = calculateMarketTiming(player, marketAnalysis.positionTrends, scarcity);
      
      // 5. Risk-Adjusted Upside (5% weight)
      const riskAdjustedUpside = calculateRiskAdjustedUpside(player, rosterAnalysis.riskProfile);

      // Weighted total score
      const totalScore = (positionNeed * 0.4) + (valueScore * 0.25) + (rosterFit * 0.2) + (marketTiming * 0.1) + (riskAdjustedUpside * 0.05);
      
      return {
        player,
        score: totalScore,
        reasoning: generateAdvancedReasoning(player, positionNeed, valueScore, rosterFit, marketTiming, currentPick),
        components: { positionNeed, valueScore, rosterFit, marketTiming, riskAdjustedUpside }
      };
    }).sort((a, b) => b.score - a.score);

    return recommendations.slice(0, 6);
  };

  const getAdvancedPositionNeed = (position: string, rosterAnalysis: any, scarcity: any): number => {
    const count = positionCounts[position as keyof typeof positionCounts];
    let baseNeed = getPositionNeed(position);
    
    // Adjust based on scarcity
    const scarcityMultiplier = {
      QB: scarcity.QB <= 2 ? 1.5 : scarcity.QB <= 4 ? 1.2 : 1.0,
      RB: scarcity.RB <= 3 ? 1.4 : scarcity.RB <= 6 ? 1.2 : 1.0,
      WR: scarcity.WR <= 4 ? 1.3 : scarcity.WR <= 8 ? 1.1 : 1.0,
      TE: scarcity.TE <= 1 ? 1.6 : scarcity.TE <= 3 ? 1.3 : 1.0,
    };
    
    const multiplier = scarcityMultiplier[position as keyof typeof scarcityMultiplier] || 1.0;
    
    // Round-specific adjustments
    let roundAdjustment = 1.0;
    if (currentRound <= 3 && (position === 'RB' || position === 'WR')) roundAdjustment = 1.3;
    if (currentRound >= 10 && (position === 'K' || position === 'DST')) roundAdjustment = 1.5;
    if (currentRound >= 12 && count === 0) roundAdjustment = 2.0;

    return Math.min(100, baseNeed * multiplier * roundAdjustment);
  };

  const calculateValueScore = (player: SnakeDraftPlayer, pick: number, avgDeviation: number): number => {
    const adpDiff = player.adp - pick;
    let baseValue = Math.max(0, adpDiff / player.adp * 100);
    
    // Adjust for market trends
    const marketAdjustment = avgDeviation > 0 ? 0.9 : 1.1; // If picks are reaching, be more conservative
    
    // Tier drop bonus
    const tierBonus = player.tier <= 2 ? 20 : player.tier <= 3 ? 10 : 0;
    
    // Penalty for major reaches
    const reachPenalty = adpDiff < -10 ? Math.abs(adpDiff) * 2 : 0;
    
    return Math.max(0, (baseValue * marketAdjustment) + tierBonus - reachPenalty);
  };

  const calculateRosterFit = (player: SnakeDraftPlayer, rosterAnalysis: any): number => {
    let fitScore = 50; // Base score
    
    // Age balance
    if (rosterAnalysis.averageAge > 28 && player.age < 25) fitScore += 15;
    if (rosterAnalysis.averageAge < 24 && player.age > 26) fitScore += 10;
    
    // Risk balance
    if (rosterAnalysis.riskProfile > 40 && player.bustRisk < 25) fitScore += 20;
    if (rosterAnalysis.riskProfile < 25 && player.upside > 80) fitScore += 15;
    
    // Injury risk diversification
    if (rosterAnalysis.injuryRisk > 0.3 && player.injuryRisk === 'LOW') fitScore += 15;
    
    // Consistency vs upside balance
    const rosterPlayers = teamRoster.map(h => h.player);
    const highUpsidePlayers = rosterPlayers.filter(p => p.upside > 80).length;
    const consistentPlayers = rosterPlayers.filter(p => p.consistency > 7).length;
    
    if (highUpsidePlayers < consistentPlayers && player.upside > 80) fitScore += 10;
    if (consistentPlayers < highUpsidePlayers && player.consistency > 7) fitScore += 10;
    
    return Math.min(100, fitScore);
  };

  const calculateMarketTiming = (player: SnakeDraftPlayer, positionTrends: any, scarcity: any): number => {
    const recentPicks = positionTrends[player.position] || 0;
    let timingScore = 50;
    
    // Position run considerations
    if (recentPicks >= 2) {
      timingScore -= 20; // Run happening, might want to wait
    } else if (recentPicks === 0 && scarcity[player.position] <= 3) {
      timingScore += 25; // Good time to grab before run starts
    }
    
    // Tier timing
    const playersInTier = undraftedPlayers.filter(p => p.position === player.position && p.tier === player.tier).length;
    if (playersInTier <= 2 && player.tier <= 3) timingScore += 20;
    
    return Math.min(100, timingScore);
  };

  const calculateRiskAdjustedUpside = (player: SnakeDraftPlayer, teamRiskProfile: number): number => {
    const playerUpsideRatio = player.upside / Math.max(player.projectedPoints, 1);
    const riskFactor = 100 - player.bustRisk;
    
    let adjustedScore = (playerUpsideRatio * riskFactor) / 2;
    
    // Adjust based on team's current risk profile
    if (teamRiskProfile > 50) {
      // Team already risky, prefer safer picks
      adjustedScore *= (100 - player.bustRisk) / 100;
    } else {
      // Team safe, can afford some risk for upside
      adjustedScore *= (player.upside / player.projectedPoints);
    }
    
    return Math.min(100, adjustedScore);
  };

  const generateAdvancedReasoning = (
    player: SnakeDraftPlayer, 
    positionNeed: number, 
    valueScore: number, 
    rosterFit: number, 
    marketTiming: number, 
    pick: number
  ): string => {
    const reasons = [];
    
    // Position-based reasoning
    if (positionNeed > 70) reasons.push("Critical positional need");
    else if (positionNeed > 50) reasons.push("Important roster hole to fill");
    else if (positionNeed > 30) reasons.push("Depth upgrade opportunity");
    
    // Value-based reasoning
    if (valueScore > 60) reasons.push("Exceptional value at current pick");
    else if (valueScore > 40) reasons.push("Good value selection");
    else if (player.adp < pick - 10) reasons.push("Significant reach - reconsider");
    
    // Fit-based reasoning
    if (rosterFit > 70) reasons.push("Perfect roster complement");
    else if (rosterFit > 50) reasons.push("Good team fit");
    
    // Market timing
    if (marketTiming > 70) reasons.push("Ideal timing window");
    else if (marketTiming < 40) reasons.push("Position run risk");
    
    // Player-specific traits
    if (player.recentTrends === 'RISING' && player.upside > 80) reasons.push("Breakout candidate");
    if (player.bustRisk < 20 && player.consistency > 8) reasons.push("Safe floor play");
    if (player.sleeper && positionNeed > 40) reasons.push("High-upside sleeper");
    
    return reasons.slice(0, 3).join(" • ");
  };

  const getPositionNeed = (position: string): number => {
    const weights = {
      QB: positionCounts.QB === 0 ? 80 : positionCounts.QB === 1 ? 20 : 5,
      RB: positionCounts.RB < 2 ? 70 : positionCounts.RB < 4 ? 40 : 10,
      WR: positionCounts.WR < 3 ? 60 : positionCounts.WR < 5 ? 35 : 15,
      TE: positionCounts.TE === 0 ? 50 : positionCounts.TE === 1 ? 25 : 8,
      K: positionCounts.K === 0 && currentRound > 12 ? 30 : 5,
      DST: positionCounts.DST === 0 && currentRound > 10 ? 30 : 5,
    };
    return weights[position as keyof typeof weights] || 0;
  };

  const generateReasoning = (player: SnakeDraftPlayer, positionNeed: number, valueScore: number, pick: number): string => {
    const reasons = [];
    
    if (positionNeed > 50) reasons.push("High positional need");
    if (valueScore > 30) reasons.push("Excellent value at this pick");
    if (player.adp > pick + 10) reasons.push("Significant reach - consider alternatives");
    if (player.recentTrends === 'RISING') reasons.push("Trending upward");
    if (player.sleeper) reasons.push("Sleeper pick with upside");
    if (player.tier <= 2) reasons.push("Elite tier player");
    if (player.bustRisk < 20) reasons.push("Low risk selection");
    if (player.upside > 80) reasons.push("High ceiling potential");
    
    return reasons.slice(0, 3).join(" • ");
  };

  const getPositionalAnalysis = () => {
    const analysis = [];
    
    Object.entries(positionCounts).forEach(([pos, count]) => {
      const needed = getIdealCount(pos) - count;
      if (needed > 0) {
        const urgency = getUrgency(pos, count, currentRound);
        analysis.push({ position: pos, needed, urgency, count });
      }
    });
    
    return analysis.sort((a, b) => b.urgency - a.urgency);
  };

  const getIdealCount = (position: string): number => {
    const ideal = { QB: 2, RB: 4, WR: 5, TE: 2, K: 1, DST: 1 };
    return ideal[position as keyof typeof ideal] || 0;
  };

  const getUrgency = (position: string, count: number, round: number): number => {
    if (position === 'QB' && count === 0) return round > 8 ? 90 : 70;
    if (position === 'RB' && count < 2) return round > 6 ? 85 : 75;
    if (position === 'WR' && count < 3) return round > 7 ? 80 : 65;
    if (position === 'TE' && count === 0) return round > 9 ? 75 : 55;
    if (position === 'K' && count === 0) return round > 13 ? 95 : 20;
    if (position === 'DST' && count === 0) return round > 11 ? 90 : 25;
    return 30;
  };

  const getRunRisk = () => {
    const positionRuns = ['QB', 'RB', 'WR', 'TE'].map(pos => {
      const recentPicks = draftHistory.slice(-6);
      const positionPicks = recentPicks.filter(h => h.player.position === pos).length;
      const available = undraftedPlayers.filter(p => p.position === pos && p.tier <= 3).length;
      
      return {
        position: pos,
        recentPicks: positionPicks,
        available,
        risk: positionPicks >= 2 && available <= 3 ? 'HIGH' : 
              positionPicks >= 1 && available <= 5 ? 'MEDIUM' : 'LOW'
      };
    });
    
    return positionRuns.filter(p => p.risk !== 'LOW');
  };

  // Get position-specific recommendations
  const getPositionSpecificRecommendations = () => {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    return positions.map(position => {
      const positionPlayers = undraftedPlayers
        .filter(p => p.position === position)
        .map(player => {
          const positionNeed = getAdvancedPositionNeed(position, analyzeRosterStrengths(), calculatePositionScarcity());
          const valueScore = calculateValueScore(player, currentPick, analyzeMarket().avgDeviation);
          const rosterFit = calculateRosterFit(player, analyzeRosterStrengths());
          const totalScore = (positionNeed * 0.4) + (valueScore * 0.3) + (rosterFit * 0.3);
          
          return { player, score: totalScore, positionNeed, valueScore, rosterFit };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const currentCount = positionCounts[position as keyof typeof positionCounts];
      const scarcity = undraftedPlayers.filter(p => p.position === position && p.tier <= 3).length;
      const urgency = getUrgency(position, currentCount, currentRound);

      return {
        position,
        players: positionPlayers,
        currentCount,
        scarcity,
        urgency,
        recommendation: getPositionRecommendation(position, currentCount, scarcity, currentRound)
      };
    });
  };

  const getAdvancedTeamAnalysis = () => {
    const rosterPlayers = teamRoster.map(h => h.player);
    const totalPoints = rosterPlayers.reduce((sum, p) => sum + p.projectedPoints, 0);
    const avgAge = rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.age, 0) / rosterPlayers.length : 0;
    const riskProfile = rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.bustRisk, 0) / rosterPlayers.length : 0;
    const upside = rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.upside, 0) / rosterPlayers.length : 0;
    const consistency = rosterPlayers.length ? rosterPlayers.reduce((sum, p) => sum + p.consistency, 0) / rosterPlayers.length : 0;
    
    const injuryRisk = rosterPlayers.filter(p => p.injuryRisk === 'HIGH').length;
    const sleepers = rosterPlayers.filter(p => p.sleeper).length;
    const elitePlayers = rosterPlayers.filter(p => p.tier <= 2).length;
    const risingPlayers = rosterPlayers.filter(p => p.recentTrends === 'RISING').length;

    return {
      totalPoints,
      avgAge,
      riskProfile,
      upside,
      consistency,
      injuryRisk,
      sleepers,
      elitePlayers,
      risingPlayers,
      teamSize: rosterPlayers.length,
      strengths: calculateTeamStrengths(rosterPlayers),
      weaknesses: calculateTeamWeaknesses(rosterPlayers)
    };
  };

  const calculateTeamStrengths = (roster: SnakeDraftPlayer[]) => {
    const strengths = [];
    const avgUpside = roster.reduce((sum, p) => sum + p.upside, 0) / Math.max(roster.length, 1);
    const avgRisk = roster.reduce((sum, p) => sum + p.bustRisk, 0) / Math.max(roster.length, 1);
    const avgConsistency = roster.reduce((sum, p) => sum + p.consistency, 0) / Math.max(roster.length, 1);
    
    if (avgUpside > 75) strengths.push("High ceiling roster");
    if (avgRisk < 30) strengths.push("Low risk foundation");
    if (avgConsistency > 7) strengths.push("Consistent performers");
    if (roster.filter(p => p.tier <= 2).length >= 3) strengths.push("Elite talent core");
    if (roster.filter(p => p.age < 25).length > roster.length * 0.6) strengths.push("Young core");
    
    return strengths;
  };

  const calculateTeamWeaknesses = (roster: SnakeDraftPlayer[]) => {
    const weaknesses = [];
    const avgAge = roster.reduce((sum, p) => sum + p.age, 0) / Math.max(roster.length, 1);
    const avgRisk = roster.reduce((sum, p) => sum + p.bustRisk, 0) / Math.max(roster.length, 1);
    const injuryRiskCount = roster.filter(p => p.injuryRisk === 'HIGH').length;
    
    if (avgAge > 28) weaknesses.push("Aging roster");
    if (avgRisk > 50) weaknesses.push("High bust risk");
    if (injuryRiskCount > roster.length * 0.4) weaknesses.push("Injury concerns");
    if (roster.filter(p => p.tier > 4).length > roster.length * 0.5) weaknesses.push("Depth concerns");
    
    return weaknesses;
  };

  const getMarketInsights = () => {
    const recentPicks = draftHistory.slice(-10);
    const positionTrends = {
      QB: recentPicks.filter(h => h.player.position === 'QB').length,
      RB: recentPicks.filter(h => h.player.position === 'RB').length,
      WR: recentPicks.filter(h => h.player.position === 'WR').length,
      TE: recentPicks.filter(h => h.player.position === 'TE').length,
    };

    const fallers = undraftedPlayers.filter(p => p.adp < currentPick - 8 && p.tier <= 3);
    const risers = undraftedPlayers.filter(p => p.adp > currentPick + 8 && p.tier <= 3);
    const values = undraftedPlayers.filter(p => p.adp > currentPick + 3 && p.tier <= 4);

    return { positionTrends, fallers, risers, values };
  };

  const getDraftStrategy = () => {
    const rosterAnalysis = analyzeRosterStrengths();
    const remainingRounds = 16 - currentRound;
    const rosterHoles = Object.entries(positionCounts).filter(([pos, count]) => 
      count < getIdealCount(pos)
    ).length;

    let strategy = [];
    
    if (currentRound <= 6) {
      strategy.push("Focus on elite talent and core positions");
      if (positionCounts.RB < 2) strategy.push("Prioritize RB depth early");
      if (positionCounts.WR < 2) strategy.push("Secure WR foundation");
    } else if (currentRound <= 10) {
      strategy.push("Fill positional needs and find value");
      if (positionCounts.QB === 0) strategy.push("Must draft QB soon");
      if (positionCounts.TE === 0) strategy.push("Target TE value");
    } else {
      strategy.push("Depth, sleepers, and late-round gems");
      if (positionCounts.K === 0) strategy.push("Consider kicker");
      if (positionCounts.DST === 0) strategy.push("Consider defense");
    }

    if (rosterAnalysis.riskProfile > 40) strategy.push("Add safe floor players");
    if (rosterAnalysis.upside < 60) strategy.push("Target high-upside picks");

    return strategy;
  };

  const getPositionRecommendation = (position: string, count: number, scarcity: number, round: number) => {
    if (position === 'QB') {
      if (count === 0 && round > 8) return "URGENT - Must draft QB";
      if (count === 0) return "Consider top-tier QB";
      return "Backup QB optional";
    }
    if (position === 'RB') {
      if (count < 2) return "HIGH PRIORITY - Need RB depth";
      if (count < 3 && scarcity <= 5) return "Consider quality depth";
      return "Depth/handcuff options";
    }
    if (position === 'WR') {
      if (count < 3) return "CRITICAL - Build WR corps";
      if (count < 4) return "Add WR depth";
      return "Upside/depth plays";
    }
    if (position === 'TE') {
      if (count === 0 && round > 10) return "URGENT - Must draft TE";
      if (count === 0) return "Target TE value";
      return "Backup TE optional";
    }
    if (position === 'K' && count === 0 && round > 13) return "Draft kicker";
    if (position === 'DST' && count === 0 && round > 11) return "Draft defense";
    return "Low priority";
  };

  const recommendations = getTopRecommendations();
  const positionalAnalysis = getPositionalAnalysis();
  const runRisks = getRunRisk();
  const positionRecommendations = getPositionSpecificRecommendations();
  const teamAnalysis = getAdvancedTeamAnalysis();
  const marketInsights = getMarketInsights();
  const draftStrategy = getDraftStrategy();

  return (
    <div className="space-y-4">
      {/* Top section - AI Recommendations and Position Analysis side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Recommendations */}
        <Card className="glass-card border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Top AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {recommendations.map((rec, index) => (
              <div key={rec.player.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="flex-shrink-0">
                  <Badge variant={index === 0 ? "default" : "secondary"} className="w-8 h-8 rounded-full flex items-center justify-center">
                    {index + 1}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{rec.player.name}</span>
                    <Badge className={
                      rec.player.position === 'QB' ? 'bg-red-500' :
                      rec.player.position === 'RB' ? 'bg-green-500' :
                      rec.player.position === 'WR' ? 'bg-blue-500' :
                      rec.player.position === 'TE' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }>
                      {rec.player.position}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{rec.player.team}</span>
                    {rec.player.sleeper && <Star className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">{rec.reasoning}</div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>ADP: {Math.round(rec.player.adp)}</span>
                    <span>Proj: {Math.round(rec.player.projectedPoints)}</span>
                    <span>Tier: {rec.player.tier}</span>
                    <span className="text-primary font-bold">AI Score: {Math.round(rec.score)}</span>
                  </div>
                  {rec.components && (
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span title="Position Need">Need: {Math.round(rec.components.positionNeed)}</span>
                      <span title="Value Score">Value: {Math.round(rec.components.valueScore)}</span>
                      <span title="Roster Fit">Fit: {Math.round(rec.components.rosterFit)}</span>
                      <span title="Market Timing">Timing: {Math.round(rec.components.marketTiming)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Position-Specific Recommendations */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              Position Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 gap-4">
              {positionRecommendations.map(pos => (
                <div key={pos.position} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        pos.position === 'QB' ? 'bg-red-500' :
                        pos.position === 'RB' ? 'bg-green-500' :
                        pos.position === 'WR' ? 'bg-blue-500' :
                        pos.position === 'TE' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }>
                        {pos.position}
                      </Badge>
                      <span className="font-medium">{pos.currentCount}/{getIdealCount(pos.position)}</span>
                    </div>
                    <Badge variant={pos.urgency > 70 ? "destructive" : pos.urgency > 40 ? "default" : "secondary"}>
                      {pos.urgency > 70 ? 'URGENT' : pos.urgency > 40 ? 'MODERATE' : 'LOW'}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground mb-2">
                    {pos.recommendation} • {pos.scarcity} quality players left
                  </div>
                  
                  <div className="space-y-1">
                    {pos.players.slice(0, 2).map((rec, index) => (
                      <div key={rec.player.id} className="flex items-center justify-between text-sm bg-secondary/20 rounded p-2">
                        <div>
                          <span className="font-medium">{rec.player.name}</span>
                          <span className="text-muted-foreground ml-2">{rec.player.team}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span>ADP: {Math.round(rec.player.adp)}</span>
                          <span className="text-primary">Score: {Math.round(rec.score)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team & Roster Analysis with Tabs */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            Team & Roster Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="composition" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="composition">Team Composition</TabsTrigger>
              <TabsTrigger value="roster">Roster Status</TabsTrigger>
            </TabsList>
            
            <TabsContent value="composition" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{Math.round(teamAnalysis.totalPoints)}</div>
                  <div className="text-sm text-muted-foreground">Projected Points</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{Math.round(teamAnalysis.avgAge * 10) / 10}</div>
                  <div className="text-sm text-muted-foreground">Average Age</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{Math.round(teamAnalysis.riskProfile)}%</div>
                  <div className="text-sm text-muted-foreground">Risk Profile</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{Math.round(teamAnalysis.upside)}%</div>
                  <div className="text-sm text-muted-foreground">Upside Rating</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-green-500" />
                    Team Strengths
                  </h4>
                  <div className="space-y-1">
                    {teamAnalysis.strengths.length > 0 ? teamAnalysis.strengths.map((strength, index) => (
                      <div key={index} className="text-sm bg-green-500/10 text-green-400 px-2 py-1 rounded">
                        {strength}
                      </div>
                    )) : (
                      <div className="text-sm text-muted-foreground">Building team foundation...</div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Areas to Address
                  </h4>
                  <div className="space-y-1">
                    {teamAnalysis.weaknesses.length > 0 ? teamAnalysis.weaknesses.map((weakness, index) => (
                      <div key={index} className="text-sm bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded">
                        {weakness}
                      </div>
                    )) : (
                      <div className="text-sm text-muted-foreground">No major concerns identified</div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="roster" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {positionalAnalysis.map(analysis => (
                  <div key={analysis.position} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{analysis.position}</span>
                      <Badge variant={analysis.urgency > 70 ? "destructive" : analysis.urgency > 40 ? "default" : "secondary"}>
                        {analysis.count}/{getIdealCount(analysis.position)}
                      </Badge>
                    </div>
                    <Progress value={analysis.urgency} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      Need {analysis.needed} more • 
                      {analysis.urgency > 70 ? ' URGENT' : analysis.urgency > 40 ? ' MODERATE' : ' LOW'} priority
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Market Insights and Draft Strategy side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Market Analysis */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Market Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-500" />
                  Position Trends (Last 10 picks)
                </h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(marketInsights.positionTrends).map(([pos, count]) => (
                    <div key={pos} className="flex justify-between">
                      <span>{pos}:</span>
                      <span className={count > 2 ? 'text-red-500' : count > 0 ? 'text-yellow-500' : 'text-muted-foreground'}>
                        {count} picks
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Value Opportunities</span>
                  </div>
                  <div className="text-muted-foreground">
                    {undraftedPlayers.filter(p => p.adp > currentPick + 5).length} players falling below ADP
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium">Breakout Candidates</span>
                  </div>
                  <div className="text-muted-foreground">
                    {undraftedPlayers.filter(p => p.sleeper && p.upside > 70).length} high-upside sleepers available
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span className="font-medium">Safe Picks</span>
                  </div>
                  <div className="text-muted-foreground">
                    {undraftedPlayers.filter(p => p.bustRisk < 25 && p.tier <= 3).length} low-risk options in top tiers
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-medium">Rising Players</span>
                  </div>
                  <div className="text-muted-foreground">
                    {undraftedPlayers.filter(p => p.recentTrends === 'RISING').length} players trending upward
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Draft Strategy */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent" />
              Draft Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium mb-2">Current Round Strategy</h4>
                <div className="space-y-1">
                  {draftStrategy.slice(0, 3).map((strategy, index) => (
                    <div key={index} className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                      {strategy}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Additional Recommendations</h4>
                <div className="space-y-1">
                  {draftStrategy.slice(3).map((strategy, index) => (
                    <div key={index} className="text-sm bg-accent/10 text-accent px-2 py-1 rounded">
                      {strategy}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Draft Context</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Round {currentRound} • Pick {currentPick} • {16 - currentRound} rounds remaining
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Position Run Alerts */}
      {runRisks.length > 0 && (
        <Card className="glass-card border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Position Run Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {runRisks.map(risk => (
                <div key={risk.position} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded">
                  <div>
                    <span className="font-medium">{risk.position} Run Risk</span>
                    <div className="text-sm text-muted-foreground">
                      {risk.recentPicks} picks in last 6 • {risk.available} quality players left
                    </div>
                  </div>
                  <Badge variant={risk.risk === 'HIGH' ? "destructive" : "default"}>
                    {risk.risk}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};