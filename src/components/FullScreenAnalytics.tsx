import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
// Tabs replaced with Select dropdown
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, TrendingUp, Target, Shield, Star, Activity,
  Calendar, MapPin, Users, Award, AlertTriangle, Brain,
  Zap, Eye, Heart, Clock, Trophy, DollarSign
} from 'lucide-react';
import { SnakeDraftPlayer } from '@/services/auctionDraftService';
import { PlayerPerformanceChart } from './PlayerPerformanceChart';
import { MultipleSpiderCharts } from './MultipleSpiderCharts';
import { generatePlayerHistoricalData } from '@/utils/playerDataGenerator';

interface FullScreenAnalyticsProps {
  player: SnakeDraftPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  currentPick: number;
  allPlayers?: SnakeDraftPlayer[];
}

export const FullScreenAnalytics: React.FC<FullScreenAnalyticsProps> = ({
  player,
  isOpen,
  onClose,
  currentPick,
  allPlayers = []
}) => {
  const [selectedTab, setSelectedTab] = React.useState('overview');
  
  if (!player) return null;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': case 'A': return 'text-green-500';
      case 'B+': case 'B': return 'text-blue-500';
      case 'C+': case 'C': return 'text-yellow-500';
      default: return 'text-red-500';
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk < 25) return 'text-green-500';
    if (risk < 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getValueGrade = () => {
    // HYBRID DRAFT LOGIC: 60 players taken in auction first, snake draft starts at pick 61
    const adjustedCurrentPick = currentPick + 60; // Snake draft pick 1 = overall pick 61
    const adjustedPlayerADP = Math.max(61, player.adp); // Player ADP can't be lower than 61 in snake portion
    
    const diff = adjustedCurrentPick - adjustedPlayerADP;
    
    // Corrected logic for hybrid draft:
    // STEAL: Drafting someone LATER than their adjusted ADP 
    // BAD VALUE: Drafting someone EARLIER than their adjusted ADP
    
    if (diff >= 21) return { grade: 'A+', label: 'STEAL' };
    if (diff >= 11) return { grade: 'A', label: 'GREAT VALUE' };
    if (diff >= 1) return { grade: 'B+', label: 'GOOD VALUE' };
    if (diff >= -5) return { grade: 'B', label: 'FAIR VALUE' };
    if (diff >= -10) return { grade: 'C', label: 'SLIGHT REACH' };
    if (diff >= -30) return { grade: 'D', label: 'BAD VALUE' };
    return { grade: 'F', label: 'TERRIBLE REACH' };
  };

  const valueGrade = getValueGrade();

  const getFantasyGrade = () => {
    const positionMultipliers = { QB: 25, RB: 22, WR: 20, TE: 18, K: 10, DST: 12 };
    const multiplier = positionMultipliers[player.position as keyof typeof positionMultipliers] || 20;
    const expectedPoints = multiplier * (6 - player.tier) + player.upside * 0.3;
    
    if (player.projectedPoints >= expectedPoints * 1.2) return 'A+';
    if (player.projectedPoints >= expectedPoints * 1.1) return 'A';
    if (player.projectedPoints >= expectedPoints) return 'B+';
    if (player.projectedPoints >= expectedPoints * 0.9) return 'B';
    if (player.projectedPoints >= expectedPoints * 0.8) return 'C';
    return 'D';
  };

  const fantasyGrade = getFantasyGrade();
  
  const historicalData = generatePlayerHistoricalData(
    player.name, 
    player.position, 
    player.projectedPoints
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Badge className={
                player.position === 'QB' ? 'bg-red-500' :
                player.position === 'RB' ? 'bg-green-500' :
                player.position === 'WR' ? 'bg-blue-500' :
                player.position === 'TE' ? 'bg-yellow-500' :
                'bg-gray-500'
              }>
                {player.position}
              </Badge>
              <span className="text-2xl font-bold">{player.name}</span>
              {player.sleeper && <Star className="w-6 h-6 text-yellow-400" />}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {player.team}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="w-full">
          <div className="mb-6 flex justify-center">
            <Select value={selectedTab} onValueChange={setSelectedTab}>
              <SelectTrigger className="w-72 h-12 bg-secondary/50 border-border text-base font-medium">
                <SelectValue placeholder="Select analytics view..." />
              </SelectTrigger>
              <SelectContent className="w-72">
                <SelectItem value="overview" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📊</span>
                    <span>Overview & Grades</span>
                  </div>
                </SelectItem>
                <SelectItem value="projections" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎯</span>
                    <span>Projections & Targets</span>
                  </div>
                </SelectItem>
                <SelectItem value="charts" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📈</span>
                    <span>Performance Charts</span>
                  </div>
                </SelectItem>
                <SelectItem value="advanced" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔬</span>
                    <span>Advanced Analytics</span>
                  </div>
                </SelectItem>
                <SelectItem value="situation" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⚡</span>
                    <span>Game Situations</span>
                  </div>
                </SelectItem>
                <SelectItem value="insights" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🧠</span>
                    <span>Expert Insights</span>
                  </div>
                </SelectItem>
                <SelectItem value="comparison" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⚖️</span>
                    <span>Player Comparisons</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedTab === "overview" && (<div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Key Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Fantasy Grade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className={`text-6xl font-bold ${getGradeColor(fantasyGrade)}`}>
                      {fantasyGrade}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Projected Points</span>
                        <span className="font-bold">{player.projectedPoints}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current ADP</span>
                        <span className="font-bold">{player.adp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tier</span>
                        <span className="font-bold">{player.tier}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Value Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Value Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className={`text-4xl font-bold ${getGradeColor(valueGrade.grade)}`}>
                      {valueGrade.grade}
                    </div>
                    <Badge variant={valueGrade.grade.includes('A') ? 'default' : valueGrade.grade.includes('B') ? 'secondary' : 'destructive'}>
                      {valueGrade.label}
                    </Badge>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>ADP vs Pick</span>
                        <span className="font-bold">
                          {currentPick && currentPick > 0 ? 
                            <span className={Math.max(61, player.adp) > (currentPick + 60) ? 'text-green-500' : 'text-red-500'}>
                              {Math.max(61, player.adp) > (currentPick + 60) ? '+' : ''}{Math.max(61, player.adp) - (currentPick + 60)}
                            </span> : 
                            <span className="text-muted-foreground">Auction Mode</span>
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Value Over Replacement</span>
                        <span className="font-bold">{typeof player.valueOverReplacement === 'number' ? player.valueOverReplacement.toFixed(1) : (player.valueOverReplacement || 'N/A')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Risk Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getRiskColor(player.bustRisk)}`}>
                        {player.bustRisk}%
                      </div>
                      <div className="text-sm text-muted-foreground">Bust Risk</div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Floor</span>
                          <span className="text-sm font-bold">{typeof player.floor === 'number' ? player.floor.toFixed(1) : player.floor}</span>
                        </div>
                        <Progress value={player.floor} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Ceiling</span>
                          <span className="text-sm font-bold">{typeof player.upside === 'number' ? player.upside.toFixed(1) : player.upside}</span>
                        </div>
                        <Progress value={player.upside} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Consistency</span>
                          <span className="text-sm font-bold">{typeof player.bustRisk === 'number' ? (100 - player.bustRisk).toFixed(0) : (100 - (player.bustRisk || 20)).toFixed(0)}%</span>
                        </div>
                        <Progress value={100 - player.bustRisk} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{player.age}</div>
                  <div className="text-sm text-muted-foreground">Age</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{player.experience}</div>
                  <div className="text-sm text-muted-foreground">Years Exp</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{player.byeWeek}</div>
                  <div className="text-sm text-muted-foreground">Bye Week</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{player.snapPercentage}%</div>
                  <div className="text-sm text-muted-foreground">Snap Share</div>
                </CardContent>
              </Card>
            </div>
          </div>)}

          {selectedTab === "projections" && (<div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Season Projections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-500">{typeof player.upside === 'number' ? player.upside.toFixed(1) : player.upside}</div>
                      <div className="text-sm text-muted-foreground">Ceiling</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{player.projectedPoints}</div>
                      <div className="text-sm text-muted-foreground">Projection</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-500">{typeof player.floor === 'number' ? player.floor.toFixed(1) : player.floor}</div>
                      <div className="text-sm text-muted-foreground">Floor</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Weekly Average</span>
                      <span className="font-bold">{(player.projectedPoints / 17).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Games Played</span>
                      <span className="font-bold">{17 - Math.floor(player.bustRisk / 10)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Top 12 Weeks</span>
                      <span className="font-bold">{Math.floor(12 - player.bustRisk / 10)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Red Zone Share</span>
                        <span className="font-bold">{player.redZoneShare}%</span>
                      </div>
                      <Progress value={player.redZoneShare} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Target Share</span>
                        <span className="font-bold">{Math.min(100, player.redZoneShare + 10)}%</span>
                      </div>
                      <Progress value={Math.min(100, player.redZoneShare + 10)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Snap Share</span>
                        <span className="font-bold">{player.snapPercentage}%</span>
                      </div>
                      <Progress value={player.snapPercentage} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>)}

          {selectedTab === "charts" && (<div className="space-y-6">
            {/* Multiple Interactive Spider Charts */}
            <MultipleSpiderCharts 
              players={allPlayers}
              selectedPlayer={player}
              currentPick={currentPick}
            />
          </div>)}

          {selectedTab === "advanced" && (<div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Advanced Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Breakout Potential</span>
                      <span className={`font-bold ${player.sleeper ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {player.sleeper ? 'HIGH' : 'MODERATE'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coaching Fit</span>
                      <span className="font-bold">{player.coachingStability}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Opportunity Score</span>
                      <span className="font-bold">{Math.floor(player.snapPercentage * 0.8 + player.redZoneShare * 0.2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Efficiency Rating</span>
                      <span className="font-bold">{Math.floor(player.projectedPoints / Math.max(1, player.snapPercentage) * 100)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Market Trends
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Recent Trend</span>
                      <Badge variant={
                        player.recentTrends === 'RISING' ? 'default' :
                        player.recentTrends === 'DECLINING' ? 'destructive' : 'secondary'
                      }>
                        {player.recentTrends}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>ADP Movement</span>
                      <span className={`font-bold ${player.recentTrends === 'RISING' ? 'text-green-500' : 'text-red-500'}`}>
                        {player.recentTrends === 'RISING' ? '+5' : player.recentTrends === 'DECLINING' ? '-8' : '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expert Consensus</span>
                      <span className="font-bold">
                        {player.tier <= 2 ? 'BUY' : player.tier <= 4 ? 'HOLD' : 'FADE'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>)}

          {selectedTab === "situation" && (<div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Offensive Rating</span>
                      <span className="font-bold">
                        {['TB', 'KC', 'BUF', 'DAL', 'SF'].includes(player.team) ? 'Elite' :
                         ['MIA', 'LAC', 'DET', 'PHI'].includes(player.team) ? 'Above Avg' : 'Average'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coaching Stability</span>
                      <span className="font-bold">{player.coachingStability}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Competition Level</span>
                      <span className="font-bold">
                        {player.snapPercentage > 80 ? 'Low' : player.snapPercentage > 60 ? 'Moderate' : 'High'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Schedule Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Strength of Schedule</span>
                      <span className="font-bold">
                        {Math.random() > 0.5 ? 'Favorable' : 'Challenging'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Playoff Schedule</span>
                      <span className="font-bold">
                        {Math.random() > 0.6 ? 'Excellent' : 'Good'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Home Games</span>
                      <span className="font-bold">9</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>)}

          {selectedTab === "insights" && (<div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Draft Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/10 rounded-lg border-l-4 border-blue-500">
                    <div className="font-bold text-blue-600 mb-2">Strategic Value</div>
                    <p className="text-sm">
                      {valueGrade.label === 'STEAL' ? 
                        `${player.name} is falling significantly below ADP and represents excellent value at this pick. This is a tier 1-2 player available later than expected.` :
                        valueGrade.label === 'GREAT VALUE' ?
                        `Strong value pick - ${player.name} is being drafted ${player.adp - currentPick} spots later than typical ADP suggests.` :
                        `${player.name} is being drafted around market value. Consider team needs and upside potential.`
                      }
                    </p>
                  </div>

                  {player.sleeper && (
                    <div className="p-4 bg-yellow-500/10 rounded-lg border-l-4 border-yellow-500">
                      <div className="font-bold text-yellow-600 mb-2">Breakout Candidate</div>
                      <p className="text-sm">
                        Identified as a potential breakout player with high upside. Consider the risk/reward profile for your team construction strategy.
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-green-500/10 rounded-lg border-l-4 border-green-500">
                    <div className="font-bold text-green-600 mb-2">Handcuff Recommendation</div>
                    <p className="text-sm">
                      {player.handcuffRecommendation !== 'None' ? 
                        player.handcuffRecommendation :
                        'No specific handcuff recommendations for this player.'
                      }
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-secondary/30 rounded">
                      <div className="font-medium mb-1">Best Case Scenario</div>
                      <p className="text-sm text-muted-foreground">
                        Stays healthy, maintains role, exceeds projections
                      </p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded">
                      <div className="font-medium mb-1">Risk Factors</div>
                      <p className="text-sm text-muted-foreground">
                        {player.bustRisk > 50 ? 'Injury history, competition, age' : 'Limited competition and stable role'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>)}

          {selectedTab === "comparison" && (<div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Position Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4" />
                  <p>Position comparison charts would be displayed here</p>
                  <p className="text-sm">Compare against other {player.position}s in similar tiers</p>
                </div>
              </CardContent>
            </Card>
          </div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
};