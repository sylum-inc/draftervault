import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Area, AreaChart, PieChart, Pie
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, BarChart3, Activity, Target, DollarSign, Users, 
  Zap, AlertTriangle, Trophy, Timer, Brain
} from 'lucide-react';
import { Player, Team } from '@/services/auctionDraftService';

interface AdvancedDraftChartsProps {
  players: Player[];
  teams: Team[];
  draftedPlayers: Player[];
}

export const AdvancedDraftCharts: React.FC<AdvancedDraftChartsProps> = ({
  players,
  teams,
  draftedPlayers
}) => {
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');

  // Generate comprehensive analytics data
  const generateValueVsADPData = () => {
    return players.map(player => ({
      name: player.name,
      adp: player.adp,
      value: player.estimatedValue,
      difference: player.estimatedValue - (200 - player.adp * 2),
      position: player.position,
      tier: player.tier
    })).filter(p => selectedPosition === 'ALL' || p.position === selectedPosition);
  };

  const generatePositionScarcityData = () => {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    return positions.map(pos => {
      const posPlayers = players.filter(p => p.position === pos);
      const available = posPlayers.filter(p => !p.isDrafted).length;
      const drafted = posPlayers.filter(p => p.isDrafted).length;
      const avgValue = posPlayers.reduce((sum, p) => sum + p.estimatedValue, 0) / posPlayers.length;
      const topTier = posPlayers.filter(p => p.tier <= 2 && !p.isDrafted).length;
      
      return {
        position: pos,
        available,
        drafted,
        total: posPlayers.length,
        avgValue: avgValue.toFixed(0),
        topTierLeft: topTier,
        scarcityScore: (drafted / posPlayers.length) * 100
      };
    });
  };

  const generateTeamValueData = () => {
    return teams.map(team => {
      const teamPlayers = draftedPlayers.filter(p => p.draftedBy === team.id);
      const totalValue = teamPlayers.reduce((sum, p) => sum + p.estimatedValue, 0);
      const totalSpent = teamPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0);
      const efficiency = totalSpent > 0 ? (totalValue / totalSpent) * 100 : 0;
      
      return {
        team: team.name,
        value: totalValue,
        spent: totalSpent,
        efficiency: efficiency.toFixed(1),
        remaining: team.remaining,
        players: teamPlayers.length
      };
    });
  };

  const generateRiskRewardData = () => {
    return players.map(player => ({
      name: player.name,
      upside: player.upside,
      floor: player.floor,
      risk: player.injuryRisk === 'HIGH' ? 80 : player.injuryRisk === 'MEDIUM' ? 50 : 20,
      value: player.estimatedValue,
      position: player.position,
      consistency: player.consistency * 10
    })).filter(p => selectedPosition === 'ALL' || p.position === selectedPosition);
  };

  const generateTierDistributionData = () => {
    const tiers = [1, 2, 3, 4];
    return tiers.map(tier => {
      const tierPlayers = players.filter(p => p.tier === tier);
      const available = tierPlayers.filter(p => !p.isDrafted).length;
      const drafted = tierPlayers.filter(p => p.isDrafted).length;
      
      return {
        tier: `Tier ${tier}`,
        available,
        drafted,
        total: tierPlayers.length,
        percentage: available / tierPlayers.length * 100
      };
    });
  };

  const generateWeeklyProjectionsData = () => {
    // Simulate weekly projections for next 4 weeks
    return Array.from({ length: 4 }, (_, i) => ({
      week: `Week ${i + 1}`,
      QB: Math.floor(Math.random() * 30) + 15,
      RB: Math.floor(Math.random() * 25) + 10,
      WR: Math.floor(Math.random() * 25) + 8,
      TE: Math.floor(Math.random() * 15) + 5
    }));
  };

  const valueVsADPData = generateValueVsADPData();
  const positionScarcityData = generatePositionScarcityData();
  const teamValueData = generateTeamValueData();
  const riskRewardData = generateRiskRewardData();
  const tierDistributionData = generateTierDistributionData();
  const weeklyProjectionsData = generateWeeklyProjectionsData();

  const getPositionColor = (position: string) => {
    const colors = {
      QB: '#ef4444',
      RB: '#22c55e', 
      WR: '#3b82f6',
      TE: '#f59e0b'
    };
    return colors[position as keyof typeof colors] || '#6b7280';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Draft Analytics</h2>
          <p className="text-muted-foreground">Comprehensive data insights and market analysis</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Positions</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="value-analysis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="value-analysis">Value Analysis</TabsTrigger>
          <TabsTrigger value="position-scarcity">Scarcity</TabsTrigger>
          <TabsTrigger value="team-efficiency">Team Efficiency</TabsTrigger>
          <TabsTrigger value="risk-reward">Risk/Reward</TabsTrigger>
          <TabsTrigger value="market-trends">Trends</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
        </TabsList>

        <TabsContent value="value-analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Value vs ADP Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart data={valueVsADPData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="adp" 
                        name="ADP"
                        label={{ value: 'Average Draft Position', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        dataKey="value" 
                        name="Value"
                        label={{ value: 'Estimated Value', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-semibold">{data.name}</p>
                                <p className="text-sm text-muted-foreground">{data.position} • Tier {data.tier}</p>
                                <p>ADP: {data.adp}</p>
                                <p>Value: ${data.value}</p>
                                <p className={`font-semibold ${data.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Diff: {data.difference > 0 ? '+' : ''}${data.difference.toFixed(0)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter dataKey="value" fill="#8b5cf6" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Tier Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tier" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="available" stackId="a" fill="#22c55e" name="Available" />
                      <Bar dataKey="drafted" stackId="a" fill="#ef4444" name="Drafted" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="position-scarcity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Position Scarcity Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={positionScarcityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="available" fill="#22c55e" name="Available" />
                    <Bar yAxisId="left" dataKey="drafted" fill="#ef4444" name="Drafted" />
                    <Line yAxisId="right" type="monotone" dataKey="scarcityScore" stroke="#8b5cf6" strokeWidth={3} name="Scarcity %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-4">
                {positionScarcityData.map((pos) => (
                  <div key={pos.position} className="text-center p-3 bg-muted rounded-lg">
                    <h4 className="font-semibold">{pos.position}</h4>
                    <p className="text-sm text-muted-foreground">Top Tier Left: {pos.topTierLeft}</p>
                    <Badge variant={pos.scarcityScore > 60 ? 'destructive' : pos.scarcityScore > 30 ? 'default' : 'secondary'}>
                      {pos.scarcityScore.toFixed(0)}% Drafted
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team-efficiency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Team Draft Efficiency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamValueData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="team" type="category" width={80} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'efficiency' ? `${value}%` : `$${value}`,
                        name === 'efficiency' ? 'Efficiency' : name === 'value' ? 'Total Value' : 'Spent'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#22c55e" name="Total Value" />
                    <Bar dataKey="spent" fill="#ef4444" name="Amount Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk-reward" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Risk vs Reward Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart data={riskRewardData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="risk" 
                      name="Risk"
                      label={{ value: 'Risk Level', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      dataKey="upside" 
                      name="Upside"
                      label={{ value: 'Upside Potential', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold">{data.name}</p>
                              <p className="text-sm text-muted-foreground">{data.position}</p>
                              <p>Upside: {data.upside} pts</p>
                              <p>Floor: {data.floor} pts</p>
                              <p>Risk Level: {data.risk}</p>
                              <p>Consistency: {data.consistency}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter dataKey="upside">
                      {riskRewardData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getPositionColor(entry.position)} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market-trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Draft Velocity by Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={positionScarcityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="position" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="scarcityScore" 
                        stroke="#8b5cf6" 
                        fill="#8b5cf6" 
                        fillOpacity={0.3}
                        name="Draft Rate %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Value Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tierDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ tier, percentage }) => `${tier}: ${percentage.toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="percentage"
                      >
                        {tierDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 90}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="w-5 h-5 mr-2" />
                Weekly Projections by Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyProjectionsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="QB" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="RB" stroke="#22c55e" strokeWidth={2} />
                    <Line type="monotone" dataKey="WR" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="TE" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};