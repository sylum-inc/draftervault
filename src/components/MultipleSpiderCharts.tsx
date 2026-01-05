import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar
} from 'recharts';
import { 
  Target, Shield, Zap, Brain, Activity, TrendingUp,
  Eye, Heart, Clock, Trophy, Users, AlertTriangle
} from 'lucide-react';
import { SnakeDraftPlayer } from '@/services/auctionDraftService';

interface MultipleSpiderChartsProps {
  players: SnakeDraftPlayer[];
  selectedPlayer: SnakeDraftPlayer;
  currentPick: number;
}

export const MultipleSpiderCharts: React.FC<MultipleSpiderChartsProps> = ({
  players,
  selectedPlayer,
  currentPick
}) => {
  const [selectedChart, setSelectedChart] = useState<string>('performance');
  const [comparisonPlayers, setComparisonPlayers] = useState<SnakeDraftPlayer[]>([]);

  // Position-specific Performance Metrics
  const getPerformanceMetrics = (player: SnakeDraftPlayer) => {
    const baseMetrics = [
      {
        metric: 'Opportunity',
        value: Math.floor(player.snapPercentage * 0.8 + player.redZoneShare * 0.2),
        fullMark: 100
      },
      {
        metric: 'Talent',
        value: (player.upside / 3) + (player.consistency * 8),
        fullMark: 100
      },
      {
        metric: 'Health',
        value: player.injuryRisk === 'LOW' ? 85 : player.injuryRisk === 'MEDIUM' ? 60 : 35,
        fullMark: 100
      },
      {
        metric: 'Volume',
        value: Math.floor(player.targetShare * 2.5 + player.redZoneShare * 1.5),
        fullMark: 100
      },
      {
        metric: 'Value',
        value: Math.min(100, Math.max(0, (player.adp - currentPick + 20) * 2)),
        fullMark: 100
      }
    ];

    // Add position-specific 6th metric
    if (player.position === 'QB') {
      baseMetrics.push({
        metric: 'Rushing',
        value: Math.min(100, (player.projectedPoints - 250) / 2),
        fullMark: 100
      });
    } else if (player.position === 'RB') {
      baseMetrics.push({
        metric: 'Goal Line',
        value: player.redZoneShare * 1.2,
        fullMark: 100
      });
    } else if (player.position === 'WR' || player.position === 'TE') {
      baseMetrics.push({
        metric: 'Target Share',
        value: player.targetShare * 2,
        fullMark: 100
      });
    } else if (player.position === 'K') {
      baseMetrics.push({
        metric: 'Team Offense',
        value: ['KC', 'BUF', 'DAL', 'SF'].includes(player.team) ? 90 : 
               ['MIA', 'PHI', 'DET'].includes(player.team) ? 75 : 60,
        fullMark: 100
      });
    } else if (player.position === 'DST') {
      baseMetrics.push({
        metric: 'Turnover Rate',
        value: Math.random() * 40 + 60, // Simplified for demo
        fullMark: 100
      });
    } else {
      baseMetrics.push({
        metric: 'Coaching',
        value: player.coachingStability === 'STABLE' ? 80 : player.coachingStability === 'NEW_COACH' ? 60 : 40,
        fullMark: 100
      });
    }

    return baseMetrics;
  };

  // Risk Analysis Spider Chart
  const getRiskMetrics = (player: SnakeDraftPlayer) => [
    {
      metric: 'Injury Risk',
      value: 100 - (player.injuryRisk === 'LOW' ? 15 : player.injuryRisk === 'MEDIUM' ? 40 : 75),
      fullMark: 100
    },
    {
      metric: 'Age Risk',
      value: 100 - (player.ageRisk === 'LOW' ? 10 : player.ageRisk === 'MEDIUM' ? 35 : 70),
      fullMark: 100
    },
    {
      metric: 'Volatility',
      value: 100 - (player.weeklyVolatility * 10),
      fullMark: 100
    },
    {
      metric: 'Competition',
      value: player.competitionLevel === 'LOCKED_STARTER' ? 90 : 
             player.competitionLevel === 'MINOR_COMPETITION' ? 65 : 35,
      fullMark: 100
    },
    {
      metric: 'Schedule',
      value: 100 - (player.strengthOfSchedule * 15),
      fullMark: 100
    },
    {
      metric: 'Consistency',
      value: player.consistency * 10,
      fullMark: 100
    }
  ];

  // Upside Potential Spider Chart
  const getUpsideMetrics = (player: SnakeDraftPlayer) => [
    {
      metric: 'Breakout',
      value: player.breakoutPotential || 30,
      fullMark: 100
    },
    {
      metric: 'Ceiling',
      value: Math.min(100, (player.upside / player.projectedPoints) * 60),
      fullMark: 100
    },
    {
      metric: 'Young Age',
      value: Math.max(0, 100 - (player.age - 22) * 8),
      fullMark: 100
    },
    {
      metric: 'Opportunity',
      value: Math.floor(player.snapPercentage * 0.9),
      fullMark: 100
    },
    {
      metric: 'Team Context',
      value: player.teamPaceRank <= 10 ? 85 : player.teamPaceRank <= 20 ? 65 : 45,
      fullMark: 100
    },
    {
      metric: 'Sleeper Factor',
      value: player.sleeper ? 85 : 40,
      fullMark: 100
    }
  ];

  // Situation Analysis Spider Chart
  const getSituationMetrics = (player: SnakeDraftPlayer) => [
    {
      metric: 'O-Line',
      value: Math.max(0, 100 - (player.offensiveLineRank * 2.5)),
      fullMark: 100
    },
    {
      metric: 'Coaching',
      value: player.coachingStability === 'STABLE' ? 85 : 55,
      fullMark: 100
    },
    {
      metric: 'Team Pace',
      value: Math.max(0, 100 - (player.teamPaceRank * 2.5)),
      fullMark: 100
    },
    {
      metric: 'Playoff Sch',
      value: player.playoffSchedule === 'EASY' ? 85 : 
             player.playoffSchedule === 'MODERATE' ? 65 : 35,
      fullMark: 100
    },
    {
      metric: 'Weather',
      value: player.weatherConcerns ? 40 : 80,
      fullMark: 100
    },
    {
      metric: 'Contract',
      value: player.contractStatus === 'SECURE' ? 85 : 60,
      fullMark: 100
    }
  ];

  const addComparisonPlayer = (player: SnakeDraftPlayer) => {
    if (comparisonPlayers.length < 3 && !comparisonPlayers.find(p => p.id === player.id)) {
      setComparisonPlayers([...comparisonPlayers, player]);
    }
  };

  const removeComparisonPlayer = (playerId: string) => {
    setComparisonPlayers(comparisonPlayers.filter(p => p.id !== playerId));
  };

  const getPositionColor = (position: string, index: number = 0) => {
    const colors = {
      QB: ['#ef4444', '#dc2626', '#b91c1c'],
      RB: ['#22c55e', '#16a34a', '#15803d'], 
      WR: ['#3b82f6', '#2563eb', '#1d4ed8'],
      TE: ['#f59e0b', '#d97706', '#b45309'],
      K: ['#8b5cf6', '#7c3aed', '#6d28d9'],
      DST: ['#6b7280', '#4b5563', '#374151']
    };
    return colors[position as keyof typeof colors]?.[index] || '#6b7280';
  };

  // Create combined data for comparison chart
  const getComparisonData = () => {
    const baseMetrics = getPerformanceMetrics(selectedPlayer);
    
    return baseMetrics.map((metric) => {
      const result: any = {
        metric: metric.metric,
        [selectedPlayer.name]: metric.value
      };
      
      comparisonPlayers.forEach((compPlayer) => {
        const compMetrics = getPerformanceMetrics(compPlayer);
        const matchingMetric = compMetrics.find(m => m.metric === metric.metric);
        result[compPlayer.name] = matchingMetric?.value || 0;
      });
      
      return result;
    });
  };

  const similarPositionPlayers = players
    .filter(p => p.position === selectedPlayer.position && p.id !== selectedPlayer.id)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Interactive Spider Charts</h3>
          <p className="text-sm text-muted-foreground">Deep dive analysis for {selectedPlayer.name}</p>
        </div>
        <Select value={selectedChart} onValueChange={setSelectedChart}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="performance">Performance Analysis</SelectItem>
            <SelectItem value="risk">Risk Assessment</SelectItem>
            <SelectItem value="upside">Upside Potential</SelectItem>
            <SelectItem value="situation">Situation Context</SelectItem>
            <SelectItem value="comparison">Position Comparison</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={selectedChart} onValueChange={setSelectedChart} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Risk
          </TabsTrigger>
          <TabsTrigger value="upside" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Upside
          </TabsTrigger>
          <TabsTrigger value="situation" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Situation
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Performance Metrics Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={getPerformanceMetrics(selectedPlayer)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      name={selectedPlayer.name}
                      dataKey="value"
                      stroke={getPositionColor(selectedPlayer.position)}
                      fill={getPositionColor(selectedPlayer.position)}
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Risk Assessment Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={getRiskMetrics(selectedPlayer)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      name={selectedPlayer.name}
                      dataKey="value"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <p className="font-semibold">Bust Risk</p>
                  <p className="text-lg">{selectedPlayer.bustRisk}%</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Heart className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                  <p className="font-semibold">Injury Risk</p>
                  <p className="text-lg">{selectedPlayer.injuryRisk}</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Activity className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="font-semibold">Volatility</p>
                  <p className="text-lg">{selectedPlayer.weeklyVolatility}/10</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upside" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Breakout & Upside Potential
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={getUpsideMetrics(selectedPlayer)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      name={selectedPlayer.name}
                      dataKey="value"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center mt-4">
                {selectedPlayer.sleeper && (
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    🚀 Sleeper Alert
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="situation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Situational Context Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={getSituationMetrics(selectedPlayer)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      name={selectedPlayer.name}
                      dataKey="value"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Position Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={getComparisonData()}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar
                        name={selectedPlayer.name}
                        dataKey={selectedPlayer.name}
                        stroke={getPositionColor(selectedPlayer.position, 0)}
                        fill={getPositionColor(selectedPlayer.position, 0)}
                        fillOpacity={0.3}
                        strokeWidth={3}
                      />
                      {comparisonPlayers.map((compPlayer, index) => (
                        <Radar
                          key={compPlayer.id}
                          name={compPlayer.name}
                          dataKey={compPlayer.name}
                          stroke={getPositionColor(compPlayer.position, index + 1)}
                          fill={getPositionColor(compPlayer.position, index + 1)}
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      ))}
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Players to Compare</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {similarPositionPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{player.name}</p>
                        <p className="text-sm text-muted-foreground">{player.team} • ADP: {player.adp}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addComparisonPlayer(player)}
                        disabled={comparisonPlayers.length >= 3 || comparisonPlayers.some(p => p.id === player.id)}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
                
                {comparisonPlayers.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Comparing:</h4>
                    <div className="space-y-1">
                      {comparisonPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between">
                          <span className="text-sm">{player.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeComparisonPlayer(player.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};