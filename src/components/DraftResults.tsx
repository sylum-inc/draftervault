import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, Users, TrendingUp, Star, Target, BarChart3 } from 'lucide-react';
import { Player, Team, AuctionDraftService } from '@/services/auctionDraftService';

interface DraftResultsProps {
  draftService: AuctionDraftService;
  teams: Team[];
  onNewDraft: () => void;
}

export const DraftResults: React.FC<DraftResultsProps> = ({ draftService, teams, onNewDraft }) => {
  const results = useMemo(() => {
    const draftedPlayers = draftService.getDraftedPlayers();
    const teamAnalysis = teams.map(team => {
      const roster = draftedPlayers.filter(p => p.draftedBy === team.id);
      const totalCost = roster.reduce((sum, p) => sum + (p.draftCost || 0), 0);
      const projectedPoints = roster.reduce((sum, p) => sum + p.projectedPoints, 0);
      const averageValue = roster.length > 0 ? totalCost / roster.length : 0;
      
      const positionBreakdown = {
        QB: roster.filter(p => p.position === 'QB').length,
        RB: roster.filter(p => p.position === 'RB').length,
        WR: roster.filter(p => p.position === 'WR').length,
        TE: roster.filter(p => p.position === 'TE').length,
      };
      
      const valueScore = roster.reduce((sum, p) => {
        const efficiency = p.projectedPoints / (p.draftCost || 1);
        return sum + efficiency;
      }, 0);
      
      return {
        team,
        roster,
        totalCost,
        projectedPoints,
        averageValue,
        positionBreakdown,
        valueScore,
        budgetRemaining: team.budget - totalCost,
        starterScore: roster.filter(p => p.tier <= 2).length,
        depthScore: roster.filter(p => p.tier >= 3).length,
      };
    });
    
    // Sort teams by projected points for rankings
    const rankings = [...teamAnalysis].sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    // Best picks analysis
    const bestPicks = draftedPlayers
      .map(p => ({
        player: p,
        value: p.projectedPoints / (p.draftCost || 1),
        savings: p.estimatedValue - (p.draftCost || 0)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    // Most expensive picks
    const mostExpensive = [...draftedPlayers]
      .sort((a, b) => (b.draftCost || 0) - (a.draftCost || 0))
      .slice(0, 5);
    
    return {
      teamAnalysis,
      rankings,
      bestPicks,
      mostExpensive,
      totalDrafted: draftedPlayers.length,
      totalSpent: draftedPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0),
      averagePlayerCost: draftedPlayers.length > 0 ? 
        draftedPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0) / draftedPlayers.length : 0
    };
  }, [draftService, teams]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-white"><Trophy className="w-3 h-3 mr-1" />1st</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 text-white"><Medal className="w-3 h-3 mr-1" />2nd</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-white"><Award className="w-3 h-3 mr-1" />3rd</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Draft Complete!
          </h1>
          <Trophy className="w-8 h-8 text-yellow-500" />
        </div>
        <p className="text-muted-foreground text-lg">
          {results.totalDrafted} players drafted • ${results.totalSpent.toLocaleString()} total spent
        </p>
        <Button onClick={onNewDraft} className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          Start New Draft
        </Button>
      </div>

      {/* Team Rankings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Final Team Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.rankings.map((teamResult, index) => (
              <div 
                key={teamResult.team.id}
                className={`flex items-center justify-between p-4 rounded-lg transition-colors
                  ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                    index === 1 ? 'bg-gray-400/10 border border-gray-400/20' :
                    index === 2 ? 'bg-amber-600/10 border border-amber-600/20' :
                    'bg-secondary/50'}`}
              >
                <div className="flex items-center gap-4">
                  {getRankBadge(index + 1)}
                  <div>
                    <div className="font-bold text-lg">{teamResult.team.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {teamResult.roster.length} players • ${teamResult.totalCost.toLocaleString()} spent
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(teamResult.projectedPoints)} pts
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${teamResult.budgetRemaining} remaining
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Draft Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Value Picks */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-green-500" />
              Best Value Picks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.bestPicks.map((pick, index) => (
              <div key={pick.player.id} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500 text-white">#{index + 1}</Badge>
                  <div>
                    <div className="font-bold">{pick.player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {pick.player.position} • {pick.player.team}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${pick.player.draftCost}</div>
                  <div className="text-sm text-green-600">
                    {pick.savings > 0 ? `$${pick.savings} savings` : 'Market value'}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Most Expensive Picks */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-500" />
              Highest Investments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.mostExpensive.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-red-500 text-white">#{index + 1}</Badge>
                  <div>
                    <div className="font-bold">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {player.position} • {player.team}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">${player.draftCost}</div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round(player.projectedPoints)} proj pts
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Team Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {results.teamAnalysis.map((teamResult) => (
          <Card key={teamResult.team.id} className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {teamResult.team.name}
                </span>
                <Badge variant="outline">{teamResult.roster.length} players</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Team Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Projected Points</div>
                  <div className="font-bold text-lg">{Math.round(teamResult.projectedPoints)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Spent</div>
                  <div className="font-bold text-lg">${teamResult.totalCost}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Budget Remaining</div>
                  <div className="font-bold">${teamResult.budgetRemaining}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Player Cost</div>
                  <div className="font-bold">${Math.round(teamResult.averageValue)}</div>
                </div>
              </div>

              {/* Position Breakdown */}
              <div>
                <div className="text-sm font-medium mb-2">Roster Composition</div>
                <div className="flex gap-2">
                  <Badge variant="outline">QB: {teamResult.positionBreakdown.QB}</Badge>
                  <Badge variant="outline">RB: {teamResult.positionBreakdown.RB}</Badge>
                  <Badge variant="outline">WR: {teamResult.positionBreakdown.WR}</Badge>
                  <Badge variant="outline">TE: {teamResult.positionBreakdown.TE}</Badge>
                </div>
              </div>

              {/* Top Players */}
              <div>
                <div className="text-sm font-medium mb-2">Top Picks</div>
                <div className="space-y-1">
                  {teamResult.roster
                    .sort((a, b) => (b.draftCost || 0) - (a.draftCost || 0))
                    .slice(0, 3)
                    .map(player => (
                      <div key={player.id} className="flex justify-between text-xs">
                        <span>{player.name} ({player.position})</span>
                        <span className="font-bold">${player.draftCost}</span>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Draft Statistics */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Draft Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">{results.totalDrafted}</div>
              <div className="text-sm text-muted-foreground">Players Drafted</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">${results.totalSpent.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Spent</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">${Math.round(results.averagePlayerCost)}</div>
              <div className="text-sm text-muted-foreground">Avg Player Cost</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">{teams.length}</div>
              <div className="text-sm text-muted-foreground">Teams</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};