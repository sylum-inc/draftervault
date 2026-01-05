import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AuctionDraftService, Team, Player } from '@/services/auctionDraftService';

interface TeamRosterBuilderProps {
  draftService: AuctionDraftService;
  teams: Team[];
  draftedPlayers: Player[];
}

export const TeamRosterBuilder: React.FC<TeamRosterBuilderProps> = ({ 
  draftService, 
  teams, 
  draftedPlayers 
}) => {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamAnalytics, setTeamAnalytics] = useState<{
    positionNeeds: Record<string, number>;
    valueGrades: Record<string, number>;
    projectedRecord: string;
    strengthScore: number;
  }>({
    positionNeeds: {},
    valueGrades: {},
    projectedRecord: '0-0',
    strengthScore: 0
  });

  useEffect(() => {
    if (selectedTeam) {
      calculateTeamAnalytics();
    }
  }, [selectedTeam, draftedPlayers]);

  const calculateTeamAnalytics = () => {
    if (!selectedTeam) return;

    const teamPlayers = draftedPlayers.filter(p => p.draftedBy === selectedTeam.id);
    
    // Calculate position needs
    const positionCounts = teamPlayers.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const idealCounts = { QB: 2, RB: 4, WR: 5, TE: 2 };
    const positionNeeds = Object.entries(idealCounts).reduce((acc, [pos, ideal]) => {
      const current = positionCounts[pos] || 0;
      acc[pos] = Math.max(0, ideal - current);
      return acc;
    }, {} as Record<string, number>);

    // Calculate value grades
    const valueGrades = teamPlayers.reduce((acc, player) => {
      const grade = draftService.getValueGrade(player.estimatedValue, player.draftCost || 0);
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate strength score
    const totalValue = teamPlayers.reduce((sum, p) => sum + p.estimatedValue, 0);
    const totalCost = teamPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0);
    const valueRatio = totalCost > 0 ? totalValue / totalCost : 1;
    const strengthScore = Math.min(100, Math.round(valueRatio * 75));

    // Simple projected record based on strength
    const wins = Math.round((strengthScore / 100) * 17);
    const losses = 17 - wins;

    setTeamAnalytics({
      positionNeeds,
      valueGrades,
      projectedRecord: `${wins}-${losses}`,
      strengthScore
    });
  };

  const getTeamPlayers = (teamId: string) => {
    return draftedPlayers.filter(p => p.draftedBy === teamId);
  };

  const getPositionColor = (position: string) => {
    const colors = {
      QB: 'bg-yellow-500',
      RB: 'bg-green-500',
      WR: 'bg-blue-500',
      TE: 'bg-purple-500'
    };
    return colors[position as keyof typeof colors] || 'bg-gray-500';
  };

  const getValueGradeColor = (grade: string) => {
    const colors = {
      STEAL: 'text-green-400',
      FAIR: 'text-blue-400',
      REACH: 'text-yellow-400',
      OVERPAY: 'text-red-400'
    };
    return colors[grade as keyof typeof colors] || 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Team Selection Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {teams.map(team => {
          const teamPlayers = getTeamPlayers(team.id);
          const isSelected = selectedTeam?.id === team.id;
          
          return (
            <Card
              key={team.id}
              className={`glass-card cursor-pointer transition-premium hover:transform hover:-translate-y-1 
                ${isSelected ? 'ring-2 ring-primary shadow-glow' : 'hover:shadow-premium'}`}
              onClick={() => setSelectedTeam(team)}
            >
              <CardContent className="p-4 text-center">
                <h3 className="font-bold mb-2">{team.name}</h3>
                <div className="text-sm text-muted-foreground mb-2">
                  {teamPlayers.length} players
                </div>
                <div className="text-lg font-bold text-primary">
                  ${team.remaining}
                </div>
                <div className="text-xs text-muted-foreground">remaining</div>
                <Progress 
                  value={(team.spent / team.budget) * 100} 
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Team Details */}
      {selectedTeam && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Team Overview */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="gradient-text flex items-center gap-2">
                <Award className="w-5 h-5" />
                {selectedTeam.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-secondary/30">
                  <div className="text-2xl font-bold text-primary">{teamAnalytics.strengthScore}</div>
                  <div className="text-sm text-muted-foreground">Team Strength</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/30">
                  <div className="text-2xl font-bold text-accent">{teamAnalytics.projectedRecord}</div>
                  <div className="text-sm text-muted-foreground">Proj. Record</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Draft Grades</h4>
                <div className="space-y-2">
                  {Object.entries(teamAnalytics.valueGrades).map(([grade, count]) => (
                    <div key={grade} className="flex justify-between items-center">
                      <span className={`font-medium ${getValueGradeColor(grade)}`}>{grade}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Position Needs</h4>
                <div className="space-y-2">
                  {Object.entries(teamAnalytics.positionNeeds)
                    .filter(([_, need]) => need > 0)
                    .map(([position, need]) => (
                    <div key={position} className="flex justify-between items-center">
                      <span className="font-medium">{position}</span>
                      <Badge className={getPositionColor(position)}>
                        Need {need}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roster Grid */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Roster
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {getTeamPlayers(selectedTeam.id).length > 0 ? (
                    getTeamPlayers(selectedTeam.id)
                      .sort((a, b) => (a.pickNumber || 0) - (b.pickNumber || 0))
                      .map(player => (
                      <div 
                        key={player.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={`${getPositionColor(player.position)} text-white font-bold`}>
                            {player.position}
                          </Badge>
                          <div>
                            <div className="font-medium">{player.name}</div>
                            <div className="text-sm text-muted-foreground">{player.team}</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-bold">${player.draftCost}</div>
                          <div className="text-sm">
                            <Badge 
                              variant="outline" 
                               className={getValueGradeColor(draftService.getValueGrade(player.estimatedValue, player.draftCost || 0))}
                             >
                               {draftService.getValueGrade(player.estimatedValue, player.draftCost || 0)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No players drafted yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Budget Breakdown */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Budget Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <div className="text-2xl font-bold text-green-400">${selectedTeam.budget}</div>
                    <div className="text-sm text-muted-foreground">Total Budget</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <div className="text-2xl font-bold text-red-400">${selectedTeam.spent}</div>
                    <div className="text-sm text-muted-foreground">Spent</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <div className="text-2xl font-bold text-primary">${selectedTeam.remaining}</div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Budget Used</span>
                    <span className="text-sm font-medium">{Math.round((selectedTeam.spent / selectedTeam.budget) * 100)}%</span>
                  </div>
                  <Progress value={(selectedTeam.spent / selectedTeam.budget) * 100} className="h-3" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};