import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Crown, Zap, Clock, DollarSign } from 'lucide-react';
import { Player, Team, AuctionDraftService } from '@/services/auctionDraftService';

interface DynamicRecommendationsProps {
  draftService: AuctionDraftService;
  players: Player[];
  teams: Team[];
  draftedPlayers: Player[];
  selectedPlayer?: Player | null;
  onPlayerSelect: (player: Player) => void;
}

export const DynamicRecommendations: React.FC<DynamicRecommendationsProps> = ({
  draftService,
  players,
  teams,
  draftedPlayers,
  selectedPlayer,
  onPlayerSelect
}) => {
  const recommendations = useMemo(() => {
    const available = players.filter(p => !p.isDrafted);
    const draftProgress = draftedPlayers.length / players.length;
    
    // Helper functions based on real player data
    const getRecommendationReason = (player: Player, analytics: any, progress: number) => {
      // Base recommendations on actual player statistics and performance
      if (analytics.valueOverBaseline > 0.3) return `Elite value: ${player.name} outperforms ${player.position} baseline`;
      if (analytics.breakoutPotential > 0.7) return `Breakout potential: ${player.name} trending upward`;
      if (progress > 0.6 && player.tier <= 2) return `Tier scarcity: Premium ${player.position} becoming scarce`;
      if (analytics.riskAdjustedValue > analytics.adjustedValue) return `Safe pick: ${player.name} low risk profile`;
      if (player.projectedPoints > 250) return `High ceiling: Strong fantasy projection`;
      if (player.targetShare && player.targetShare > 25) return `Volume play: High target share expected`;
      return `Solid option: Balanced production expectation`;
    };
    
    // Calculate dynamic bid adjustments based on real player data and market conditions
    const getBidAdjustment = (player: Player) => {
      const analytics = draftService.getPlayerAnalytics(player.id);
      if (!analytics) return player.estimatedValue;

      let adjustment = 1.0;
      
      // Market inflation based on draft progress
      if (draftProgress > 0.5) adjustment += 0.1;
      if (draftProgress > 0.7) adjustment += 0.15;
      
      // Position scarcity adjustment based on actual remaining players
      const positionRemaining = available.filter(p => p.position === player.position).length;
      const totalPosition = players.filter(p => p.position === player.position).length;
      const scarcity = 1 - (positionRemaining / totalPosition);
      
      if (scarcity > 0.7) adjustment += 0.2;
      else if (scarcity > 0.5) adjustment += 0.1;
      
      // Tier scarcity based on actual player tiers
      const tierRemaining = available.filter(p => p.tier === player.tier).length;
      if (tierRemaining <= 2 && player.tier <= 2) adjustment += 0.15;
      
      // Real performance modifiers
      if (player.projectedPoints > 300) adjustment += 0.05; // Elite projections
      if (player.consistency && player.consistency >= 8) adjustment += 0.05; // High consistency
      if (player.targetShare && player.targetShare > 25) adjustment += 0.05; // High target share
      
      return Math.round(analytics.adjustedValue * adjustment);
    };

    // Strategic recommendations
    const strategic = available
      .map(player => {
        const analytics = draftService.getPlayerAnalytics(player.id);
        const adjustedBid = getBidAdjustment(player);
        return { player, analytics, adjustedBid };
      })
      .filter(({ analytics }) => analytics !== null)
      .sort((a, b) => (b.analytics!.valueOverBaseline - a.analytics!.valueOverBaseline))
      .slice(0, 5)
      .map(({ player, analytics, adjustedBid }) => ({
        player,
        analytics: analytics!,
        adjustedBid,
        reason: getRecommendationReason(player, analytics!, draftProgress)
      }));

    // Value picks (undervalued relative to tier)
    const valuePicks = available
      .filter(p => p.tier >= 3)
      .map(player => {
        const analytics = draftService.getPlayerAnalytics(player.id);
        return { player, analytics, adjustedBid: getBidAdjustment(player) };
      })
      .filter(({ analytics }) => analytics && analytics.breakoutPotential > 0.6)
      .sort((a, b) => (b.analytics!.breakoutPotential - a.analytics!.breakoutPotential))
      .slice(0, 3);

    // Urgent targets (position scarcity)
    const urgentTargets = available
      .filter(p => {
        const posRemaining = available.filter(ap => ap.position === p.position).length;
        const totalPos = players.filter(ap => ap.position === p.position).length;
        return (posRemaining / totalPos) < 0.4; // Less than 40% remaining
      })
      .sort((a, b) => a.estimatedValue - b.estimatedValue) // Sort by value, ascending
      .slice(0, 3)
      .map(player => ({
        player,
        analytics: draftService.getPlayerAnalytics(player.id),
        adjustedBid: getBidAdjustment(player)
      }));

    // Avoid list (high risk)
    const avoidList = available
      .map(player => ({
        player,
        analytics: draftService.getPlayerAnalytics(player.id)
      }))
      .filter(({ analytics }) => analytics && analytics.regressionRisk > 0.6)
      .slice(0, 3);

    return {
      strategic,
      valuePicks,
      urgentTargets,
      avoidList,
      draftProgress,
      getBidAdjustment
    };
  }, [players, draftedPlayers, draftService]);


  const getUrgencyLevel = (positionScarcity: number) => {
    if (positionScarcity > 0.7) return { level: 'CRITICAL', color: 'bg-red-500' };
    if (positionScarcity > 0.5) return { level: 'HIGH', color: 'bg-orange-500' };
    if (positionScarcity > 0.3) return { level: 'MEDIUM', color: 'bg-yellow-500' };
    return { level: 'LOW', color: 'bg-green-500' };
  };

  return (
    <div className="space-y-6">
      {/* Draft Phase Indicator */}
      <Card className="glass-card border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Draft Phase Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-2xl font-bold">
                {recommendations.draftProgress < 0.3 ? 'PREMIUM PHASE' :
                 recommendations.draftProgress < 0.6 ? 'VALUE PHASE' :
                 recommendations.draftProgress < 0.8 ? 'SCARCITY PHASE' : 'ENDGAME'}
              </div>
              <div className="text-sm text-muted-foreground">
                {Math.round(recommendations.draftProgress * 100)}% complete
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{draftedPlayers.length}/{players.length}</div>
              <div className="text-sm text-muted-foreground">Players drafted</div>
            </div>
          </div>
          
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${recommendations.draftProgress * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Strategic Recommendations */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Strategic Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.strategic.map(({ player, analytics, adjustedBid, reason }, index) => (
            <div 
              key={player.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 cursor-pointer transition-colors"
              onClick={() => onPlayerSelect(player)}
            >
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-primary">#{index + 1}</div>
                <div>
                  <div className="font-bold">{player.name}</div>
                  <div className="text-sm text-muted-foreground">{player.position} • {player.team}</div>
                  <div className="text-xs text-accent">{reason}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">${adjustedBid}</div>
                <Badge className="text-xs">
                  {adjustedBid > player.estimatedValue ? '+' : ''}
                  {adjustedBid - player.estimatedValue}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Urgent Targets */}
      {recommendations.urgentTargets.length > 0 && (
        <Card className="glass-card border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Urgent Targets - Position Scarcity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.urgentTargets.map(({ player, analytics, adjustedBid }) => {
              const available = players.filter(p => !p.isDrafted && p.position === player.position).length;
              const total = players.filter(p => p.position === player.position).length;
              const scarcity = 1 - (available / total);
              const urgency = getUrgencyLevel(scarcity);
              
              return (
                <div 
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 cursor-pointer transition-colors"
                  onClick={() => onPlayerSelect(player)}
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`${urgency.color} text-white text-xs`}>
                      {urgency.level}
                    </Badge>
                    <div>
                      <div className="font-bold">{player.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {player.position} • Only {available} of {total} remaining
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">${adjustedBid}</div>
                    <div className="text-xs text-muted-foreground">Adjusted bid</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Value Picks */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Breakout Candidates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.valuePicks.map(({ player, analytics, adjustedBid }) => (
            <div 
              key={player.id}
              className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 cursor-pointer transition-colors"
              onClick={() => onPlayerSelect(player)}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">⚡</div>
                <div>
                  <div className="font-bold">{player.name}</div>
                  <div className="text-sm text-muted-foreground">{player.position} • {player.team}</div>
                  <div className="text-xs text-yellow-600">
                    {Math.round((analytics?.breakoutPotential || 0) * 100)}% breakout potential
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">${adjustedBid}</div>
                <div className="text-xs text-muted-foreground">Value bid</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Avoid List */}
      {recommendations.avoidList.length > 0 && (
        <Card className="glass-card border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              High Risk Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.avoidList.map(({ player, analytics }) => (
              <div 
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <div className="font-bold">{player.name}</div>
                    <div className="text-sm text-muted-foreground">{player.position} • {player.team}</div>
                    <div className="text-xs text-red-600">
                      {Math.round((analytics?.regressionRisk || 0) * 100)}% regression risk
                    </div>
                  </div>
                </div>
                <Badge variant="destructive">AVOID</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected Player Dynamic Bid */}
      {selectedPlayer && !selectedPlayer.isDrafted && (
        <Card className="glass-card border-l-4 border-l-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" />
              Dynamic Bid Recommendation: {selectedPlayer.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-green-500">
                  ${recommendations.getBidAdjustment(selectedPlayer) - 3}
                </div>
                <div className="text-xs text-muted-foreground">Conservative</div>
              </div>
              <div>
                <div className="text-xl font-bold text-accent">
                  ${recommendations.getBidAdjustment(selectedPlayer)}
                </div>
                <div className="text-xs text-muted-foreground">Recommended</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-500">
                  ${recommendations.getBidAdjustment(selectedPlayer) + 5}
                </div>
                <div className="text-xs text-muted-foreground">Aggressive</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};