import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, Area, AreaChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, Shield, AlertTriangle, Calendar, Users, Zap, Brain } from 'lucide-react';
import { Player } from '@/services/auctionDraftService';
import { nflApiService } from '@/services/nflApiService';

interface AdvancedAnalyticsProps {
  players: Player[];
  draftedPlayers: Player[];
  selectedPlayer?: Player;
}

export const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ 
  players, 
  draftedPlayers, 
  selectedPlayer 
}) => {
  const [injuryData, setInjuryData] = useState<any[]>([]);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [depthCharts, setDepthCharts] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRealTimeData = async () => {
      setLoading(true);
      try {
        const [injuries, weather, depth] = await Promise.all([
          nflApiService.fetchInjuryReport(),
          nflApiService.fetchWeatherData(1), // Current week
          nflApiService.fetchDepthCharts()
        ]);
        
        setInjuryData(injuries);
        setWeatherData(weather);
        setDepthCharts(depth);
      } catch (error) {
        console.error('Error fetching real-time data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRealTimeData();
  }, []);

  const analytics = useMemo(() => {
    const available = players.filter(p => !p.isDrafted);
    const drafted = players.filter(p => p.isDrafted);
    
    // Position scarcity analysis
    const positionScarcity = ['QB', 'RB', 'WR', 'TE'].map(pos => {
      const total = players.filter(p => p.position === pos).length;
      const remaining = available.filter(p => p.position === pos).length;
      const elite = available.filter(p => p.position === pos && p.tier <= 2).length;
      
      return {
        position: pos,
        total,
        remaining,
        elite,
        scarcity: ((total - remaining) / total) * 100,
        eliteScarcity: elite === 0 ? 100 : ((total - remaining) / total) * 100
      };
    });

    // Value distribution
    const valueDistribution = available.map(player => ({
      name: player.name,
      position: player.position,
      value: player.estimatedValue,
      tier: player.tier,
      adp: player.adp || 0,
      vor: player.valueOverReplacement || 0,
      risk: player.injuryRisk === 'HIGH' ? 3 : player.injuryRisk === 'MEDIUM' ? 2 : 1
    }));

    // Tier analysis
    const tierAnalysis = [1, 2, 3, 4].map(tier => {
      const tierPlayers = available.filter(p => p.tier === tier);
      const avgValue = tierPlayers.reduce((sum, p) => sum + p.estimatedValue, 0) / tierPlayers.length || 0;
      
      return {
        tier: `Tier ${tier}`,
        count: tierPlayers.length,
        avgValue: avgValue.toFixed(1),
        positions: {
          QB: tierPlayers.filter(p => p.position === 'QB').length,
          RB: tierPlayers.filter(p => p.position === 'RB').length,
          WR: tierPlayers.filter(p => p.position === 'WR').length,
          TE: tierPlayers.filter(p => p.position === 'TE').length,
        }
      };
    });

    // Risk vs Reward analysis
    const riskReward = available.slice(0, 30).map(player => ({
      name: player.name,
      position: player.position,
      upside: player.upside || player.projectedPoints * 1.2,
      floor: player.floor || player.projectedPoints * 0.8,
      risk: player.injuryRisk === 'HIGH' ? 80 : player.injuryRisk === 'MEDIUM' ? 50 : 20,
      value: player.estimatedValue,
      consistency: player.consistency || 5
    }));

    // Breakout candidates
    const breakoutCandidates = available
      .filter(p => p.age <= 25 && p.experience <= 3)
      .map(player => ({
        name: player.name,
        position: player.position,
        age: player.age,
        experience: player.experience,
        upside: player.upside || 0,
        currentValue: player.estimatedValue,
        potentialValue: (player.upside || 0) * 0.7,
        breakoutScore: Math.random() * 100 // This would be calculated from real metrics
      }))
      .sort((a, b) => b.breakoutScore - a.breakoutScore)
      .slice(0, 10);

    // Injury risk heatmap
    const injuryRisk = players.map(player => ({
      name: player.name,
      position: player.position,
      age: player.age,
      games: player.lastSeasonGames,
      riskScore: player.injuryRisk === 'HIGH' ? 80 : player.injuryRisk === 'MEDIUM' ? 50 : 20,
      historyCount: player.injuryHistory?.length || 0
    }));

    return {
      positionScarcity,
      valueDistribution,
      tierAnalysis,
      riskReward,
      breakoutCandidates,
      injuryRisk
    };
  }, [players, draftedPlayers]);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f'];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Advanced Analytics Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive draft insights and real-time data analysis</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Activity className="w-3 h-3 mr-1" />
            Live Data
          </Badge>
          <Badge variant="outline">{players.filter(p => !p.isDrafted).length} Available</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scarcity">Scarcity</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="breakouts">Breakouts</TabsTrigger>
          <TabsTrigger value="injuries">Injuries</TabsTrigger>
          <TabsTrigger value="weather">Weather</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.positionScarcity.map((pos) => (
              <Card key={pos.position}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{pos.position} Scarcity</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pos.remaining}/{pos.total}</div>
                  <Progress value={pos.scarcity} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {pos.elite} elite players remaining
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Value Distribution by Position</CardTitle>
                <CardDescription>Available players by estimated value</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={analytics.valueDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="adp" label={{ value: 'ADP', position: 'insideBottom', offset: -10 }} />
                    <YAxis dataKey="value" label={{ value: 'Value', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Scatter dataKey="value" fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tier Composition</CardTitle>
                <CardDescription>Remaining players by tier and position</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.tierAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tier" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="positions.QB" stackId="a" fill="#8884d8" />
                    <Bar dataKey="positions.RB" stackId="a" fill="#82ca9d" />
                    <Bar dataKey="positions.WR" stackId="a" fill="#ffc658" />
                    <Bar dataKey="positions.TE" stackId="a" fill="#ff7300" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scarcity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Position Scarcity Timeline</CardTitle>
                <CardDescription>Projected scarcity development</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.positionScarcity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="scarcity" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Elite Player Availability</CardTitle>
                <CardDescription>Remaining elite (Tier 1-2) players</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.positionScarcity}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="elite"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {analytics.positionScarcity.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk vs Reward Analysis</CardTitle>
              <CardDescription>Player upside potential vs injury/regression risk</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={analytics.riskReward}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="risk" label={{ value: 'Risk Score', position: 'insideBottom', offset: -10 }} />
                  <YAxis dataKey="upside" label={{ value: 'Upside Points', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{data.name} ({data.position})</p>
                            <p>Risk Score: {data.risk}</p>
                            <p>Upside: {data.upside}</p>
                            <p>Floor: {data.floor}</p>
                            <p>Consistency: {data.consistency}/10</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter dataKey="upside" fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakouts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Breakout Candidates</CardTitle>
              <CardDescription>Young players with high upside potential</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.breakoutCandidates.map((player, index) => (
                  <div key={player.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {player.position} • Age {player.age} • {player.experience} years exp
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Breakout Score:</span>
                        <span className="font-semibold ml-2">{player.breakoutScore.toFixed(1)}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Potential Value:</span>
                        <span className="font-semibold ml-2">${player.potentialValue.toFixed(0)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="injuries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Injury Risk Matrix</CardTitle>
              <CardDescription>Current injury status and historical risk assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {injuryData.slice(0, 12).map((injury, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">{injury.player}</p>
                      <Badge 
                        variant={injury.status === 'OUT' ? 'destructive' : 
                                injury.status === 'DOUBTFUL' ? 'secondary' : 'outline'}
                      >
                        {injury.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{injury.injury}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weather" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Weather Impact Analysis</CardTitle>
              <CardDescription>Weather conditions affecting player performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {weatherData.slice(0, 9).map((weather, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">Week {weather.week}</p>
                      <Badge 
                        variant={weather.weatherImpact === 'HIGH' ? 'destructive' : 
                                weather.weatherImpact === 'MODERATE' ? 'secondary' : 'outline'}
                      >
                        {weather.weatherImpact}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>Temperature: {weather.temperature}°F</p>
                      <p>Wind: {weather.windSpeed} mph</p>
                      <p>Precipitation: {weather.precipitation}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};