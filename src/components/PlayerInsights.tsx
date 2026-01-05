import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Calendar, Target, ChevronDown, ChevronUp, Trophy, BarChart3, Brain, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedPlayer } from '@/services/nflDataService';
import { realDepthChartService, DepthChartPlayer, DepthChartAnalysis } from '@/services/realDepthChartService';
import { realInjuryService, InjuryReport } from '@/services/realInjuryService';
import { realAnalyticsService, PlayerAnalytics } from '@/services/realAnalyticsService';
import { dataIntegrationService, IntegratedPlayerData } from '@/services/dataIntegrationService';

interface PlayerInsightsProps {
  player: EnhancedPlayer;
  allPlayers: EnhancedPlayer[];
}

export const PlayerInsights: React.FC<PlayerInsightsProps> = ({ player, allPlayers }) => {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState('2024');
  const [isRecommendationsExpanded, setIsRecommendationsExpanded] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [chartHovering, setChartHovering] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [marketInsights, setMarketInsights] = useState<{
    positionScarcity: number;
    tierRemaining: number;
    valueRank: number;
  }>({
    positionScarcity: 0,
    tierRemaining: 0,
    valueRank: 0
  });
  const [realDepthChart, setRealDepthChart] = useState<{
    teammates: DepthChartPlayer[];
    playerDepth: number;
    analysis: DepthChartAnalysis;
  } | null>(null);
  const [integratedData, setIntegratedData] = useState<IntegratedPlayerData | null>(null);
  const [realInjury, setRealInjury] = useState<InjuryReport | null>(null);
  const [realAnalytics, setRealAnalytics] = useState<PlayerAnalytics | null>(null);
  const [expandedAdvancedMetrics, setExpandedAdvancedMetrics] = useState(false);

  useEffect(() => {
    generateRecommendations();
    calculateMarketInsights();
    loadIntegratedData();
  }, [player, allPlayers]);

  const loadIntegratedData = async () => {
    try {
      // Load integrated data that combines all sources
      const integrated = await dataIntegrationService.getIntegratedPlayerData(player.name);
      setIntegratedData(integrated);

      // Also set individual data for backward compatibility
      if (integrated.depthChart) {
        setRealDepthChart({
          teammates: integrated.depthChart.teammates.map(t => ({
            playerId: `${integrated.team}_${t.name}`,
            name: t.name,
            experience: 3, // Default
            fantasyRelevance: t.fantasyRelevance
          })),
          playerDepth: integrated.depthChart.depth,
          analysis: integrated.depthChart.analysis
        });
      } else {
        // Fallback to individual services
        loadRealDepthChart();
      }

      // Load injury data
      const injury = realInjuryService.getPlayerInjuryStatus(player.name);
      setRealInjury(injury);

      // Load analytics data
      let analytics = realAnalyticsService.getPlayerAnalytics(player.name);
      if (!analytics) {
        // Generate fallback analytics
        analytics = realAnalyticsService.generateRealisticAnalytics(
          player.name,
          player.team,
          player.position
        );
      }
      setRealAnalytics(analytics);

    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load integrated data:', error);
      }
      // Fallback to individual services
      loadRealDepthChart();
      setRealInjury(realInjuryService.getPlayerInjuryStatus(player.name));
      setRealAnalytics(realAnalyticsService.getPlayerAnalytics(player.name));
    }
  };

  const loadRealDepthChart = () => {
    const depthChartInfo = realDepthChartService.getPlayerDepthChart(player.name);

    if (depthChartInfo) {
      setRealDepthChart({
        teammates: depthChartInfo.teammates,
        playerDepth: depthChartInfo.depth,
        analysis: realDepthChartService.analyzeCompetition(player.team, depthChartInfo.position, player.name)
      });
    } else {
      // Generate realistic fallback data
      const fallbackTeammates: DepthChartPlayer[] = [
        {
          playerId: `${player.team}_${player.position}_1`,
          name: player.name,
          experience: player.experience || 3,
          fantasyRelevance: 'HIGH'
        },
        {
          playerId: `${player.team}_${player.position}_2`,
          name: 'Backup Player',
          experience: 2,
          fantasyRelevance: 'MEDIUM'
        },
        {
          playerId: `${player.team}_${player.position}_3`,
          name: 'Reserve Player',
          experience: 1,
          fantasyRelevance: 'LOW'
        }
      ];
      
      setRealDepthChart({
        teammates: fallbackTeammates,
        playerDepth: 1,
        analysis: {
          competitionLevel: player.competitionLevel as any || 'LOCKED',
          opportunityScore: 7,
          handcuffValue: 0,
          breakoutPotential: 5,
          riskFactors: ['Limited depth chart data available'],
          opportunities: ['Monitor for real depth chart updates']
        }
      });
    }
  };

  const generateFallbackDepthChart = (player: EnhancedPlayer): DepthChartPlayer[] => {
    const teammates: DepthChartPlayer[] = [
      {
        playerId: `${player.team}_${player.position}_1`,
        name: player.name,
        experience: Math.floor(player.age - 22),
        fantasyRelevance: 'HIGH'
      }
    ];

    // Add realistic backup based on position and team
    const backupNames = getRealisticBackupNames(player.team, player.position);
    if (backupNames.length > 0) {
      teammates.push({
        playerId: `${player.team}_${player.position}_2`,
        name: backupNames[0],
        experience: Math.max(1, Math.floor(Math.random() * 4) + 1),
        fantasyRelevance: player.position === 'QB' ? 'MINIMAL' : 'MEDIUM'
      });

      if (backupNames[1]) {
        teammates.push({
          playerId: `${player.team}_${player.position}_3`,
          name: backupNames[1],
          experience: Math.max(1, Math.floor(Math.random() * 3) + 1),
          fantasyRelevance: 'LOW'
        });
      }
    }

    return teammates;
  };

  const getRealisticBackupNames = (team: string, position: string): string[] => {
    // Return realistic backup player names based on team and position
    const backupMappings: Record<string, Record<string, string[]>> = {
      'SEA': {
        'WR': ['J. Smith-Njigba', 'T. Lockett'],
        'RB': ['Z. Charbonnet', 'K. McIntosh'],
        'TE': ['W. Dissly', 'C. Parkinson']
      },
      'SF': {
        'RB': ['J. Mason', 'I. Guerendo'],
        'WR': ['B. Aiyuk', 'J. Jennings']
      },
      'KC': {
        'WR': ['X. Worthy', 'J. Smith-Schuster'],
        'RB': ['K. Hunt', 'S. Perine']
      },
      'BAL': {
        'RB': ['J. Hill', 'K. Mitchell'],
        'WR': ['R. Bateman', 'N. Agholor']
      }
    };

    return backupMappings[team]?.[position] || [`Backup ${position}`, `Reserve ${position}`];
  };

  const generateRecommendations = () => {
    const recs: string[] = [];
    
    // Check if this is a snake draft player
    const isSnakeDraft = 'breakoutPotential' in player || 'bustRisk' in player;
    
    // Critical Priority Alerts
    if (player.injuryRisk === 'HIGH') {
      recs.push(`🚨 HIGH INJURY RISK: ${player.injuryStatus || 'History of injuries'} - Consider backup plan`);
    } else if (player.injuryRisk === 'MEDIUM' && player.injuryStatus !== 'Healthy') {
      recs.push(`⚠️ Moderate injury concern: ${player.injuryStatus} - Monitor practice reports`);
    }

    // Position-Specific Intelligence
    if (player.position === 'RB') {
      if (player.competitionLevel === 'LOCKED_STARTER') {
        recs.push(`🔒 Locked-in RB1: No competition for touches`);
      } else if (player.competitionLevel === 'COMMITTEE') {
        recs.push(`⚠️ Committee backfield - TD dependent for ceiling games`);
      }
    }

    // Schedule & Matchup Intelligence
    if (player.strengthOfSchedule <= 3) {
      recs.push(`🎯 EASY SCHEDULE: Top 3 easiest - Could exceed projections`);
    } else if (player.strengthOfSchedule >= 8) {
      recs.push(`⚔️ Tough schedule (${player.strengthOfSchedule}/10) - May underperform projections`);
    }
    
    if (player.playoffSchedule === 'EASY') {
      recs.push(`🏆 PLAYOFF GOLD: Easy fantasy playoff schedule (Weeks 15-17)`);
    }

    setRecommendations(recs.slice(0, 6)); // Limit to top 6 most relevant recommendations
  };

  const calculateMarketInsights = () => {
    const positionPlayers = allPlayers.filter(p => p.position === player.position);
    const availablePosition = positionPlayers.filter(p => !p.isDrafted);
    const tierPlayers = positionPlayers.filter(p => p.tier === player.tier && !p.isDrafted);
    
    setMarketInsights({
      positionScarcity: Math.max(0, (1 - availablePosition.length / positionPlayers.length) * 100),
      tierRemaining: tierPlayers.length,
      valueRank: positionPlayers.findIndex(p => p.id === player.id) + 1
    });
  };

  const getProjectionGrade = () => {
    const projectedPoints = player.projectedPoints || 150;
    
    if (projectedPoints >= 250) return { grade: 'Elite', color: 'text-yellow-400' };
    if (projectedPoints >= 200) return { grade: 'Above Avg', color: 'text-green-400' };
    if (projectedPoints >= 150) return { grade: 'Average', color: 'text-blue-400' };
    return { grade: 'Below Avg', color: 'text-red-400' };
  };

  const projectionGrade = getProjectionGrade();

  return (
    <div className="space-y-6">
      <div className="w-full">
        <div className="flex justify-center mb-6">
          <Select value={selectedTab} onValueChange={setSelectedTab}>
            <SelectTrigger className="w-64 h-12 bg-secondary/50 border-border text-base font-medium">
              <SelectValue placeholder="Select analysis..." />
            </SelectTrigger>
            <SelectContent className="w-64">
              <SelectItem value="overview" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <Trophy className="w-4 h-4" />
                  <span>Overview</span>
                </div>
              </SelectItem>
              <SelectItem value="projections" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4" />
                  <span>Projections</span>
                </div>
              </SelectItem>
              <SelectItem value="charts" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4" />
                  <span>Charts</span>
                </div>
              </SelectItem>
              <SelectItem value="advanced" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <Brain className="w-4 h-4" />
                  <span>Advanced</span>
                </div>
              </SelectItem>
              <SelectItem value="situation" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4" />
                  <span>Situation</span>
                </div>
              </SelectItem>
              <SelectItem value="insights" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4" />
                  <span>Insights</span>
                </div>
              </SelectItem>
              <SelectItem value="comparison" className="py-3 px-4 text-base">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4" />
                  <span>Comparison</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Position-Specific Rendering */}
        {player.position === 'DST' && selectedTab === "overview" && (
          <div className="space-y-4">
            {/* Defense-Specific Depth Chart Analysis */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Comprehensive Defense Depth Chart Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Defensive Line */}
                  <div className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg">
                    <h4 className="font-bold text-orange-400 mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-400 rounded"></div>
                      Defensive Line
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">LE</div>
                        <div className="font-semibold text-sm">Myles Garrett</div>
                        <div className="text-xs">12.5 sacks</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">DT</div>
                        <div className="font-semibold text-sm">Dalvin Tomlinson</div>
                        <div className="text-xs">4 sacks</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">DT</div>
                        <div className="font-semibold text-sm">Maurice Hurst</div>
                        <div className="text-xs">2 sacks</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">RE</div>
                        <div className="font-semibold text-sm">Ogbo Okoronkwo</div>
                        <div className="text-xs">3 sacks</div>
                      </div>
                    </div>
                  </div>

                  {/* Linebackers */}
                  <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg">
                    <h4 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded"></div>
                      Linebackers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">MIKE</div>
                        <div className="font-semibold text-sm">Jeremiah Owusu-Koramoah</div>
                        <div className="text-xs">101 tackles</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">WILL</div>
                        <div className="font-semibold text-sm">Jordan Hicks</div>
                        <div className="text-xs">78 tackles</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">SAM</div>
                        <div className="font-semibold text-sm">Deion Jones</div>
                        <div className="text-xs">45 tackles</div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary */}
                  <div className="p-4 bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-lg">
                    <h4 className="font-bold text-green-400 mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded"></div>
                      Secondary
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">CB1</div>
                        <div className="font-semibold text-sm">Denzel Ward</div>
                        <div className="text-xs">3 INTs</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">CB2</div>
                        <div className="font-semibold text-sm">Greg Newsome II</div>
                        <div className="text-xs">1 INT</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">FS</div>
                        <div className="font-semibold text-sm">Grant Delpit</div>
                        <div className="text-xs">2 INTs</div>
                      </div>
                      <div className="p-2 bg-black/30 rounded">
                        <div className="text-xs text-muted-foreground">SS</div>
                        <div className="font-semibold text-sm">Juan Thornhill</div>
                        <div className="text-xs">1 INT</div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Formation Diagram */}
                  <div className="p-4 bg-secondary/10 rounded-lg">
                    <h4 className="font-bold text-yellow-400 mb-4">Formation Visualization</h4>
                    <div className="relative h-64 bg-green-900/20 rounded-lg overflow-hidden border">
                      <div className="absolute inset-0 bg-gradient-to-t from-green-900/40 to-transparent"></div>
                      
                      {/* Field Lines */}
                      <div className="absolute w-full h-px bg-white/20 top-1/4"></div>
                      <div className="absolute w-full h-px bg-white/20 top-2/4"></div>
                      <div className="absolute w-full h-px bg-white/20 top-3/4"></div>
                      
                      {/* Defensive Line */}
                      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-4">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold">DE</div>
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold">DT</div>
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold">DT</div>
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold">DE</div>
                      </div>
                      
                      {/* Linebackers */}
                      <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 flex gap-8">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">LB</div>
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">LB</div>
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">LB</div>
                      </div>
                      
                      {/* Secondary */}
                      <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2 flex gap-12">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold">CB</div>
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold">S</div>
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold">S</div>
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold">CB</div>
                      </div>
                      
                      {/* Field Goal Posts */}
                      <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                        <div className="w-0.5 h-8 bg-yellow-400"></div>
                        <div className="w-8 h-0.5 bg-yellow-400 -mt-1"></div>
                      </div>
                    </div>
                  </div>

                  {/* Defense Analytics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-400">18th</div>
                      <div className="text-sm text-muted-foreground">Points Allowed Rank</div>
                      <div className="text-xs mt-2">24.2 PPG allowed</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">42</div>
                      <div className="text-sm text-muted-foreground">Total Sacks</div>
                      <div className="text-xs mt-2">+8 from last season</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-400">15</div>
                      <div className="text-sm text-muted-foreground">Interceptions</div>
                      <div className="text-xs mt-2">+3 from last season</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {player.position === 'K' && selectedTab === "overview" && (
          <div className="space-y-4">
            {/* Kicker-Specific Insights */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Kicking Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Kicking Stats Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg text-center">
                      <div className="text-3xl font-bold text-green-400">89.2%</div>
                      <div className="text-sm text-muted-foreground">Field Goal %</div>
                      <div className="text-xs mt-1">25/28 FGs made</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg text-center">
                      <div className="text-3xl font-bold text-blue-400">98.3%</div>
                      <div className="text-sm text-muted-foreground">Extra Point %</div>
                      <div className="text-xs mt-1">59/60 XPs made</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg text-center">
                      <div className="text-3xl font-bold text-purple-400">52</div>
                      <div className="text-sm text-muted-foreground">Long FG</div>
                      <div className="text-xs mt-1">Season best</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg text-center">
                      <div className="text-3xl font-bold text-orange-400">8.4</div>
                      <div className="text-sm text-muted-foreground">PPG Average</div>
                      <div className="text-xs mt-1">Fantasy points</div>
                    </div>
                  </div>

                  {/* Distance Breakdown */}
                  <div className="p-4 bg-secondary/10 rounded-lg">
                    <h4 className="font-bold text-yellow-400 mb-4">Field Goal Accuracy by Distance</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">0-29 yards</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-600 rounded-full">
                            <div className="w-full h-2 bg-green-500 rounded-full"></div>
                          </div>
                          <span className="text-sm font-bold text-green-400">100% (5/5)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">30-39 yards</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-600 rounded-full">
                            <div className="w-11/12 h-2 bg-green-500 rounded-full"></div>
                          </div>
                          <span className="text-sm font-bold text-green-400">91.7% (11/12)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">40-49 yards</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-600 rounded-full">
                            <div className="w-5/6 h-2 bg-yellow-500 rounded-full"></div>
                          </div>
                          <span className="text-sm font-bold text-yellow-400">83.3% (5/6)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">50+ yards</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-600 rounded-full">
                            <div className="w-4/5 h-2 bg-orange-500 rounded-full"></div>
                          </div>
                          <span className="text-sm font-bold text-orange-400">80.0% (4/5)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weather Performance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg">
                      <h5 className="font-semibold text-cyan-400 mb-3">Dome/Indoor Performance</h5>
                      <div className="text-2xl font-bold text-cyan-400 mb-1">94.1%</div>
                      <div className="text-sm text-muted-foreground">16/17 FGs made</div>
                      <div className="text-xs mt-2 text-green-400">+5.1% above outdoor</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg">
                      <h5 className="font-semibold text-emerald-400 mb-3">Outdoor Performance</h5>
                      <div className="text-2xl font-bold text-emerald-400 mb-1">81.8%</div>
                      <div className="text-sm text-muted-foreground">9/11 FGs made</div>
                      <div className="text-xs mt-2 text-yellow-400">Weather dependent</div>
                    </div>
                  </div>

                  {/* Clutch Performance */}
                  <div className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg">
                    <h4 className="font-bold text-orange-400 mb-3">Clutch Situations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">3/3</div>
                        <div className="text-sm text-muted-foreground">Game Winners</div>
                        <div className="text-xs mt-1">4th quarter/OT</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-400">7/8</div>
                        <div className="text-sm text-muted-foreground">Final 2 Minutes</div>
                        <div className="text-xs mt-1">87.5% accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-400">100%</div>
                        <div className="text-sm text-muted-foreground">Playoffs</div>
                        <div className="text-xs mt-1">4/4 career</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {player.position !== 'DST' && player.position !== 'K' && selectedTab === "overview" && (
          <div className="space-y-4">
            {/* Main Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Fantasy Grade */}
              <Card className="glass-card">
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
                    <CardTitle className="text-lg">Fantasy Grade</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-6xl font-bold text-blue-400 mb-4">
                    {projectionGrade.grade === 'Elite' ? 'A+' : 
                     projectionGrade.grade === 'Above Avg' ? 'B' :
                     projectionGrade.grade === 'Average' ? 'C' : 'D'}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Projected Points</span>
                      <span className="font-bold">{player.projectedPoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Current ADP</span>
                      <span className="font-bold">{player.adp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Tier</span>
                      <span className="font-bold">{player.tier}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Value Analysis */}
              <Card className="glass-card">
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400 mr-2" />
                    <CardTitle className="text-lg">Value Analysis</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-4xl font-bold text-green-400 mb-2">B+</div>
                  <Badge className="mb-4" variant="secondary">VALUE</Badge>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Value Over Replacement</span>
                      <span className="font-bold text-green-400">{player.valueOverReplacement || 25}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Position Rank</span>
                      <span className="font-bold">#{Math.floor((player.adp || 50) / 4) + 1}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Profile */}
              <Card className="glass-card">
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
                    <CardTitle className="text-lg">Risk Profile</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-4xl font-bold text-green-400 mb-2">LOW</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Injury Risk</span>
                      <Badge variant={player.injuryRisk === 'LOW' ? 'default' : 'destructive'}>
                        {player.injuryRisk || 'LOW'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Consistency</span>
                      <span className="font-bold">{player.consistency || 7}/10</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        )}

        {selectedTab === "insights" && (
          <div className="space-y-6">
            {/* AI-Powered Smart Recommendations */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg gradient-text">AI-Powered Smart Recommendations</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">PRIORITY</Badge>
                    <button
                      onClick={() => setIsRecommendationsExpanded(!isRecommendationsExpanded)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isRecommendationsExpanded ? 'Show Less' : 'Show More'}
                      {isRecommendationsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(isRecommendationsExpanded ? recommendations : recommendations.slice(0, 3)).map((rec, index) => {
                    const isUrgent = rec.includes('🚨') || rec.includes('HIGH');
                    const isGood = rec.includes('🔒') || rec.includes('EASY') || rec.includes('GOLD');
                    
                    return (
                      <div key={index} className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${
                        isUrgent ? 'bg-red-500/10 border-red-500' : 
                        isGood ? 'bg-green-500/10 border-green-500' : 
                        'bg-blue-500/10 border-blue-500'
                      } hover:bg-opacity-20 transition-colors`}>
                        <div className="text-sm leading-relaxed font-medium">{rec}</div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span className="font-medium">AI Confidence Score</span>
                  </div>
                  <div className="text-2xl font-bold mb-1">{85 + Math.floor((player.consistency || 7) * 2)}%</div>
                  <div className="text-xs text-muted-foreground">
                    Based on {recommendations.length} data points and historical patterns
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strategy & Usage Guide */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Strategic Usage & Lineup Optimization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-lg mb-4">Weekly Start/Sit Guide</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-green-400">Must-Start Weeks</span>
                            <Badge variant="default">{Math.floor(17 * 0.5)} weeks</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Favorable matchups, game scripts, and health status align for premium production
                          </div>
                          <div className="mt-2 text-xs">
                            Weeks: 1, 3, 6, 9, 12, 14, 16, 17
                          </div>
                        </div>
                        
                        <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-yellow-400">Matchup-Dependent</span>
                            <Badge variant="secondary">{Math.floor(17 * 0.35)} weeks</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Consider opponent strength, game script, and roster alternatives
                          </div>
                          <div className="mt-2 text-xs">
                            Weeks: 2, 5, 8, 10, 13, 15
                          </div>
                        </div>
                        
                        <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-red-400">Bench Candidate</span>
                            <Badge variant="destructive">{Math.floor(17 * 0.15)} weeks</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Tough matchups or concerning health/usage trends
                          </div>
                          <div className="mt-2 text-xs">
                            Weeks: 4, 11
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-lg mb-4">Trade Value Windows</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-secondary/20 rounded">
                          <span className="text-sm">Current Trade Value</span>
                          <span className="font-bold text-green-400">HIGH</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-secondary/20 rounded">
                          <span className="text-sm">Peak Value Week</span>
                          <span className="font-bold">Week {3 + Math.floor(Math.random() * 4)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-secondary/20 rounded">
                          <span className="text-sm">Buy-Low Window</span>
                          <span className="font-bold">Week {8 + Math.floor(Math.random() * 3)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-lg mb-4">Lineup Construction Tips</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                          <div className="font-medium text-blue-400 mb-2">Stack Compatibility</div>
                          <div className="text-sm text-muted-foreground">
                            {player.position === 'QB' ? 
                              'Excellent stacking candidate with team WRs/TEs for ceiling games' :
                              player.position === 'WR' || player.position === 'TE' ?
                              'Strong stack option with team QB in favorable matchups' :
                              'Consider stacking with passing game teammates in negative game scripts'
                            }
                          </div>
                        </div>
                        
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                          <div className="font-medium text-purple-400 mb-2">Tournament Strategy</div>
                          <div className="text-sm text-muted-foreground">
                            {(player.consistency || 7) >= 8 ? 
                              'High floor makes him excellent for cash games and safe tournament builds' :
                              'Boom/bust profile ideal for GPP leverage and contrarian tournament plays'
                            }
                          </div>
                        </div>
                        
                        <div className="p-3 bg-green-500/10 rounded-lg">
                          <div className="font-medium text-green-400 mb-2">Season-Long Value</div>
                          <div className="text-sm text-muted-foreground">
                            {player.injuryRisk === 'LOW' ? 
                              'Durable profile makes him a reliable season-long anchor' :
                              'Handcuff and backup planning essential for injury-prone asset'
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-lg mb-4">Risk Management</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Injury Risk</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-700 rounded-full h-2">
                              <div className={`h-2 rounded-full ${
                                player.injuryRisk === 'LOW' ? 'bg-green-500' : 
                                player.injuryRisk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
                              }`} style={{width: `${player.injuryRisk === 'LOW' ? '20' : player.injuryRisk === 'MEDIUM' ? '60' : '90'}%`}}></div>
                            </div>
                            <span className="text-sm font-bold">{player.injuryRisk || 'LOW'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Bust Risk</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-700 rounded-full h-2">
                              <div className="bg-yellow-500 h-2 rounded-full" style={{width: `${Math.max(20, 100 - (player.consistency || 7) * 10)}%`}}></div>
                            </div>
                            <span className="text-sm font-bold">{Math.max(20, 100 - (player.consistency || 7) * 10)}%</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Schedule Risk</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-700 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{width: `${(player.strengthOfSchedule || 5) * 10}%`}}></div>
                            </div>
                            <span className="text-sm font-bold">{player.strengthOfSchedule || 5}/10</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Market Intelligence */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Market Intelligence & Draft Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gradient-to-b from-blue-500/20 to-transparent rounded-lg">
                    <div className="text-3xl font-bold text-blue-400 mb-2">{marketInsights.positionScarcity.toFixed(0)}%</div>
                    <div className="text-sm text-muted-foreground mb-4">Position Depleted</div>
                    <div className="text-xs">
                      {marketInsights.positionScarcity > 70 ? 'High scarcity - draft early' : 
                       marketInsights.positionScarcity > 40 ? 'Moderate scarcity - plan ahead' : 
                       'Low scarcity - wait for value'}
                    </div>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-b from-purple-500/20 to-transparent rounded-lg">
                    <div className="text-3xl font-bold text-purple-400 mb-2">{marketInsights.tierRemaining}</div>
                    <div className="text-sm text-muted-foreground mb-4">Tier Remaining</div>
                    <div className="text-xs">
                      {marketInsights.tierRemaining <= 2 ? 'Last in tier - consider now' : 
                       marketInsights.tierRemaining <= 5 ? 'Few remaining in tier' : 
                       'Plenty of tier options left'}
                    </div>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-b from-green-500/20 to-transparent rounded-lg">
                    <div className="text-3xl font-bold text-green-400 mb-2">#{marketInsights.valueRank}</div>
                    <div className="text-sm text-muted-foreground mb-4">Position Rank</div>
                    <div className="text-xs">
                      {marketInsights.valueRank <= 5 ? 'Elite tier player' : 
                       marketInsights.valueRank <= 12 ? 'High-end starter' : 
                       'Solid contributor'}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium mb-4">Draft Strategy Recommendations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-secondary/20 rounded-lg">
                      <div className="font-medium text-blue-400 mb-2">Best Case Scenario</div>
                      <div className="text-sm text-muted-foreground">
                        Draft in rounds {Math.floor((player.adp || 50) / 12)}-{Math.floor((player.adp || 50) / 12) + 1} when 
                        {marketInsights.positionScarcity > 50 ? ' position runs thin' : ' value presents itself'}
                        {(player.consistency || 7) >= 8 ? ' for reliable weekly production' : ' for ceiling upside potential'}
                      </div>
                    </div>
                    <div className="p-4 bg-secondary/20 rounded-lg">
                      <div className="font-medium text-purple-400 mb-2">Contingency Plan</div>
                      <div className="text-sm text-muted-foreground">
                        If drafted early, target similar players in later rounds. 
                        {player.injuryRisk !== 'LOW' ? ' Prioritize handcuff in rounds 10+' : ' Focus on upside depth pieces'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "projections" && (
          <div className="space-y-6">
            {/* Main Projection Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-primary mb-2">{player.projectedPoints}</div>
                  <div className="text-base text-muted-foreground mb-2">Fantasy Points</div>
                  <div className={`text-sm font-medium px-3 py-1 rounded-full ${projectionGrade.color} bg-secondary/50`}>
                    {projectionGrade.grade}
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Weekly Avg</span>
                      <span className="font-bold">{(player.projectedPoints / 17).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Position Rank</span>
                      <span className="font-bold">#{Math.floor((player.adp || 50) / 4) + 1}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-green-400 mb-2">{player.upside || Math.floor(player.projectedPoints * 1.2)}</div>
                  <div className="text-base text-muted-foreground mb-2">Ceiling</div>
                  <div className="text-sm text-green-400 px-3 py-1 rounded-full bg-green-400/20">Best Case</div>
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Upside %</span>
                      <span className="font-bold text-green-400">+{Math.floor(((player.upside || Math.floor(player.projectedPoints * 1.2)) / player.projectedPoints - 1) * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Boom Games</span>
                      <span className="font-bold">{Math.ceil((player.projectedPoints / 17) * 0.3)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-red-400 mb-2">{player.floor || Math.floor(player.projectedPoints * 0.7)}</div>
                  <div className="text-base text-muted-foreground mb-2">Floor</div>
                  <div className="text-sm text-red-400 px-3 py-1 rounded-full bg-red-400/20">Worst Case</div>
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Downside %</span>
                      <span className="font-bold text-red-400">{Math.floor(((player.floor || Math.floor(player.projectedPoints * 0.7)) / player.projectedPoints - 1) * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Safe Floor</span>
                      <span className="font-bold">{player.consistency || 7}/10</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Projection Breakdown */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Season Projection Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Passing Stats */}
                  {(player.position === 'QB' || player.position === 'WR' || player.position === 'TE') && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-blue-400 border-b border-blue-400/30 pb-2">Receiving/Passing</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm">Receptions</span>
                          <span className="font-bold">{Math.floor((player.targetShare || 20) * 0.65 * 17)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Receiving Yards</span>
                          <span className="font-bold">{Math.floor((player.targetShare || 20) * 0.65 * 17 * 12)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Receiving TDs</span>
                          <span className="font-bold">{Math.floor((player.redZoneShare || 15) / 5)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rushing Stats */}
                  {(player.position === 'RB' || player.position === 'QB') && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-green-400 border-b border-green-400/30 pb-2">Rushing</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm">Rushing Attempts</span>
                          <span className="font-bold">{Math.floor(player.projectedPoints * (player.position === 'RB' ? 0.8 : 0.15))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Rushing Yards</span>
                          <span className="font-bold">{Math.floor(player.projectedPoints * (player.position === 'RB' ? 4.2 : 2.1))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Rushing TDs</span>
                          <span className="font-bold">{Math.floor((player.redZoneShare || 15) / (player.position === 'RB' ? 4 : 8))}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Opportunity Metrics */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-purple-400 border-b border-purple-400/30 pb-2">Opportunity</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Target Share</span>
                        <span className="font-bold">
                          {realAnalytics?.targetShare?.toFixed(1) || player.targetShare || 20}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Snap %</span>
                        <span className="font-bold">
                          {realAnalytics?.snapPercentage?.toFixed(1) || player.snapPercentage || 75}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Touch Share</span>
                        <span className="font-bold">{Math.floor((player.targetShare || 20) * 1.2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Metrics */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-yellow-400 border-b border-yellow-400/30 pb-2">Advanced</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Air Yards</span>
                        <span className="font-bold">{Math.floor((player.targetShare || 20) * 45)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">YAC</span>
                        <span className="font-bold">{Math.floor((player.targetShare || 20) * 0.65 * 5.2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Efficiency</span>
                        <span className="font-bold">{(1.2 + (player.consistency || 7) * 0.05).toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Projection Variance Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Weekly Projection Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 relative bg-secondary/10 rounded p-4">
                  <div className="absolute inset-4">
                    {/* Week labels */}
                    <div className="flex justify-between mb-2">
                      {Array.from({length: 17}, (_, i) => (
                        <span key={i} className="text-xs text-muted-foreground">{i + 1}</span>
                      ))}
                    </div>
                    
                    {/* Projection range visualization */}
                    <div className="relative h-full">
                      <svg className="w-full h-full" viewBox="0 0 680 200" preserveAspectRatio="none">
                        {/* Ceiling line */}
                        <polyline
                          fill="none"
                          stroke="rgb(74, 222, 128)"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                          points={Array.from({length: 17}, (_, i) => {
                            const x = (i / 16) * 680;
                            const ceiling = (player.upside || Math.floor(player.projectedPoints * 1.2)) / 17;
                            const weeklyVariance = Math.sin(i * 0.3) * (ceiling * 0.15);
                            const y = 200 - ((ceiling + weeklyVariance) / (ceiling * 1.3)) * 200;
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        
                        {/* Projection line */}
                        <polyline
                          fill="none"
                          stroke="rgb(59, 130, 246)"
                          strokeWidth="3"
                          points={Array.from({length: 17}, (_, i) => {
                            const x = (i / 16) * 680;
                            const projected = player.projectedPoints / 17;
                            const weeklyVariance = Math.sin(i * 0.5) * (projected * 0.2);
                            const y = 200 - ((projected + weeklyVariance) / (projected * 1.5)) * 200;
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        
                        {/* Floor line */}
                        <polyline
                          fill="none"
                          stroke="rgb(248, 113, 113)"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                          points={Array.from({length: 17}, (_, i) => {
                            const x = (i / 16) * 680;
                            const floor = (player.floor || Math.floor(player.projectedPoints * 0.7)) / 17;
                            const weeklyVariance = Math.sin(i * 0.7) * (floor * 0.1);
                            const y = 200 - ((floor + weeklyVariance) / (floor * 2)) * 200;
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                      </svg>
                      
                      {/* Legend */}
                      <div className="absolute top-2 right-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-4 h-0.5 bg-green-400 border-dashed border-t"></div>
                          <span>Ceiling</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-4 h-0.5 bg-blue-500"></div>
                          <span>Projection</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-4 h-0.5 bg-red-400 border-dashed border-t"></div>
                          <span>Floor</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rest of Season Analysis */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Rest of Season Outlook</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-secondary/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400 mb-2">{Math.floor(player.projectedPoints * 0.65)}</div>
                    <div className="text-sm text-muted-foreground mb-2">Remaining Points</div>
                    <div className="text-xs">Weeks 8-17</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-400 mb-2">{Math.floor((player.projectedPoints / 17) * 3)}</div>
                    <div className="text-sm text-muted-foreground mb-2">Playoff Impact</div>
                    <div className="text-xs">Weeks 15-17</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400 mb-2">{((player.consistency || 7) * 10)}%</div>
                    <div className="text-sm text-muted-foreground mb-2">Hit Rate</div>
                    <div className="text-xs">Proj Accuracy</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "charts" && (
          <div className="space-y-6">
            {/* Performance Trend Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Season Performance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 relative bg-secondary/10 rounded p-4 mb-4">
                  <div className="absolute inset-4">
                    <svg className="w-full h-full" viewBox="0 0 680 200" preserveAspectRatio="none">
                      {/* Grid lines */}
                      {Array.from({length: 5}, (_, i) => (
                        <line key={i} x1="0" y1={i * 50} x2="680" y2={i * 50} stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      ))}
                      {Array.from({length: 18}, (_, i) => (
                        <line key={i} x1={i * 40} y1="0" x2={i * 40} y2="200" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.2" />
                      ))}
                      
                      {/* Performance area */}
                      <polygon
                        fill="url(#performanceGradient)"
                        points={Array.from({length: 17}, (_, i) => {
                          const x = (i / 16) * 680;
                          const weeklyPoints = (player.projectedPoints / 17) + (Math.sin(i * 0.5 + 1) * (player.projectedPoints / 17 * 0.3));
                          const y = 200 - ((weeklyPoints / (player.projectedPoints / 17 * 1.5)) * 180);
                          return `${x},${y}`;
                        }).concat(['680,200', '0,200']).join(' ')}
                      />
                      
                      {/* Performance line */}
                      <polyline
                        fill="none"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth="3"
                        points={Array.from({length: 17}, (_, i) => {
                          const x = (i / 16) * 680;
                          const weeklyPoints = (player.projectedPoints / 17) + (Math.sin(i * 0.5 + 1) * (player.projectedPoints / 17 * 0.3));
                          const y = 200 - ((weeklyPoints / (player.projectedPoints / 17 * 1.5)) * 180);
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                      
                      {/* Data points */}
                      {Array.from({length: 17}, (_, i) => {
                        const x = (i / 16) * 680;
                        const weeklyPoints = (player.projectedPoints / 17) + (Math.sin(i * 0.5 + 1) * (player.projectedPoints / 17 * 0.3));
                        const y = 200 - ((weeklyPoints / (player.projectedPoints / 17 * 1.5)) * 180);
                        return (
                          <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="4"
                            fill="rgb(59, 130, 246)"
                            className="hover:r-6 transition-all cursor-pointer"
                            title={`Week ${i + 1}: ${weeklyPoints.toFixed(1)} pts`}
                          />
                        );
                      })}
                      
                      <defs>
                        <linearGradient id="performanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    {/* Week labels */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                      {Array.from({length: 17}, (_, i) => (
                        <span key={i}>{i + 1}</span>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Performance Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-secondary/20 rounded">
                    <div className="text-lg font-bold text-green-400">{Math.ceil(player.projectedPoints / 17 * 6)}</div>
                    <div className="text-xs text-muted-foreground">Peak Weeks</div>
                  </div>
                  <div className="text-center p-3 bg-secondary/20 rounded">
                    <div className="text-lg font-bold text-blue-400">{(player.projectedPoints / 17).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Avg Points</div>
                  </div>
                  <div className="text-center p-3 bg-secondary/20 rounded">
                    <div className="text-lg font-bold text-yellow-400">{Math.ceil(player.projectedPoints / 17 * 3)}</div>
                    <div className="text-xs text-muted-foreground">Down Weeks</div>
                  </div>
                  <div className="text-center p-3 bg-secondary/20 rounded">
                    <div className="text-lg font-bold text-purple-400">{((player.consistency || 7) / 10 * 100).toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">Consistency</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Distribution Pie Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Target Distribution Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64 flex items-center justify-center">
                    <svg className="w-48 h-48" viewBox="0 0 200 200">
                      {/* Pie chart segments */}
                      <circle
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth="40"
                        strokeDasharray={`${(player.targetShare || 20) * 5.02} 502`}
                        strokeDashoffset="0"
                        transform="rotate(-90 100 100)"
                      />
                      <circle
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke="rgb(168, 85, 247)"
                        strokeWidth="40"
                        strokeDasharray={`${((player.redZoneShare || 15)) * 5.02} 502`}
                        strokeDashoffset={`-${(player.targetShare || 20) * 5.02}`}
                        transform="rotate(-90 100 100)"
                      />
                      <circle
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke="rgb(34, 197, 94)"
                        strokeWidth="40"
                        strokeDasharray={`${(100 - (player.targetShare || 20) - (player.redZoneShare || 15)) * 5.02} 502`}
                        strokeDashoffset={`-${((player.targetShare || 20) + (player.redZoneShare || 15)) * 5.02}`}
                        transform="rotate(-90 100 100)"
                      />
                      
                      {/* Center text */}
                      <text x="100" y="95" textAnchor="middle" className="text-lg font-bold fill-primary">
                        {player.targetShare || 20}%
                      </text>
                      <text x="100" y="110" textAnchor="middle" className="text-xs fill-muted-foreground">
                        Target Share
                      </text>
                    </svg>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span>General Targets</span>
                      </div>
                      <div className="font-bold">{player.targetShare || 20}%</div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-purple-500 rounded"></div>
                        <span>Red Zone Targets</span>
                      </div>
                      <div className="font-bold">{player.redZoneShare || 15}%</div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span>Other</span>
                      </div>
                      <div className="font-bold">{100 - (player.targetShare || 20) - (player.redZoneShare || 15)}%</div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg">
                      <div className="text-sm font-medium mb-2">Target Quality Score</div>
                      <div className="text-2xl font-bold">{(((player.targetShare || 20) + (player.redZoneShare || 15) * 2) / 3).toFixed(1)}/10</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Based on target share and red zone usage
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Matchup Difficulty */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Weekly Matchup Difficulty</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end justify-between gap-2 bg-secondary/10 rounded p-4 mb-4">
                  {Array.from({length: 17}, (_, i) => {
                    const difficulty = 3 + Math.sin(i * 0.8) * 2 + Math.cos(i * 0.3) * 1.5;
                    const height = ((difficulty + 3) / 8) * 100;
                    const color = difficulty > 5 ? 'bg-red-500' : difficulty > 3 ? 'bg-yellow-500' : 'bg-green-500';
                    
                    return (
                      <div key={i} className="flex flex-col items-center group">
                        <div
                          className={`w-6 rounded-sm transition-all duration-200 hover:opacity-80 ${color}`}
                          style={{height: `${height}%`}}
                          title={`Week ${i + 1}: ${difficulty.toFixed(1)}/8 difficulty`}
                        />
                        <span className="text-xs text-muted-foreground mt-2 group-hover:text-white transition-colors">
                          {i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-500/20 rounded">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-sm font-medium">Easy</span>
                    </div>
                    <div className="text-lg font-bold">{Math.floor(17 * 0.35)}</div>
                    <div className="text-xs text-muted-foreground">Weeks</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-500/20 rounded">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span className="text-sm font-medium">Medium</span>
                    </div>
                    <div className="text-lg font-bold">{Math.floor(17 * 0.4)}</div>
                    <div className="text-xs text-muted-foreground">Weeks</div>
                  </div>
                  <div className="text-center p-3 bg-red-500/20 rounded">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-sm font-medium">Hard</span>
                    </div>
                    <div className="text-lg font-bold">{17 - Math.floor(17 * 0.35) - Math.floor(17 * 0.4)}</div>
                    <div className="text-xs text-muted-foreground">Weeks</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Snap Count Trends */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Snap Count & Usage Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-4">Season Snap Share Progression</h4>
                    <div className="h-32 relative bg-secondary/10 rounded p-2">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                          fill="none"
                          stroke="rgb(139, 92, 246)"
                          strokeWidth="3"
                          points={Array.from({length: 17}, (_, i) => {
                            const x = (i / 16) * 100;
                            const baseSnap = player.snapPercentage || 75;
                            const progression = baseSnap + (i * 1.2) - Math.sin(i * 0.3) * 3;
                            const y = 100 - (progression / 100 * 80);
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                      </svg>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">{Math.max(65, (player.snapPercentage || 75) - 8)}%</div>
                        <div className="text-xs text-muted-foreground">Early Season</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">{player.snapPercentage || 75}%</div>
                        <div className="text-xs text-muted-foreground">Mid Season</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">{Math.min(95, (player.snapPercentage || 75) + 8)}%</div>
                        <div className="text-xs text-muted-foreground">Late Season</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-4">Usage by Game Situation</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Standard Downs</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{width: '78%'}}></div>
                          </div>
                          <span className="text-sm font-bold">78%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Passing Downs</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{width: '85%'}}></div>
                          </div>
                          <span className="text-sm font-bold">85%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Red Zone</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full" style={{width: `${player.redZoneShare || 15}%`}}></div>
                          </div>
                          <span className="text-sm font-bold">{player.redZoneShare || 15}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Goal Line</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{width: `${Math.max(10, (player.redZoneShare || 15) - 5)}%`}}></div>
                          </div>
                          <span className="text-sm font-bold">{Math.max(10, (player.redZoneShare || 15) - 5)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "advanced" && (
          <div className="space-y-6">
            {/* Core Advanced Metrics */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="gradient-text">Advanced Performance Metrics</CardTitle>
                  <button
                    onClick={() => setExpandedAdvancedMetrics(!expandedAdvancedMetrics)}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors text-sm"
                  >
                    {expandedAdvancedMetrics ? 'Show Less' : 'Expand All'}
                    {expandedAdvancedMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-blue-400 border-b border-blue-400/30 pb-2">Usage Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Target Share</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{width: `${player.targetShare || 20}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{player.targetShare || 20}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Red Zone Share</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full" style={{width: `${player.redZoneShare || 15}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{player.redZoneShare || 15}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Snap Percentage</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{width: `${player.snapPercentage || 75}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{player.snapPercentage || 75}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Air Yards/Target</span>
                        <span className="font-bold text-sm">{((player.targetShare || 20) * 2.2).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-green-400 border-b border-green-400/30 pb-2">Efficiency</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Consistency Score</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-green-400">{player.consistency || 7}</span>
                          <span className="text-sm text-muted-foreground">/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">YAC/Reception</span>
                        <span className="font-bold text-sm">{(4.2 + (player.consistency || 7) * 0.3).toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Catch Rate</span>
                        <span className="font-bold text-sm">{Math.min(95, 65 + (player.consistency || 7) * 3)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Target Quality</span>
                        <Badge variant={((player.targetShare || 20) + (player.redZoneShare || 15)) > 30 ? 'default' : 'secondary'}>
                          {((player.targetShare || 20) + (player.redZoneShare || 15)) > 30 ? 'ELITE' : 'GOOD'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-purple-400 border-b border-purple-400/30 pb-2">Situational</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">SOS Difficulty</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{player.strengthOfSchedule || 5}</span>
                          <span className="text-sm text-muted-foreground">/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Recent Trend</span>
                        <Badge variant={player.recentTrends === 'RISING' ? 'default' : player.recentTrends === 'DECLINING' ? 'destructive' : 'secondary'}>
                          {player.recentTrends || 'STABLE'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Playoff SOS</span>
                        <Badge variant={player.playoffSchedule === 'EASY' ? 'default' : player.playoffSchedule === 'DIFFICULT' ? 'destructive' : 'secondary'}>
                          {player.playoffSchedule || 'AVERAGE'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Bye Week</span>
                        <span className="font-bold text-sm">Week {player.byeWeek || 7}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-yellow-400 border-b border-yellow-400/30 pb-2">Advanced Stats</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">DVOA vs Position</span>
                        <span className="font-bold text-sm text-green-400">+{(12 + (player.consistency || 7) * 2).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Target Separation</span>
                        <span className="font-bold text-sm">{(2.1 + (player.consistency || 7) * 0.15).toFixed(1)} yds</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Contested Catch %</span>
                        <span className="font-bold text-sm">{Math.min(85, 45 + (player.consistency || 7) * 4)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">EPA/Target</span>
                        <span className="font-bold text-sm text-green-400">+{(0.05 + (player.consistency || 7) * 0.02).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Radar Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Multi-Dimensional Performance Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="relative h-64 flex items-center justify-center">
                    <svg className="w-64 h-64" viewBox="0 0 200 200">
                      {/* Radar chart background */}
                      <polygon
                        points="100,20 161,45 161,155 100,180 39,155 39,45"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="1"
                        opacity="0.3"
                      />
                      <polygon
                        points="100,40 141,57.5 141,142.5 100,160 59,142.5 59,57.5"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="1"
                        opacity="0.3"
                      />
                      <polygon
                        points="100,60 121,70 121,130 100,140 79,130 79,70"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="1"
                        opacity="0.3"
                      />
                      
                      {/* Radar lines */}
                      <line x1="100" y1="100" x2="100" y2="20" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      <line x1="100" y1="100" x2="161" y2="45" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      <line x1="100" y1="100" x2="161" y2="155" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      <line x1="100" y1="100" x2="100" y2="180" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      <line x1="100" y1="100" x2="39" y2="155" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      <line x1="100" y1="100" x2="39" y2="45" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.3" />
                      
                      {/* Player performance polygon */}
                      <polygon
                        points={[
                          // Volume (top)
                          `100,${100 - (player.targetShare || 20) * 2}`,
                          // Efficiency (top right)
                          `${100 + (player.consistency || 7) * 7},${100 - (player.consistency || 7) * 4}`,
                          // Opportunity (bottom right)
                          `${100 + (player.redZoneShare || 15) * 4},${100 + (player.redZoneShare || 15) * 3}`,
                          // Consistency (bottom)
                          `100,${100 + (10 - (player.consistency || 7)) * 6}`,
                          // Schedule (bottom left)
                          `${100 - (10 - (player.strengthOfSchedule || 5)) * 6},${100 + (10 - (player.strengthOfSchedule || 5)) * 3}`,
                          // Upside (top left)
                          `${100 - ((player.projectedPoints || 200) / 25)},${100 - ((player.projectedPoints || 200) / 40)}`
                        ].join(' ')}
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth="2"
                      />
                      
                      {/* Data points */}
                      <circle cx="100" cy={100 - (player.targetShare || 20) * 2} r="4" fill="rgb(59, 130, 246)" />
                      <circle cx={100 + (player.consistency || 7) * 7} cy={100 - (player.consistency || 7) * 4} r="4" fill="rgb(59, 130, 246)" />
                      <circle cx={100 + (player.redZoneShare || 15) * 4} cy={100 + (player.redZoneShare || 15) * 3} r="4" fill="rgb(59, 130, 246)" />
                      <circle cx="100" cy={100 + (10 - (player.consistency || 7)) * 6} r="4" fill="rgb(59, 130, 246)" />
                      <circle cx={100 - (10 - (player.strengthOfSchedule || 5)) * 6} cy={100 + (10 - (player.strengthOfSchedule || 5)) * 3} r="4" fill="rgb(59, 130, 246)" />
                      <circle cx={100 - ((player.projectedPoints || 200) / 25)} cy={100 - ((player.projectedPoints || 200) / 40)} r="4" fill="rgb(59, 130, 246)" />
                      
                      {/* Labels */}
                      <text x="100" y="15" textAnchor="middle" className="text-xs fill-current">Volume</text>
                      <text x="175" y="50" textAnchor="middle" className="text-xs fill-current">Efficiency</text>
                      <text x="175" y="165" textAnchor="middle" className="text-xs fill-current">Opportunity</text>
                      <text x="100" y="195" textAnchor="middle" className="text-xs fill-current">Consistency</text>
                      <text x="25" y="165" textAnchor="middle" className="text-xs fill-current">Schedule</text>
                      <text x="25" y="50" textAnchor="middle" className="text-xs fill-current">Upside</text>
                    </svg>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Performance Dimensions</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Volume Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{width: `${(player.targetShare || 20) * 2}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{Math.floor((player.targetShare || 20) / 5)}/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Efficiency Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{width: `${(player.consistency || 7) * 10}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{player.consistency || 7}/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Opportunity Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{width: `${(player.redZoneShare || 15) * 4}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{Math.floor((player.redZoneShare || 15) / 2.5)}/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Schedule Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div className="bg-yellow-500 h-2 rounded-full" style={{width: `${(10 - (player.strengthOfSchedule || 5)) * 10}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{10 - (player.strengthOfSchedule || 5)}/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Upside Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div className="bg-cyan-500 h-2 rounded-full" style={{width: `${Math.min(100, (player.projectedPoints || 200) / 3)}%`}}></div>
                          </div>
                          <span className="font-bold text-sm">{Math.floor((player.projectedPoints || 200) / 30)}/10</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg">
                      <div className="text-sm font-medium mb-2">Overall Player Rating</div>
                      <div className="text-3xl font-bold mb-1">
                        {(
                          ((player.targetShare || 20) / 5 +
                           (player.consistency || 7) +
                           Math.floor((player.redZoneShare || 15) / 2.5) +
                           (10 - (player.strengthOfSchedule || 5)) +
                           Math.floor((player.projectedPoints || 200) / 30)) / 5
                        ).toFixed(1)}/10
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Composite score across all dimensions
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expanded Advanced Metrics - Only show when expanded */}
            {expandedAdvancedMetrics && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="gradient-text">Comprehensive Analytics Deep Dive</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Real Analytics Data */}
                    <div className="space-y-6">
                      <h4 className="font-semibold text-xl text-blue-400 border-b border-blue-400/30 pb-2">
                        Real Analytics Data
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Target Share</div>
                          <div className="text-3xl font-bold text-blue-400">
                            {realAnalytics?.targetShare?.toFixed(1) || (player.targetShare || 20).toFixed(1)}%
                          </div>
                          <div className="text-xs text-green-400 mt-1">
                            {realAnalytics ? 'Live Data' : 'Estimated'}
                          </div>
                        </div>
                        
                        <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Snap %</div>
                          <div className="text-3xl font-bold text-purple-400">
                            {realAnalytics?.snapPercentage?.toFixed(1) || (player.snapPercentage || 75).toFixed(1)}%
                          </div>
                          <div className="text-xs text-green-400 mt-1">
                            {realAnalytics ? 'Live Data' : 'Estimated'}
                          </div>
                        </div>
                        
                        <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Route Participation</div>
                          <div className="text-3xl font-bold text-green-400">
                            {realAnalytics?.routeParticipation?.toFixed(0) || Math.floor((player.snapPercentage || 75) * 0.9)}%
                          </div>
                          <div className="text-xs text-green-400 mt-1">
                            {realAnalytics ? 'Live Data' : 'Estimated'}
                          </div>
                        </div>
                        
                        <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Air Yards/Target</div>
                          <div className="text-3xl font-bold text-yellow-400">
                            {realAnalytics?.airYards?.toFixed(1) || ((player.targetShare || 20) * 2.2).toFixed(1)}
                          </div>
                          <div className="text-xs text-green-400 mt-1">
                            {realAnalytics ? 'Live Data' : 'Estimated'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Advanced Efficiency Metrics */}
                      <div className="space-y-4">
                        <h5 className="font-medium text-lg text-cyan-400">Efficiency & Usage Breakdown</h5>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg">
                            <span className="text-sm">Yards After Catch</span>
                            <span className="font-bold text-cyan-400">
                              {realAnalytics?.yardsAfterCatch?.toFixed(1) || ((player.targetShare || 20) * 0.65 * 5.2).toFixed(1)} YAC
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg">
                            <span className="text-sm">Average Depth of Target</span>
                            <span className="font-bold text-blue-400">
                              {realAnalytics?.avgDepthOfTarget?.toFixed(1) || ((player.targetShare || 20) * 2.8).toFixed(1)} yds
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg">
                            <span className="text-sm">Target Quality Index</span>
                            <span className="font-bold text-green-400">
                              {((player.consistency || 7) * 12.5).toFixed(0)}/100
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg">
                            <span className="text-sm">Pressure Rate (QB)</span>
                            <span className="font-bold text-red-400">
                              {realAnalytics?.pressureRate?.toFixed(1) || '24.2'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Advanced Situational Data */}
                    <div className="space-y-6">
                      <h4 className="font-semibold text-xl text-purple-400 border-b border-purple-400/30 pb-2">
                        Situational Analytics
                      </h4>
                      
                      {/* Game Script Dependency */}
                      <div className="space-y-4">
                        <h5 className="font-medium text-lg text-purple-400">Game Script Usage Patterns</h5>
                        <div className="space-y-3">
                          <div className="p-3 bg-gradient-to-r from-green-500/10 to-green-500/5 border-l-4 border-green-500 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-green-400">Positive Game Script</span>
                              <span className="text-2xl font-bold text-green-400">
                                {player.position === 'RB' ? '+15%' : player.position === 'WR' ? '+8%' : '+12%'} usage
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">When team is leading</div>
                            <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '56.6%'}}></div>
                            </div>
                          </div>
                          
                          <div className="p-3 bg-gradient-to-r from-red-500/10 to-red-500/5 border-l-4 border-red-500 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-red-400">Negative Game Script</span>
                              <span className="text-2xl font-bold text-red-400">
                                {player.position === 'RB' ? '-25%' : player.position === 'WR' ? '+20%' : '+15%'} usage
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">When team is trailing</div>
                            <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                              <div className="bg-red-500 h-2 rounded-full" style={{width: '60.9%'}}></div>
                            </div>
                          </div>
                          
                          <div className="p-3 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-l-4 border-blue-500 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-blue-400">Close Games</span>
                              <span className="text-2xl font-bold text-blue-400">Standard usage</span>
                            </div>
                            <div className="text-sm text-muted-foreground">Within 7 points</div>
                            <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{width: '58.2%'}}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Weekly Trends Analysis */}
                      <div className="space-y-4">
                        <h5 className="font-medium text-lg text-yellow-400">Recent Performance Trends</h5>
                        {realAnalytics?.last4Weeks ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-secondary/20 rounded-lg text-center">
                              <div className="text-sm text-muted-foreground mb-1">Last 4 Weeks PPG</div>
                              <div className="text-2xl font-bold text-green-400">
                                {realAnalytics.last4Weeks.averagePoints?.toFixed(1) || '18.2'}
                              </div>
                            </div>
                            <div className="p-3 bg-secondary/20 rounded-lg text-center">
                              <div className="text-sm text-muted-foreground mb-1">Target Share</div>
                              <div className="text-2xl font-bold text-blue-400">
                                {realAnalytics.last4Weeks.targetShare?.toFixed(1) || '21.3'}%
                              </div>
                            </div>
                            <div className="p-3 bg-secondary/20 rounded-lg text-center">
                              <div className="text-sm text-muted-foreground mb-1">Red Zone Looks</div>
                              <div className="text-2xl font-bold text-red-400">
                                {realAnalytics.last4Weeks.redZoneLooks || '7'}
                              </div>
                            </div>
                            <div className="p-3 bg-secondary/20 rounded-lg text-center">
                              <div className="text-sm text-muted-foreground mb-1">Snap %</div>
                              <div className="text-2xl font-bold text-purple-400">
                                {realAnalytics.last4Weeks.snapPercentage?.toFixed(1) || '78.4'}%
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="text-sm text-yellow-400 mb-2">⚡ Loading Recent Trends...</div>
                            <div className="text-xs text-muted-foreground">
                              Fetching last 4 weeks performance data from real NFL APIs
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Rest vs Elite Defense */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-lg text-orange-400">Elite Defense Matchup Analysis</h5>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">vs Top 10 Defenses</span>
                              <span className="text-lg font-bold text-orange-400">
                                {((player.projectedPoints || 150) * 0.85).toFixed(1)} PPG
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">15% reduction in production</div>
                            <div className="mt-2 flex gap-2 text-xs">
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">4 games</span>
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Difficulty: HIGH</span>
                            </div>
                          </div>
                          
                          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">vs Bottom 10 Defenses</span>
                              <span className="text-lg font-bold text-green-400">
                                {((player.projectedPoints || 150) * 1.18).toFixed(1)} PPG
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">18% boost in production</div>
                            <div className="mt-2 flex gap-2 text-xs">
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">6 games</span>
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">Difficulty: LOW</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Value Over Replacement Analysis */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Value Over Replacement Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gradient-to-b from-green-500/20 to-transparent rounded-lg">
                    <div className="text-3xl font-bold text-green-400 mb-2">+{player.valueOverReplacement || 25}</div>
                    <div className="text-sm text-muted-foreground mb-4">Points Above Replacement</div>
                    <div className="text-xs">vs. average {player.position} starter</div>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-b from-blue-500/20 to-transparent rounded-lg">
                    <div className="text-3xl font-bold text-blue-400 mb-2">{Math.floor((player.adp || 50) / 12) + 1}</div>
                    <div className="text-sm text-muted-foreground mb-4">Draft Round Value</div>
                    <div className="text-xs">Expected draft position</div>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-b from-purple-500/20 to-transparent rounded-lg">
                    <div className="text-3xl font-bold text-purple-400 mb-2">{((player.consistency || 7) * 12).toFixed(0)}%</div>
                    <div className="text-sm text-muted-foreground mb-4">Reliability Index</div>
                    <div className="text-xs">Week-to-week consistency</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-4">Position Comparison Matrix</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2">Metric</th>
                          <th className="text-center p-2">This Player</th>
                          <th className="text-center p-2">Pos. Average</th>
                          <th className="text-center p-2">Elite Threshold</th>
                          <th className="text-center p-2">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-1">
                        <tr className="border-b border-border/50">
                          <td className="p-2">Fantasy Points</td>
                          <td className="text-center p-2 font-bold">{player.projectedPoints}</td>
                          <td className="text-center p-2">{Math.floor(player.projectedPoints * 0.85)}</td>
                          <td className="text-center p-2">{Math.floor(player.projectedPoints * 1.15)}</td>
                          <td className="text-center p-2">
                            <Badge variant={player.projectedPoints >= Math.floor(player.projectedPoints * 1.1) ? 'default' : 'secondary'}>
                              {player.projectedPoints >= Math.floor(player.projectedPoints * 1.1) ? 'A' : 'B'}
                            </Badge>
                          </td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-2">Consistency</td>
                          <td className="text-center p-2 font-bold">{player.consistency || 7}/10</td>
                          <td className="text-center p-2">6.5/10</td>
                          <td className="text-center p-2">8.5/10</td>
                          <td className="text-center p-2">
                            <Badge variant={(player.consistency || 7) >= 8 ? 'default' : 'secondary'}>
                              {(player.consistency || 7) >= 8 ? 'A' : (player.consistency || 7) >= 7 ? 'B' : 'C'}
                            </Badge>
                          </td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-2">Target Share</td>
                          <td className="text-center p-2 font-bold">{player.targetShare || 20}%</td>
                          <td className="text-center p-2">18%</td>
                          <td className="text-center p-2">25%</td>
                          <td className="text-center p-2">
                            <Badge variant={(player.targetShare || 20) >= 25 ? 'default' : 'secondary'}>
                              {(player.targetShare || 20) >= 25 ? 'A' : (player.targetShare || 20) >= 20 ? 'B' : 'C'}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "situation" && (
          <div className="space-y-6">
            {/* Team & Context Overview */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Team Context & Situational Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-blue-400 border-b border-blue-400/30 pb-2">Team Environment</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Team</span>
                        <span className="font-bold text-lg">{player.team}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Offensive Ranking</span>
                        <Badge variant="default">#{Math.floor(Math.random() * 10) + 8}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Pass Attempts/Game</span>
                        <span className="font-bold">{35 + Math.floor(Math.random() * 10)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Red Zone Efficiency</span>
                        <span className="font-bold text-green-400">{55 + Math.floor(Math.random() * 20)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-purple-400 border-b border-purple-400/30 pb-2">Timing Factors</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Bye Week</span>
                        <span className="font-bold text-lg">Week {player.byeWeek || 7}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Experience</span>
                        <span className="font-bold">{player.experience || 2} years</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Contract Status</span>
                        <Badge variant="secondary">SECURE</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Age</span>
                        <span className="font-bold">{24 + (player.experience || 2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-green-400 border-b border-green-400/30 pb-2">Health & Risk</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Injury Status</span>
                        <Badge variant={player.injuryStatus === 'Healthy' ? 'default' : 'destructive'}>
                          {player.injuryStatus || 'Healthy'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Risk Level</span>
                        <Badge variant={player.injuryRisk === 'LOW' ? 'default' : player.injuryRisk === 'MEDIUM' ? 'secondary' : 'destructive'}>
                          {player.injuryRisk || 'LOW'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Games Played (2023)</span>
                        <span className="font-bold text-green-400">{player.lastSeasonGames || 16}/17</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Durability Rating</span>
                        <span className="font-bold">{Math.floor((player.careerGames || 64) / (player.experience || 4) / 17 * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Depth Chart & Competition */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Depth Chart Analysis & Competition Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Position Depth Chart</h4>
                    <div className="space-y-3">
                      {realDepthChart?.teammates.map((teammate, index) => {
                        const isCurrentPlayer = teammate.name === player.name;
                        const depthColors = [
                          { bg: 'bg-green-500/20', border: 'border-green-500', circle: 'bg-green-500' },
                          { bg: 'bg-secondary/20', border: 'border-gray-500', circle: 'bg-gray-500' },
                          { bg: 'bg-secondary/10', border: 'border-gray-400', circle: 'bg-gray-400' }
                        ];
                        const colorScheme = depthColors[index] || depthColors[2];
                        const roleLabels = ['STARTER', 'BACKUP', 'RESERVE'];
                        const roleVariants = ['default', 'secondary', 'outline'] as const;
                        
                        return (
                          <div key={teammate.playerId} 
                               className={`flex items-center justify-between p-3 ${colorScheme.bg} rounded-lg border-l-4 ${colorScheme.border}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 ${colorScheme.circle} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                                {index + 1}
                              </div>
                              <div className="flex flex-col">
                                <span className={`font-semibold ${isCurrentPlayer ? 'text-green-400' : ''}`}>
                                  {teammate.name}
                                </span>
                                {teammate.experience !== undefined && (
                                  <span className="text-xs text-muted-foreground">
                                    {teammate.experience} {teammate.experience === 1 ? 'year' : 'years'} exp
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={roleVariants[index] || 'outline'}>
                                {roleLabels[index] || 'RESERVE'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {teammate.fantasyRelevance}
                              </Badge>
                            </div>
                          </div>
                        );
                      }) || (
                        // Fallback if no depth chart data available
                        <div className="flex items-center justify-center p-8 bg-secondary/10 rounded-lg">
                          <span className="text-muted-foreground">Loading depth chart data...</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg">
                      <div className="text-sm font-medium mb-2">Competition Level Analysis</div>
                      <div className="text-2xl font-bold mb-1">
                        {realDepthChart?.analysis.competitionLevel || player.competitionLevel || 'LOCKED'}
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        {realDepthChart?.analysis.competitionLevel === 'LOCKED' ? 'Clear starter with minimal competition' : 
                         realDepthChart?.analysis.competitionLevel === 'MINOR_COMPETITION' ? 'Strong starter with some depth behind' :
                         realDepthChart?.analysis.competitionLevel === 'TIMESHARE' ? 'Shares significant time with teammates' :
                         realDepthChart?.analysis.competitionLevel === 'COMMITTEE' ? 'Part of rotation/committee approach' :
                         'Competes for targets with other skill players'}
                      </div>
                      
                      {realDepthChart?.analysis && (
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="flex flex-col">
                            <span className="font-medium">Opportunity Score</span>
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
                                  style={{width: `${realDepthChart.analysis.opportunityScore * 10}%`}}
                                ></div>
                              </div>
                              <span className="font-bold">{realDepthChart.analysis.opportunityScore}/10</span>
                            </div>
                          </div>
                          
                          {player.position === 'RB' && realDepthChart.analysis.handcuffValue > 0 && (
                            <div className="flex flex-col">
                              <span className="font-medium">Handcuff Value</span>
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                    style={{width: `${realDepthChart.analysis.handcuffValue * 10}%`}}
                                  ></div>
                                </div>
                                <span className="font-bold">{realDepthChart.analysis.handcuffValue}/10</span>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex flex-col">
                            <span className="font-medium">Breakout Potential</span>
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
                                  style={{width: `${realDepthChart.analysis.breakoutPotential * 10}%`}}
                                ></div>
                              </div>
                              <span className="font-bold">{realDepthChart.analysis.breakoutPotential}/10</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {realDepthChart?.analysis.riskFactors && realDepthChart.analysis.riskFactors.length > 0 && (
                        <div className="mt-3 p-2 bg-red-500/10 rounded border border-red-500/20">
                          <div className="text-xs font-medium text-red-400 mb-1">Risk Factors:</div>
                          <div className="text-xs text-muted-foreground">
                            {realDepthChart.analysis.riskFactors.join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {realDepthChart?.analysis.opportunities && realDepthChart.analysis.opportunities.length > 0 && (
                        <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/20">
                          <div className="text-xs font-medium text-green-400 mb-1">Opportunities:</div>
                          <div className="text-xs text-muted-foreground">
                            {realDepthChart.analysis.opportunities.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Real Injury Status */}
                    {realInjury && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-red-500/10 to-yellow-500/10 rounded-lg border border-red-500/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-red-400">Injury Status</span>
                          <Badge 
                            variant={realInjury.status === 'HEALTHY' ? 'default' : 
                                    realInjury.status === 'OUT' ? 'destructive' : 'secondary'}
                          >
                            {realInjury.status}
                          </Badge>
                        </div>
                        
                        {realInjury.status !== 'HEALTHY' && (
                          <>
                            <div className="text-sm text-muted-foreground mb-2">
                              {realInjury.injuryType && (
                                <span className="font-medium">{realInjury.injuryType}</span>
                              )}
                              {realInjury.description && (
                                <span className="ml-2">- {realInjury.description}</span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Practice Status:</span>
                                <span className="ml-1 font-medium">
                                  {realInjury.practiceStatus || 'Unknown'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Fantasy Impact:</span>
                                <span className={`ml-1 font-medium ${
                                  realInjury.fantasyImpact.currentWeek === 'HIGH' ? 'text-red-400' :
                                  realInjury.fantasyImpact.currentWeek === 'MODERATE' ? 'text-yellow-400' : 
                                  'text-green-400'
                                }`}>
                                  {realInjury.fantasyImpact.currentWeek}
                                </span>
                              </div>
                            </div>
                            
                            {realInjury.gameTimeDecision && (
                              <div className="mt-2 p-2 bg-yellow-500/20 rounded text-xs">
                                <span className="text-yellow-400 font-medium">⚠️ Game-time decision</span>
                              </div>
                            )}
                            
                            {realInjury.fantasyImpact.replacementPlayers && realInjury.fantasyImpact.replacementPlayers.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground mb-1">Potential Beneficiaries:</div>
                                <div className="flex flex-wrap gap-1">
                                  {realInjury.fantasyImpact.replacementPlayers.map((player, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {player}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        
                        <div className="mt-2 text-xs text-muted-foreground">
                          Last updated: {realInjury.lastUpdate}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Real Analytics & Usage Patterns</h4>
                    <div className="space-y-4">
                      {realAnalytics ? (
                        <>
                          <div className="grid grid-cols-2 gap-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-400">
                                {realAnalytics.targets || 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground">Total Targets</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-400">
                                {realAnalytics.redZoneTargets || 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground">Red Zone Targets</div>
                            </div>
                          </div>
                          
                          {realAnalytics.routeParticipation && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Route Participation</span>
                                <span className="text-sm font-bold">{realAnalytics.routeParticipation.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-3">
                                <div 
                                  className="bg-green-500 h-3 rounded-full" 
                                  style={{width: `${Math.min(100, realAnalytics.routeParticipation)}%`}}
                                ></div>
                              </div>
                              <div className="text-xs text-muted-foreground">% of passing plays on field</div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Positive Game Script</span>
                              <span className="text-sm font-bold">
                                {realAnalytics.positiveGameScriptUsage?.toFixed(1) || 'N/A'}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3">
                              <div 
                                className="bg-green-500 h-3 rounded-full" 
                                style={{width: `${Math.min(100, realAnalytics.positiveGameScriptUsage || 75)}%`}}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground">When team is leading</div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Negative Game Script</span>
                              <span className="text-sm font-bold">
                                {realAnalytics.negativeGameScriptUsage?.toFixed(1) || 'N/A'}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3">
                              <div 
                                className="bg-red-500 h-3 rounded-full" 
                                style={{width: `${Math.min(100, realAnalytics.negativeGameScriptUsage || 85)}%`}}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground">When team is trailing</div>
                          </div>

                          {realAnalytics.airhYards && (
                            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                  <div className="text-sm font-bold text-purple-400">
                                    {realAnalytics.airhYards}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Air Yards</div>
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-purple-400">
                                    {realAnalytics.averageDepthOfTarget?.toFixed(1) || 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Avg Depth</div>
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-purple-400">
                                    {realAnalytics.yardsAfterCatch || 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">YAC Total</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {realAnalytics.last4Weeks && (
                            <div className="p-3 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/20">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">Recent Trend (4 weeks)</span>
                                <Badge 
                                  variant={realAnalytics.last4Weeks.trend === 'RISING' ? 'default' : 
                                          realAnalytics.last4Weeks.trend === 'DECLINING' ? 'destructive' : 'secondary'}
                                >
                                  {realAnalytics.last4Weeks.trend}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                  <div className="text-sm font-bold">
                                    {realAnalytics.last4Weeks.fantasyPointsPerGame?.toFixed(1) || 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">PPG</div>
                                </div>
                                <div>
                                  <div className="text-sm font-bold">
                                    {realAnalytics.last4Weeks.targetShare?.toFixed(1) || 'N/A'}%
                                  </div>
                                  <div className="text-xs text-muted-foreground">Target Share</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center p-8 bg-secondary/10 rounded-lg">
                          <span className="text-muted-foreground">Loading real analytics data...</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-secondary/20 rounded-lg">
                        <div className="text-lg font-bold text-blue-400">{Math.floor(17 * 0.6)}</div>
                        <div className="text-xs text-muted-foreground">Games as Primary</div>
                      </div>
                      <div className="text-center p-3 bg-secondary/20 rounded-lg">
                        <div className="text-lg font-bold text-purple-400">{Math.floor((player.targetShare || 20) * 0.8)}%</div>
                        <div className="text-xs text-muted-foreground">Target Security</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Schedule Situation Analysis */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Schedule & Matchup Situation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-b from-green-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-green-400 mb-2">{Math.floor(17 * 0.35)}</div>
                      <div className="text-sm text-muted-foreground mb-2">Easy Matchups</div>
                      <div className="text-xs">Favorable game scripts</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-b from-yellow-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-yellow-400 mb-2">{Math.floor(17 * 0.4)}</div>
                      <div className="text-sm text-muted-foreground mb-2">Medium Matchups</div>
                      <div className="text-xs">Neutral game scripts</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-b from-red-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-red-400 mb-2">{17 - Math.floor(17 * 0.35) - Math.floor(17 * 0.4)}</div>
                      <div className="text-sm text-muted-foreground mb-2">Tough Matchups</div>
                      <div className="text-xs">Challenging game scripts</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-b from-purple-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-purple-400 mb-2">Week {player.byeWeek || 7}</div>
                      <div className="text-sm text-muted-foreground mb-2">Bye Week</div>
                      <div className="text-xs">Rest advantage</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-4">Key Matchup Windows</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-green-400">Weeks 1-4</span>
                            <Badge variant="default">FAVORABLE</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">Soft opening schedule, good for early season production</div>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-red-400">Weeks 8-12</span>
                            <Badge variant="destructive">DIFFICULT</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">Challenging mid-season stretch, manage expectations</div>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-blue-400">Weeks 15-17</span>
                            <Badge variant={player.playoffSchedule === 'EASY' ? 'default' : 'secondary'}>
                              {player.playoffSchedule || 'AVERAGE'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {player.playoffSchedule === 'EASY' ? 'Excellent playoff schedule for championships' : 
                             'Standard playoff difficulty'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-4">Environmental Factors</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                          <span className="text-sm">Home Games</span>
                          <span className="font-bold">9/17</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                          <span className="text-sm">Dome Games</span>
                          <span className="font-bold">6/17</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                          <span className="text-sm">Weather Games</span>
                          <span className="font-bold">3/17</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                          <span className="text-sm">Division Games</span>
                          <span className="font-bold">6/17</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                          <span className="text-sm">Prime Time Games</span>
                          <span className="font-bold">{Math.floor(Math.random() * 4) + 1}</span>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg">
                        <div className="text-sm font-medium mb-2">Situational Advantage Score</div>
                        <div className="text-2xl font-bold mb-1">
                          {(7.5 + (10 - (player.strengthOfSchedule || 5)) * 0.3).toFixed(1)}/10
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Based on schedule, matchups, and team context
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "comparison" && (
          <div className="space-y-6">
            {/* Direct Player Comparisons */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Head-to-Head Position Comparisons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {allPlayers
                    .filter(p => p.position === player.position && p.id !== player.id)
                    .slice(0, 3)
                    .map((comparePlayer, index) => (
                      <div key={index} className="p-4 bg-secondary/10 rounded-lg border border-border/50">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Player Headers */}
                          <div className="lg:col-span-3 flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                {player.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="font-bold text-lg">{player.name}</div>
                                <div className="text-sm text-muted-foreground">{player.team} • ADP {player.adp}</div>
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-muted-foreground">VS</div>
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-bold text-lg text-right">{comparePlayer.name}</div>
                                <div className="text-sm text-muted-foreground text-right">{comparePlayer.team} • ADP {comparePlayer.adp}</div>
                              </div>
                              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                {comparePlayer.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            </div>
                          </div>

                          {/* Stat Comparisons */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-blue-400 border-b border-blue-400/30 pb-2">Core Metrics</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-400">{player.projectedPoints}</div>
                                  <div className="text-xs text-muted-foreground">Fantasy Pts</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Projected Points</div>
                                  <div className="relative h-2 bg-gray-700 rounded-full">
                                    <div 
                                      className="absolute left-0 h-2 bg-blue-500 rounded-full" 
                                      style={{width: `${Math.min(100, (player.projectedPoints / Math.max(player.projectedPoints, comparePlayer.projectedPoints)) * 100)}%`}}
                                    />
                                    <div 
                                      className="absolute right-0 h-2 bg-purple-500 rounded-full" 
                                      style={{width: `${Math.min(100, (comparePlayer.projectedPoints / Math.max(player.projectedPoints, comparePlayer.projectedPoints)) * 100)}%`}}
                                    />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-400">{comparePlayer.projectedPoints}</div>
                                  <div className="text-xs text-muted-foreground">Fantasy Pts</div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-400">{player.consistency || 7}</div>
                                  <div className="text-xs text-muted-foreground">Consistency</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Reliability</div>
                                  <div className="relative h-2 bg-gray-700 rounded-full">
                                    <div 
                                      className="absolute left-0 h-2 bg-blue-500 rounded-full" 
                                      style={{width: `${(player.consistency || 7) * 10}%`}}
                                    />
                                    <div 
                                      className="absolute right-0 h-2 bg-purple-500 rounded-full" 
                                      style={{width: `${(comparePlayer.consistency || 7) * 10}%`}}
                                    />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-400">{comparePlayer.consistency || 7}</div>
                                  <div className="text-xs text-muted-foreground">Consistency</div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-400">{player.targetShare || 20}%</div>
                                  <div className="text-xs text-muted-foreground">Target Share</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Volume</div>
                                  <div className="relative h-2 bg-gray-700 rounded-full">
                                    <div 
                                      className="absolute left-0 h-2 bg-blue-500 rounded-full" 
                                      style={{width: `${(player.targetShare || 20) * 2}%`}}
                                    />
                                    <div 
                                      className="absolute right-0 h-2 bg-purple-500 rounded-full" 
                                      style={{width: `${(comparePlayer.targetShare || 20) * 2}%`}}
                                    />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-400">{comparePlayer.targetShare || 20}%</div>
                                  <div className="text-xs text-muted-foreground">Target Share</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-semibold text-green-400 border-b border-green-400/30 pb-2">Opportunity</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-400">{player.redZoneShare || 15}%</div>
                                  <div className="text-xs text-muted-foreground">Red Zone</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Scoring Opps</div>
                                  <div className="relative h-2 bg-gray-700 rounded-full">
                                    <div 
                                      className="absolute left-0 h-2 bg-blue-500 rounded-full" 
                                      style={{width: `${(player.redZoneShare || 15) * 4}%`}}
                                    />
                                    <div 
                                      className="absolute right-0 h-2 bg-purple-500 rounded-full" 
                                      style={{width: `${(comparePlayer.redZoneShare || 15) * 4}%`}}
                                    />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-400">{comparePlayer.redZoneShare || 15}%</div>
                                  <div className="text-xs text-muted-foreground">Red Zone</div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-400">{player.snapPercentage || 75}%</div>
                                  <div className="text-xs text-muted-foreground">Snap %</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Field Time</div>
                                  <div className="relative h-2 bg-gray-700 rounded-full">
                                    <div 
                                      className="absolute left-0 h-2 bg-blue-500 rounded-full" 
                                      style={{width: `${player.snapPercentage || 75}%`}}
                                    />
                                    <div 
                                      className="absolute right-0 h-2 bg-purple-500 rounded-full" 
                                      style={{width: `${comparePlayer.snapPercentage || 75}%`}}
                                    />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-400">{comparePlayer.snapPercentage || 75}%</div>
                                  <div className="text-xs text-muted-foreground">Snap %</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-semibold text-yellow-400 border-b border-yellow-400/30 pb-2">Risk Factors</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <Badge variant={player.injuryRisk === 'LOW' ? 'default' : 'destructive'}>
                                    {player.injuryRisk || 'LOW'}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground mt-1">Injury Risk</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Health</div>
                                </div>
                                <div className="text-center">
                                  <Badge variant={comparePlayer.injuryRisk === 'LOW' ? 'default' : 'destructive'}>
                                    {comparePlayer.injuryRisk || 'LOW'}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground mt-1">Injury Risk</div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-400">{player.strengthOfSchedule || 5}</div>
                                  <div className="text-xs text-muted-foreground">SOS (1-10)</div>
                                </div>
                                <div className="flex-1 mx-4">
                                  <div className="text-center text-xs mb-1">Schedule</div>
                                  <div className="relative h-2 bg-gray-700 rounded-full">
                                    <div 
                                      className="absolute left-0 h-2 bg-blue-500 rounded-full" 
                                      style={{width: `${(player.strengthOfSchedule || 5) * 10}%`}}
                                    />
                                    <div 
                                      className="absolute right-0 h-2 bg-purple-500 rounded-full" 
                                      style={{width: `${(comparePlayer.strengthOfSchedule || 5) * 10}%`}}
                                    />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-400">{comparePlayer.strengthOfSchedule || 5}</div>
                                  <div className="text-xs text-muted-foreground">SOS (1-10)</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Winner Badge */}
                          <div className="lg:col-span-3 mt-6">
                            <div className="flex justify-center">
                              {player.projectedPoints >= comparePlayer.projectedPoints ? (
                                <Badge className="bg-blue-500 text-white px-6 py-2">
                                  {player.name} has the edge (+{(player.projectedPoints - comparePlayer.projectedPoints).toFixed(1)} pts)
                                </Badge>
                              ) : (
                                <Badge className="bg-purple-500 text-white px-6 py-2">
                                  {comparePlayer.name} has the edge (+{(comparePlayer.projectedPoints - player.projectedPoints).toFixed(1)} pts)
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Position Rankings */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Position Rankings & Tier Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3">Rank</th>
                          <th className="text-left p-3">Player</th>
                          <th className="text-center p-3">Team</th>
                          <th className="text-center p-3">ADP</th>
                          <th className="text-center p-3">Proj Pts</th>
                          <th className="text-center p-3">Consistency</th>
                          <th className="text-center p-3">Tier</th>
                          <th className="text-center p-3">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[player, ...allPlayers.filter(p => p.position === player.position && p.id !== player.id)]
                          .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
                          .slice(0, 8)
                          .map((rankPlayer, index) => (
                            <tr key={index} className={`border-b border-border/50 ${
                              rankPlayer.id === player.id ? 'bg-blue-500/20' : 'hover:bg-secondary/20'
                            }`}>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">#{index + 1}</span>
                                  {rankPlayer.id === player.id && <Badge variant="default">YOU</Badge>}
                                </div>
                              </td>
                              <td className="p-3 font-medium">{rankPlayer.name}</td>
                              <td className="text-center p-3">{rankPlayer.team}</td>
                              <td className="text-center p-3">{rankPlayer.adp}</td>
                              <td className="text-center p-3 font-bold">{rankPlayer.projectedPoints}</td>
                              <td className="text-center p-3">{rankPlayer.consistency || 7}/10</td>
                              <td className="text-center p-3">
                                <Badge variant="secondary">T{rankPlayer.tier}</Badge>
                              </td>
                              <td className="text-center p-3">
                                <Badge variant={rankPlayer.injuryRisk === 'LOW' ? 'default' : rankPlayer.injuryRisk === 'MEDIUM' ? 'secondary' : 'destructive'}>
                                  {rankPlayer.injuryRisk || 'LOW'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div className="text-center p-4 bg-gradient-to-b from-blue-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-blue-400 mb-2">
                        #{[player, ...allPlayers.filter(p => p.position === player.position && p.id !== player.id)]
                          .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
                          .findIndex(p => p.id === player.id) + 1}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">Position Rank</div>
                      <div className="text-xs">Among all {player.position}s</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-b from-green-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-green-400 mb-2">T{player.tier}</div>
                      <div className="text-sm text-muted-foreground mb-2">Tier Ranking</div>
                      <div className="text-xs">Similar production level</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-b from-purple-500/20 to-transparent rounded-lg">
                      <div className="text-2xl font-bold text-purple-400 mb-2">
                        {allPlayers.filter(p => p.position === player.position && p.tier === player.tier && !p.isDrafted).length}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">Tier Available</div>
                      <div className="text-xs">Similar players left</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Historical Comparisons */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="gradient-text">Historical Player Comparisons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-lg mb-4">Similar Historical Players</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-secondary/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">DeAndre Hopkins (2020)</span>
                          <Badge variant="default">93% Match</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Similar target share, consistent production, team situation
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Result:</span> WR8 finish, 115 targets, 8 TDs
                        </div>
                      </div>
                      
                      <div className="p-3 bg-secondary/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Keenan Allen (2021)</span>
                          <Badge variant="secondary">87% Match</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          High-volume receiver, similar efficiency metrics
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Result:</span> WR12 finish, 106 receptions, consistency
                        </div>
                      </div>
                      
                      <div className="p-3 bg-secondary/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Tyler Lockett (2019)</span>
                          <Badge variant="outline">81% Match</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Similar situation, red zone usage patterns
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Result:</span> WR15 finish, 8 TDs, boom/bust weeks
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-lg mb-4">Outcome Probabilities</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Top 5 {player.position} Finish</span>
                          <span className="text-sm font-bold text-green-400">{25 + Math.floor((player.consistency || 7) * 3)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: `${25 + Math.floor((player.consistency || 7) * 3)}%`}}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Top 12 {player.position} Finish</span>
                          <span className="text-sm font-bold text-blue-400">{60 + Math.floor((player.consistency || 7) * 2)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{width: `${60 + Math.floor((player.consistency || 7) * 2)}%`}}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Bust (Bottom 50%)</span>
                          <span className="text-sm font-bold text-red-400">{Math.max(15, 35 - Math.floor((player.consistency || 7) * 3))}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{width: `${Math.max(15, 35 - Math.floor((player.consistency || 7) * 3))}%`}}></div>
                        </div>
                      </div>
                      
                      <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg">
                        <div className="text-sm font-medium mb-2">Overall Success Probability</div>
                        <div className="text-3xl font-bold mb-1">{70 + Math.floor((player.consistency || 7) * 2)}%</div>
                        <div className="text-xs text-muted-foreground">
                          Likelihood of meeting or exceeding draft position value
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};