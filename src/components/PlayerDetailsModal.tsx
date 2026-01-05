import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Player, SnakeDraftPlayer } from '@/services/auctionDraftService';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar, 
  Target,
  AlertTriangle,
  Shield,
  Clock,
  Users,
  BarChart3,
  Zap,
  Award,
  Brain,
  DollarSign,
  Gauge
} from 'lucide-react';

interface PlayerDetailsModalProps {
  player: Player | SnakeDraftPlayer | null;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ player, isOpen, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState('overview');
  
  if (!player) return null;

  const isSnakeDraftPlayer = (p: Player | SnakeDraftPlayer): p is SnakeDraftPlayer => {
    return 'breakoutPotential' in p;
  };

  const getRiskColor = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'LOW': return 'text-emerald-600 bg-emerald-50';
      case 'MEDIUM': return 'text-amber-600 bg-amber-50';
      case 'HIGH': return 'text-red-600 bg-red-50';
    }
  };

  const getTrendIcon = (trend: 'RISING' | 'STABLE' | 'DECLINING') => {
    switch (trend) {
      case 'RISING': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'STABLE': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'DECLINING': return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
  };

  const getGradeFromPoints = (points: number, position: string) => {
    const positionAverages = { QB: 180, RB: 160, WR: 150, TE: 120, K: 100, DST: 90 };
    const avg = positionAverages[position as keyof typeof positionAverages] || 150;
    const ratio = points / avg;
    
    if (ratio >= 1.5) return { grade: 'A+', color: 'text-emerald-600' };
    if (ratio >= 1.3) return { grade: 'A', color: 'text-emerald-500' };
    if (ratio >= 1.1) return { grade: 'B+', color: 'text-blue-500' };
    if (ratio >= 0.9) return { grade: 'B', color: 'text-blue-400' };
    if (ratio >= 0.7) return { grade: 'C', color: 'text-amber-500' };
    return { grade: 'D', color: 'text-red-500' };
  };

  const grade = getGradeFromPoints(player.projectedPoints, player.position);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{player.name}</span>
              <Badge variant="outline">{player.position}</Badge>
              <Badge variant="secondary">{player.team}</Badge>
              <Badge className={getRiskColor(player.ageRisk)}>
                Age {player.age}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="w-full">
          <div className="mb-6 flex justify-center">
            <Select value={selectedTab} onValueChange={setSelectedTab}>
              <SelectTrigger className="w-72 h-12 bg-secondary/50 border-border text-base font-medium">
                <SelectValue placeholder="Select view..." />
              </SelectTrigger>
              <SelectContent className="w-72">
                <SelectItem value="overview" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📊</span>
                    <span>Overview & Stats</span>
                  </div>
                </SelectItem>
                <SelectItem value="projections" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎯</span>
                    <span>Projections & Rankings</span>
                  </div>
                </SelectItem>
                <SelectItem value="advanced" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔬</span>
                    <span>Advanced Metrics</span>
                  </div>
                </SelectItem>
                <SelectItem value="situation" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⚡</span>
                    <span>Situational Analysis</span>
                  </div>
                </SelectItem>
                <SelectItem value="insights" className="py-3 px-4 text-base">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🧠</span>
                    <span>Expert Insights</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedTab === "overview" && (<div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Fantasy Grade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${grade.color}`}>{grade.grade}</div>
                  <p className="text-sm text-muted-foreground">{player.projectedPoints} proj. pts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${player.estimatedValue}</div>
                  <p className="text-sm text-muted-foreground">ADP: {player.adp.toFixed(1)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Consistency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{player.consistency}/10</div>
                  <Progress value={player.consistency * 10} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Key Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Target Share</span>
                    <span className="font-medium">{player.targetShare}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Red Zone Share</span>
                    <span className="font-medium">{player.redZoneShare}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Snap %</span>
                    <span className="font-medium">{player.snapPercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">VORP</span>
                    <span className="font-medium">{player.valueOverReplacement}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Injury Risk</span>
                    <Badge className={getRiskColor(player.injuryRisk)}>{player.injuryRisk}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Age Risk</span>
                    <Badge className={getRiskColor(player.ageRisk)}>{player.ageRisk}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Recent Trend</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(player.recentTrends)}
                      <span className="text-sm">{player.recentTrends}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Bye Week</span>
                    <Badge variant="outline">{player.byeWeek}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>)}

          {selectedTab === "projections" && (<div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-600">Ceiling</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{player.upside}</div>
                  <p className="text-sm text-muted-foreground">{player.ceilingWeeks} weeks</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Projection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{player.projectedPoints}</div>
                  <p className="text-sm text-muted-foreground">{player.fantasyRelevantWeeks} relevant weeks</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-600">Floor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{player.floor}</div>
                  <p className="text-sm text-muted-foreground">{player.floorWeeks} weeks</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Season Outlook</CardTitle>
                <CardDescription>Weekly performance expectations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Fantasy Relevant Weeks</span>
                    <span>{player.fantasyRelevantWeeks}/17</span>
                  </div>
                  <Progress value={(player.fantasyRelevantWeeks / 17) * 100} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Floor Weeks</span>
                    <span>{player.floorWeeks}/17</span>
                  </div>
                  <Progress value={(player.floorWeeks / 17) * 100} className="[&>div]:bg-red-500" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ceiling Weeks</span>
                    <span>{player.ceilingWeeks}/17</span>
                  </div>
                  <Progress value={(player.ceilingWeeks / 17) * 100} className="[&>div]:bg-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>)}

          {selectedTab === "advanced" && (<div className="space-y-4">
            {isSnakeDraftPlayer(player) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Breakout Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Breakout Potential</span>
                        <span>{player.breakoutPotential}%</span>
                      </div>
                      <Progress value={player.breakoutPotential} className="[&>div]:bg-emerald-500" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Regression Risk</span>
                        <span>{player.regressionRisk}%</span>
                      </div>
                      <Progress value={player.regressionRisk} className="[&>div]:bg-red-500" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Bust Risk</span>
                        <span>{player.bustRisk}%</span>
                      </div>
                      <Progress value={player.bustRisk} className="[&>div]:bg-amber-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Advanced Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Coaching Fit</span>
                      <span className="font-medium">{player.coachingFit}/10</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Opportunity Rank</span>
                      <span className="font-medium">{player.opportunityRank}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Positional Scarcity</span>
                      <span className="font-medium">{player.positionalScarcity}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Weekly Volatility</span>
                      <span className="font-medium">{player.weeklyVolatility}/10</span>
                    </div>
                    {player.sleeper && (
                      <Badge className="w-full justify-center bg-purple-50 text-purple-700">
                        🌟 SLEEPER ALERT
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Career History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Experience</span>
                  <span className="font-medium">{player.experience} years</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Career Games</span>
                  <span className="font-medium">{player.careerGames}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">2024 Games</span>
                  <span className="font-medium">{player.lastSeasonGames}</span>
                </div>
                {player.injuryHistory.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Injury History:</span>
                    <div className="flex flex-wrap gap-1">
                      {player.injuryHistory.map((injury, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {injury}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>)}

          {selectedTab === "situation" && (<div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">O-Line Rank</span>
                    <span className="font-medium">#{player.offensiveLineRank}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pace Rank</span>
                    <span className="font-medium">#{player.teamPaceRank}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Coaching Stability</span>
                    <Badge variant="outline">{player.coachingStability}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Contract Status</span>
                    <Badge variant="outline">{player.contractStatus}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Competition & Role
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Competition Level</span>
                    <Badge variant="outline">{player.competitionLevel}</Badge>
                  </div>
                  {isSnakeDraftPlayer(player) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Depth Chart</span>
                      <span className="font-medium">#{player.depthChart}</span>
                    </div>
                  )}
                  {player.primaryBackup && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Primary Backup</span>
                      <span className="font-medium">{player.primaryBackup}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Handcuff Value</span>
                    <span className="font-medium">{player.handcuffValue}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Strength of Schedule</span>
                  <span className="font-medium">{player.strengthOfSchedule}/10</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Playoff Schedule</span>
                  <Badge variant="outline">{player.playoffSchedule}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Weather Concerns</span>
                  <Badge variant={player.weatherConcerns ? "destructive" : "secondary"}>
                    {player.weatherConcerns ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Defensive Strength vs Pos</span>
                  <span className="font-medium">#{player.defensiveStrengthVsPosition}</span>
                </div>
              </CardContent>
            </Card>
          </div>)}

          {selectedTab === "insights" && (<div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Key Insights & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {player.recentTrends === 'RISING' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Rising Trend
                    </div>
                    <p className="text-sm text-emerald-600 mt-1">
                      Player is trending upward with improving performance metrics.
                    </p>
                  </div>
                )}

                {isSnakeDraftPlayer(player) && player.sleeper && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-700 font-medium">
                      <Zap className="h-4 w-4" />
                      Sleeper Alert
                    </div>
                    <p className="text-sm text-purple-600 mt-1">
                      High breakout potential ({player.breakoutPotential}%) makes this player a great value pick.
                    </p>
                  </div>
                )}

                {player.injuryRisk === 'HIGH' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Injury Concern
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      High injury risk requires handcuff consideration. Monitor practice reports closely.
                    </p>
                  </div>
                )}

                {isSnakeDraftPlayer(player) && player.handcuffRecommendation !== 'None' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <Shield className="h-4 w-4" />
                      Handcuff Recommendation
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      Consider targeting <strong>{player.handcuffRecommendation}</strong> as a handcuff.
                    </p>
                  </div>
                )}

                {player.consistency >= 8 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <Gauge className="h-4 w-4" />
                      High Floor Player
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      Excellent consistency ({player.consistency}/10) makes this a safe, reliable option.
                    </p>
                  </div>
                )}

                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Draft Strategy</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Target around pick {Math.round(player.adp)}</p>
                    <p>• Value tier: {player.tier}</p>
                    <p>• Best as: {player.tier <= 2 ? 'Starter' : player.tier === 3 ? 'Flex' : 'Bench/Depth'}</p>
                    {isSnakeDraftPlayer(player) && player.positionalScarcity > 50 && (
                      <p>• High positional scarcity - prioritize if need position</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerDetailsModal;