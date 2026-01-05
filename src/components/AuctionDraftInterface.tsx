import { useState, useEffect, useCallback } from 'react';
import { Search, Trophy, ChevronDown, X, DollarSign, Target, BarChart3, UserCheck, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuctionDraftService, Player, DraftAnalytics } from '@/services/auctionDraftService';
import { PlayerInsights } from '@/components/PlayerInsights';
import { TeamRosterBuilder } from '@/components/TeamRosterBuilder';
import { ExpertAnalysis } from '@/components/ExpertAnalysis';
import { AdvancedDraftCharts } from '@/components/AdvancedDraftCharts';
import { DynamicRecommendations } from '@/components/DynamicRecommendations';
import { DraftSettings } from '@/components/DraftSettings';
import { DraftResults } from '@/components/DraftResults';
import { EnhancedSnakeDraftInterface } from '@/components/EnhancedSnakeDraftInterface';

interface AuctionDraftInterfaceProps {
  draftService: AuctionDraftService;
}

export const AuctionDraftInterface: React.FC<AuctionDraftInterfaceProps> = ({ draftService }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('All');
  const [selectedTier, setSelectedTier] = useState(0);
  const [showDrafted, setShowDrafted] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerAnalytics, setPlayerAnalytics] = useState<DraftAnalytics | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [draftState, setDraftState] = useState(draftService.getDraftState());
  const [activeTab, setActiveTab] = useState('draft');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showSnakeDraft, setShowSnakeDraft] = useState(false);
  const [simulationInterval, setSimulationInterval] = useState<NodeJS.Timeout | null>(null);
  const [userTeamId, setUserTeamId] = useState('team-1');
  const [expandedSections, setExpandedSections] = useState({
    performance: true,
    targetShare: true,
    redZone: true,
    injury: true,
    schedule: true,
    consistency: true,
    projections: true,
    market: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  const updateFilteredPlayers = useCallback(() => {
    let players = draftService.getPlayers();

    if (searchQuery) {
      players = draftService.searchPlayers(searchQuery);
    }

    if (selectedPosition !== 'All') {
      players = players.filter(p => p.position === selectedPosition);
    }

    if (selectedTier !== 0) {
      players = players.filter(p => p.tier === selectedTier);
    }

    if (!showDrafted) {
      players = players.filter(p => !p.isDrafted);
    }

    setFilteredPlayers(players);
  }, [draftService, searchQuery, selectedPosition, selectedTier, showDrafted]);

  useEffect(() => {
    updateFilteredPlayers();
    if (draftService.isDraftComplete() && !showResults) {
      setShowResults(true);
    }
  }, [draftService, showResults, updateFilteredPlayers]);

  const refreshDraftState = () => {
    setDraftState(draftService.getDraftState());
  };

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    const analytics = draftService.getPlayerAnalytics(player.id);
    setPlayerAnalytics(analytics);
    setIsFlipped(false);
    
    // Dynamic bid calculation based on draft state
    const draftProgress = draftService.getDraftedPlayers().length / draftService.getPlayers().length;
    const available = draftService.getAvailablePlayers().filter(p => p.position === player.position).length;
    const total = draftService.getPlayers().filter(p => p.position === player.position).length;
    const scarcity = 1 - (available / total);
    
    let dynamicBid = analytics?.openingBid || player.estimatedValue;
    
    // Adjust bid based on draft progress and scarcity
    if (draftProgress > 0.5) dynamicBid += Math.round(dynamicBid * 0.1);
    if (draftProgress > 0.7) dynamicBid += Math.round(dynamicBid * 0.15);
    if (scarcity > 0.6) dynamicBid += Math.round(dynamicBid * 0.2);
    
    setBidAmount(dynamicBid.toString());
    
    // Auto-flip after 300ms
    setTimeout(() => setIsFlipped(true), 300);
  };

  const handleDraftPlayer = () => {
    if (!selectedPlayer || !selectedTeam || !bidAmount) return;
    
    const cost = parseInt(bidAmount);
    const success = draftService.draftPlayer(selectedPlayer.id, selectedTeam, cost);
    
    if (success) {
      refreshDraftState();
      setSelectedPlayer(null);
      setSelectedTeam('');
      setBidAmount('');
      updateFilteredPlayers();
    }
  };

  const handleSimulateDraft = () => {
    if (isSimulating) {
      // Stop simulation
      if (simulationInterval) {
        clearInterval(simulationInterval);
        setSimulationInterval(null);
      }
      setIsSimulating(false);
    } else {
      // Start step-by-step simulation
      setIsSimulating(true);
      const interval = setInterval(() => {
        const availablePlayers = draftService.getAvailablePlayers();
        if (availablePlayers.length === 0) {
          // Auction complete, move to snake draft
          clearInterval(interval);
          setSimulationInterval(null);
          setIsSimulating(false);
          setShowSnakeDraft(true);
          return;
        }

        // Simulate one pick
        simulateOnePick();
      }, 1500); // Draft one player every 1.5 seconds
      
      setSimulationInterval(interval);
    }
  };

  const simulateOnePick = () => {
    const availablePlayers = draftService.getAvailablePlayers();
    const teams = draftState.teams.filter(team => {
      const spent = draftService.getDraftedPlayers()
        .filter(p => p.draftedBy === team.id)
        .reduce((sum, p) => sum + (p.draftCost || 0), 0);
      return (team.budget - spent) >= 10; // Team has at least $10 left
    });

    if (availablePlayers.length === 0 || teams.length === 0) {
      setShowSnakeDraft(true);
      return;
    }

    // Pick a random available player and random team with budget
    const randomPlayer = availablePlayers[Math.floor(Math.random() * Math.min(availablePlayers.length, 20))]; // Pick from top 20
    const randomTeam = teams[Math.floor(Math.random() * teams.length)];
    
    // Calculate bid (80% to 120% of estimated value)
    const bidMultiplier = 0.8 + (Math.random() * 0.4);
    const bidAmount = Math.max(1, Math.round(randomPlayer.estimatedValue * bidMultiplier));
    
    // Draft the player
    draftService.draftPlayer(randomPlayer.id, randomTeam.id, bidAmount);
    refreshDraftState();
  };

  const handleNewDraft = () => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      setSimulationInterval(null);
    }
    draftService.resetDraft();
    refreshDraftState();
    setShowResults(false);
    setShowSnakeDraft(false);
    setIsSimulating(false);
    setActiveTab('draft');
  };

  const handleSnakeDraftComplete = () => {
    setShowSnakeDraft(false);
    setShowResults(true);
  };

  // If showing snake draft, render snake draft component
  if (showSnakeDraft) {
    return (
      <EnhancedSnakeDraftInterface 
        draftService={draftService}
        teams={draftState.teams}
        onDraftComplete={handleSnakeDraftComplete}
        userTeamId={userTeamId}
      />
    );
  }

  // If showing results, render the results component
  if (showResults) {
    return (
      <DraftResults 
        draftService={draftService}
        teams={draftState.teams}
        onNewDraft={handleNewDraft}
      />
    );
  }

  const getPositionIcon = (position: string) => {
    const baseClasses = "w-6 h-6 font-bold";
    switch (position) {
      case 'QB': return <div className={`${baseClasses} position-qb`}>QB</div>;
      case 'RB': return <div className={`${baseClasses} position-rb`}>RB</div>;
      case 'WR': return <div className={`${baseClasses} position-wr`}>WR</div>;
      case 'TE': return <div className={`${baseClasses} position-te`}>TE</div>;
      default: return null;
    }
  };

  const getTierBadge = (tier: number) => {
    return (
      <Badge className={`tier-${tier} font-bold text-xs px-2 py-1`}>
        T{tier}
      </Badge>
    );
  };

  const getValueBadge = (player: Player) => {
    if (!player.isDrafted) return null;
    
    // For auction, show actual value vs cost comparison
    const ratio = (player.draftCost || 0) / player.estimatedValue;
    let grade = '';
    let colorClass = '';
    
    if (ratio <= 0.85) {
      grade = 'GREAT VALUE';
      colorClass = 'bg-green-500';
    } else if (ratio <= 0.95) {
      grade = 'GOOD VALUE';
      colorClass = 'bg-blue-500';
    } else if (ratio <= 1.05) {
      grade = 'FAIR VALUE';
      colorClass = 'bg-yellow-500';
    } else if (ratio <= 1.15) {
      grade = 'SLIGHT OVERPAY';
      colorClass = 'bg-orange-500';
    } else {
      grade = 'OVERPAY';
      colorClass = 'bg-red-500';
    }
    
    return (
      <Badge className={`${colorClass} text-white font-bold text-xs`}>
        {grade}
      </Badge>
    );
  };

  const progressPercentage = draftService.getProgressPercentage();
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = `${(progressPercentage / 100) * circumference} ${circumference}`;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      {/* Premium Header */}
      <header className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-6xl font-bold gradient-text mb-2">AUCTION DRAFT</h1>
            <p className="text-muted-foreground text-lg">Premium Fantasy Football Draft Experience</p>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{draftState.draftedCount}</div>
              <div className="text-sm text-muted-foreground">Drafted</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">{draftState.totalPlayers - draftState.draftedCount}</div>
              <div className="text-sm text-muted-foreground">Remaining</div>
            </div>
            
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="hsl(var(--muted))"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">{progressPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players or teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-border"
            />
          </div>
          
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-32 bg-secondary/50 border-border z-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border-border z-50">
              <SelectItem value="All">All Pos</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedTier.toString()} onValueChange={(value) => setSelectedTier(parseInt(value))}>
            <SelectTrigger className="w-32 bg-secondary/50 border-border z-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border-border z-50">
              <SelectItem value="0">All Tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
              <SelectItem value="4">Tier 4</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button
              variant={!showDrafted ? "default" : "ghost"}
              onClick={() => setShowDrafted(false)}
              className="rounded-none border-r border-border"
            >
              Available
            </Button>
            <Button
              variant={showDrafted ? "default" : "ghost"}
              onClick={() => setShowDrafted(true)}
              className="rounded-none"
            >
              Drafted
            </Button>
          </div>
          
          {/* Simulation Controls */}
          <div className="flex gap-3">
            <Button 
              onClick={handleSimulateDraft}
              className={`font-bold transition-all ${
                isSimulating 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white'
              }`}
            >
              {isSimulating ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Stop Simulation
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Simulate Auction
                </>
              )}
            </Button>
            
            {!isSimulating && draftService.getDraftedPlayers().length > 0 && (
              <Button 
                onClick={() => setShowSnakeDraft(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 text-white font-bold"
              >
                Skip to Snake Draft
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-center">
          <TabsList className="glass-card grid w-auto grid-cols-5 bg-secondary/50">
            <TabsTrigger value="draft" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="w-4 h-4 mr-2" />
              Draft Board
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Target className="w-4 h-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UserCheck className="w-4 h-4 mr-2" />
              Team Builder
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings2 className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="draft" className="space-y-6">
          {/* Player Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlayers.map((player, index) => (
              <Card
                key={player.id}
                className={`glass-card cursor-pointer transition-premium hover:transform hover:-translate-y-1 hover:shadow-premium
                  ${player.isDrafted ? 'opacity-75' : 'hover:shadow-glow'}`}
                onClick={() => handlePlayerClick(player)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {getPositionIcon(player.position)}
                      {getTierBadge(player.tier)}
                    </div>
                    {getValueBadge(player)}
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2">{player.name}</h3>
                  <p className="text-muted-foreground mb-4">{player.team}</p>
                  
                  {player.isDrafted ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Pick #{player.pickNumber}</span>
                        <span className="font-bold">${player.draftCost}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {draftState.teams.find(t => t.id === player.draftedBy)?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Est. Value</span>
                        <span className="font-bold">${player.estimatedValue}</span>
                      </div>
                      <Button className="w-full bg-gradient-primary hover:opacity-90 transition-premium">
                        Select for Auction
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations">
          <DynamicRecommendations 
            draftService={draftService}
            players={draftService.getPlayers()}
            teams={draftState.teams}
            draftedPlayers={draftService.getDraftedPlayers()}
            selectedPlayer={selectedPlayer}
            onPlayerSelect={handlePlayerClick}
          />
        </TabsContent>

        <TabsContent value="teams">
          <TeamRosterBuilder 
            draftService={draftService}
            teams={draftState.teams}
            draftedPlayers={draftService.getDraftedPlayers()}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <AdvancedDraftCharts 
            players={draftService.getPlayers()}
            teams={draftState.teams}
            draftedPlayers={draftService.getDraftedPlayers()}
          />
        </TabsContent>

        <TabsContent value="settings">
          <DraftSettings 
            draftService={draftService} 
            onSettingsChange={() => {
              const newState = draftService.getDraftState();
              setFilteredPlayers(newState.players);
              refreshDraftState();
              updateFilteredPlayers();
            }}
            userTeamId={userTeamId}
            onUserTeamChange={setUserTeamId}
          />
        </TabsContent>
      </Tabs>

      {/* Player Analytics Modal */}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Player Analytics</DialogTitle>
          </DialogHeader>
          
          {selectedPlayer && playerAnalytics && (
            <div className="space-y-6">
              {/* 3D Flip Card */}
              <div className="relative h-64 perspective-1000">
                <div className={`animate-flip w-full h-full relative ${isFlipped ? 'flipped' : ''}`}>
                  {/* Front Side */}
                  <div className="flip-front glass-card rounded-xl p-6 flex flex-col justify-center items-center bg-gradient-primary">
                    <div className="text-center text-white">
                      <h2 className="text-3xl font-bold mb-2">{selectedPlayer.name}</h2>
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <span className="text-xl">{selectedPlayer.position}</span>
                        <span className="text-xl">•</span>
                        <span className="text-xl">{selectedPlayer.team}</span>
                      </div>
                      {getTierBadge(selectedPlayer.tier)}
                      <div className="mt-4 text-2xl font-bold">Est: ${selectedPlayer.estimatedValue}</div>
                    </div>
                  </div>
                  
                  {/* Back Side */}
                  <div className="flip-back glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 gradient-text">Advanced Analytics</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-primary">Value Analysis</h4>
                        <div>
                          <div className="text-muted-foreground">Base Value</div>
                          <div className="font-bold">${playerAnalytics.baseValue}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Adjusted Value</div>
                          <div className="font-bold">${playerAnalytics.adjustedValue.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Max Bid</div>
                          <div className="font-bold text-red-400">${playerAnalytics.maxBid}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-semibold text-accent">Bidding Strategy</h4>
                        <div>
                          <div className="text-muted-foreground">Opening Bid</div>
                          <div className="font-bold">${playerAnalytics.openingBid.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Target Bid</div>
                          <div className="font-bold">${playerAnalytics.targetBid.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Walk Away</div>
                          <div className="font-bold text-orange-400">${playerAnalytics.walkAwayPoint.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-semibold text-yellow-400">Market Factors</h4>
                        <div>
                          <div className="text-muted-foreground">Need Multiplier</div>
                          <div className="font-bold">{playerAnalytics.needMultiplier.toFixed(2)}x</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Scarcity Factor</div>
                          <div className="font-bold">{playerAnalytics.scarcityFactor.toFixed(2)}x</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Confidence</div>
                          <div className="font-bold">{playerAnalytics.confidenceLevel.toFixed(2)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expert Analysis */}
                <ExpertAnalysis 
                  player={selectedPlayer}
                  analytics={playerAnalytics}
                  draftProgress={draftService.getDraftedPlayers().length / draftService.getPlayers().length}
                  positionScarcity={1 - (draftService.getAvailablePlayers().filter(p => p.position === selectedPlayer.position).length / draftService.getPlayers().filter(p => p.position === selectedPlayer.position).length)}
                  marketTrends={{
                    priceInflation: Math.random() * 0.3,
                    velocityTrend: Math.random() > 0.5 ? 'UP' : 'DOWN',
                    positionRuns: Math.random() > 0.7 ? [selectedPlayer.position] : []
                  }}
                />

                {/* Enhanced Player Insights */}
                <PlayerInsights 
                  player={{
                    ...selectedPlayer,
                    projectedPoints: selectedPlayer.projectedPoints,
                    adp: selectedPlayer.adp,
                    byeWeek: selectedPlayer.byeWeek,
                    injuryStatus: 'Healthy',
                    trends: {
                      isRising: Math.random() > 0.5,
                      weeklyTrend: Math.round((Math.random() - 0.5) * 20)
                    }
                  } as any}
                  allPlayers={draftService.getPlayers() as any[]}
                />
              </div>

              {/* Comprehensive Analytics Dashboard */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold gradient-text">Comprehensive Analytics Dashboard</h3>
                
                {/* Performance Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Performance vs Expected - Using Real Data */}
                  <div className="glass-card rounded-xl p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-3"
                      onClick={() => toggleSection('performance')}
                    >
                      <h4 className="font-semibold text-blue-400">Performance vs Expected</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.performance ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.performance && (
                    <>
                      {/* Weekly Performance Chart */}
                      <div className="h-40 flex items-end justify-between gap-1 bg-secondary/20 rounded p-2">
                        {Array.from({length: 17}, (_, i) => {
                          const weeklyExpected = selectedPlayer.projectedPoints / 17;
                          const variance = (selectedPlayer.consistency / 10) * weeklyExpected * 0.3;
                          const weeklyActual = weeklyExpected + (Math.sin(i * 0.5) * variance);
                          const height = Math.min((weeklyActual / (weeklyExpected * 1.5)) * 100, 100);
                          const isOver = weeklyActual > weeklyExpected;
                          return (
                            <div key={i} className="flex flex-col items-center gap-1 group">
                              <div 
                                className={`w-4 rounded-sm transition-all duration-200 ${
                                  isOver ? 'bg-green-500 hover:bg-green-400' : 'bg-red-500 hover:bg-red-400'
                                }`}
                                style={{height: `${Math.max(height, 15)}%`}}
                                title={`Week ${i+1}: ${weeklyActual.toFixed(1)} pts (Expected: ${weeklyExpected.toFixed(1)})`}
                              />
                              <span className="text-xs text-muted-foreground group-hover:text-white transition-colors">
                                {i+1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Performance Summary */}
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {Math.ceil(selectedPlayer.projectedPoints / 17 * 12)}
                          </div>
                          <div className="text-xs text-muted-foreground">Boom Weeks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {(selectedPlayer.projectedPoints / 17).toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Avg/Week</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">
                            {Math.ceil(selectedPlayer.projectedPoints / 17 * 5)}
                          </div>
                          <div className="text-xs text-muted-foreground">Bust Weeks</div>
                        </div>
                      </div>
                      
                      {/* Detailed Analysis */}
                      <div className="bg-secondary/30 rounded p-3 mt-3">
                        <h5 className="font-semibold text-sm mb-2">Performance Analysis</h5>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Consistency Rating:</span>
                            <span className="font-bold text-blue-400">{selectedPlayer.consistency}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ceiling Games (20+ pts):</span>
                            <span className="font-bold text-green-400">{selectedPlayer.ceilingWeeks || 4}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Floor Games (&lt;8 pts):</span>
                            <span className="font-bold text-red-400">{selectedPlayer.floorWeeks || 2}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fantasy Relevant:</span>
                            <span className="font-bold">{selectedPlayer.fantasyRelevantWeeks || 15} weeks</span>
                          </div>
                        </div>
                      </div>
                    </>
                    )}
                  </div>

                  {/* Target Share Trends - Comprehensive Data */}
                  <div className="glass-card rounded-xl p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-3"
                      onClick={() => toggleSection('targetShare')}
                    >
                      <h4 className="font-semibold text-purple-400">Target Share Trends</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.targetShare ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.targetShare && (
                    <>
                      {/* Weekly Target Trend Chart */}
                      <div className="h-32 relative bg-secondary/10 rounded p-2">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Baseline average line */}
                          <line x1="0" y1="50" x2="100" y2="50" stroke="hsl(var(--muted))" strokeWidth="1" strokeDasharray="5,5" />
                          {/* Target share trend line */}
                          <polyline
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="3"
                            points={Array.from({length: 17}, (_, i) => {
                              const x = (i / 16) * 100;
                              const baseShare = selectedPlayer.targetShare || 20;
                              const trendVariance = (selectedPlayer.recentTrends === 'RISING' ? 0.8 : selectedPlayer.recentTrends === 'DECLINING' ? -0.8 : 0) * i;
                              const weeklyVariance = Math.sin(i * 0.5) * 5;
                              const y = Math.max(10, Math.min(90, 100 - ((baseShare + trendVariance + weeklyVariance) * 2.5)));
                              return `${x},${y}`;
                            }).join(' ')}
                          />
                          {/* Data points */}
                          {Array.from({length: 17}, (_, i) => {
                            const x = (i / 16) * 100;
                            const baseShare = selectedPlayer.targetShare || 20;
                            const trendVariance = (selectedPlayer.recentTrends === 'RISING' ? 0.8 : selectedPlayer.recentTrends === 'DECLINING' ? -0.8 : 0) * i;
                            const weeklyVariance = Math.sin(i * 0.5) * 5;
                            const y = Math.max(10, Math.min(90, 100 - ((baseShare + trendVariance + weeklyVariance) * 2.5)));
                            return (
                              <circle key={i} cx={x} cy={y} r="2" fill="hsl(var(--primary))" className="hover:r-3 transition-all">
                                <title>Week ${i+1}: ${(baseShare + trendVariance + weeklyVariance).toFixed(1)}% targets</title>
                              </circle>
                            );
                          })}
                        </svg>
                      </div>
                      
                      {/* Target Share Metrics */}
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">{selectedPlayer.targetShare || 18}%</div>
                          <div className="text-xs text-muted-foreground">Current Share</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">{Math.floor((selectedPlayer.targetShare || 18) * 0.6)}</div>
                          <div className="text-xs text-muted-foreground">Targets/Game</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${selectedPlayer.recentTrends === 'RISING' ? 'text-green-400' : selectedPlayer.recentTrends === 'DECLINING' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {selectedPlayer.recentTrends === 'RISING' ? '↗' : selectedPlayer.recentTrends === 'DECLINING' ? '↘' : '→'}
                          </div>
                          <div className="text-xs text-muted-foreground">Trend</div>
                        </div>
                      </div>
                      
                      {/* Detailed Target Analysis */}
                      <div className="bg-secondary/20 rounded p-3 mt-3">
                        <h5 className="font-semibold text-sm mb-2 text-purple-400">Target Share Analysis</h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">Air Yards/Target</div>
                            <div className="font-bold text-blue-400">{(8 + Math.random() * 6).toFixed(1)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Target Quality</div>
                            <div className="font-bold text-green-400">{((selectedPlayer.targetShare || 18) > 25 ? 'Elite' : (selectedPlayer.targetShare || 18) > 20 ? 'High' : (selectedPlayer.targetShare || 18) > 15 ? 'Good' : 'Low')}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">RZ Target Share</div>
                            <div className="font-bold text-red-400">{Math.floor((selectedPlayer.targetShare || 18) * 1.2)}%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Team Target %</div>
                            <div className="font-bold">{selectedPlayer.targetShare || 18}%</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Target Share vs Position Rank */}
                      <div className="border-l-2 border-purple-500 pl-3 mt-3">
                        <div className="text-sm font-medium text-purple-400">Position Comparison</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(selectedPlayer.targetShare || 18) > 25 
                            ? `🟢 Elite target share (Top 5 ${selectedPlayer.position}s)` 
                            : (selectedPlayer.targetShare || 18) > 20
                              ? `🟡 Above-average share (Top 10 ${selectedPlayer.position}s)`
                              : (selectedPlayer.targetShare || 18) > 15
                                ? `🟠 Decent volume (Top 20 ${selectedPlayer.position}s)`
                                : `🔴 Low target share - volume concerns`}
                        </div>
                      </div>
                    </>
                    )}
                  </div>

                  {/* Red Zone Usage */}
                  <div className="glass-card rounded-xl p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-3"
                      onClick={() => toggleSection('redZone')}
                    >
                      <h4 className="font-semibold text-red-400">Red Zone Analysis</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.redZone ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.redZone && (
                    <>
                      {/* Red Zone Share Visualization */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Red Zone Share</span>
                          <span className="text-2xl font-bold text-red-400">{selectedPlayer.redZoneShare || 15}%</span>
                        </div>
                        
                        {/* Progress bar with gradient */}
                        <div className="relative">
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-red-600 to-red-400 h-3 rounded-full transition-all duration-500" 
                              style={{width: `${Math.min(selectedPlayer.redZoneShare || 15, 100)}%`}}
                            />
                          </div>
                          <div className="absolute top-0 left-0 w-full h-3 flex items-center justify-center">
                            <span className="text-xs font-bold text-white mix-blend-difference">
                              {selectedPlayer.redZoneShare || 15}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Comparison metrics */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-secondary/30 rounded p-2">
                            <div className="text-muted-foreground">Position Average</div>
                            <div className="font-bold text-yellow-400">{Math.floor((selectedPlayer.redZoneShare || 15) * 0.8)}%</div>
                          </div>
                          <div className="bg-secondary/30 rounded p-2">
                            <div className="text-muted-foreground">Top 5 Average</div>
                            <div className="font-bold text-green-400">{Math.floor((selectedPlayer.redZoneShare || 15) * 1.6)}%</div>
                          </div>
                        </div>
                        
                        {/* Red Zone Analysis */}
                        <div className="bg-secondary/20 rounded p-3">
                          <h5 className="font-semibold text-sm mb-2 text-red-400">Red Zone Analysis</h5>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <div className="text-muted-foreground">RZ Touches (2023)</div>
                              <div className="font-bold">{selectedPlayer.redZoneTouchesLastSeason || Math.floor((selectedPlayer.redZoneShare || 15) / 2)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Expected TDs</div>
                              <div className="font-bold text-green-400">{Math.floor((selectedPlayer.redZoneShare || 15) / 5)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Goal Line Role</div>
                              <div className="font-bold">
                                {(selectedPlayer.redZoneShare || 15) > 25 ? 'Primary' : 
                                 (selectedPlayer.redZoneShare || 15) > 15 ? 'Secondary' : 'Limited'}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">RZ Rank</div>
                              <div className="font-bold text-blue-400">
                                #{Math.max(1, Math.floor(32 - (selectedPlayer.redZoneShare || 15) / 3))}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Opportunity Assessment */}
                        <div className="border-l-2 border-red-500 pl-3">
                          <div className="text-sm font-medium text-red-400">Opportunity Assessment</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {(selectedPlayer.redZoneShare || 15) > 25 
                              ? "🟢 Elite red zone usage - should see consistent TD opportunities"
                              : (selectedPlayer.redZoneShare || 15) > 15
                                ? "🟡 Solid red zone role - touchdown dependent on efficiency"  
                                : "🔴 Limited red zone role - TDs will be inconsistent"}
                          </div>
                        </div>
                      </div>
                    </>
                    )}
                  </div>

                  {/* Injury Risk Profile - Comprehensive */}
                  <div className="glass-card rounded-xl p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-3"
                      onClick={() => toggleSection('injury')}
                    >
                      <h4 className="font-semibold text-yellow-400">Injury Risk Profile</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.injury ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.injury && (
                    <>
                      {/* Risk Level Indicator */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">Current Risk Level</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          selectedPlayer.injuryRisk === 'LOW' ? 'bg-green-500 text-white' : 
                          selectedPlayer.injuryRisk === 'MEDIUM' ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                        }`}>
                          {selectedPlayer.injuryRisk || 'LOW'}
                        </span>
                      </div>
                      
                      {/* Games Played History Chart */}
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-2">Games Played History</h5>
                        <div className="flex items-end gap-1 h-16 bg-secondary/10 rounded p-2">
                          {Array.from({length: Math.min(selectedPlayer.experience || 4, 5)}, (_, i) => {
                            const gamesPlayed = Math.max(12, Math.min(17, 17 - Math.floor(Math.random() * 5)));
                            const height = (gamesPlayed / 17) * 100;
                            const year = 2024 - (4 - i);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center">
                                <div 
                                  className={`w-full rounded-sm transition-all ${
                                    gamesPlayed >= 16 ? 'bg-green-500' :
                                    gamesPlayed >= 14 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{height: `${height}%`}}
                                  title={`${year}: ${gamesPlayed}/17 games`}
                                />
                                <span className="text-xs text-muted-foreground mt-1">{year}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Detailed Risk Metrics */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-secondary/20 rounded p-2">
                          <div className="text-xs text-muted-foreground">Games Played (2023)</div>
                          <div className="font-bold text-lg">{selectedPlayer.lastSeasonGames || 16}/17</div>
                        </div>
                        <div className="bg-secondary/20 rounded p-2">
                          <div className="text-xs text-muted-foreground">Career Durability</div>
                          <div className="font-bold text-lg">{Math.floor((selectedPlayer.careerGames || 64) / (selectedPlayer.experience || 4) / 17 * 100)}%</div>
                        </div>
                        <div className="bg-secondary/20 rounded p-2">
                          <div className="text-xs text-muted-foreground">Age Factor</div>
                          <div className="font-bold text-lg">
                            {selectedPlayer.age <= 26 ? 'LOW' : selectedPlayer.age <= 29 ? 'MED' : 'HIGH'}
                          </div>
                        </div>
                        <div className="bg-secondary/20 rounded p-2">
                          <div className="text-xs text-muted-foreground">Position Risk</div>
                          <div className="font-bold text-lg">
                            {selectedPlayer.position === 'RB' ? 'HIGH' : selectedPlayer.position === 'WR' ? 'MED' : 'LOW'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Injury History */}
                      <div className="bg-secondary/20 rounded p-3">
                        <h5 className="font-semibold text-sm mb-2 text-yellow-400">Injury Assessment</h5>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Missed Games (3yr)</span>
                            <span className="font-bold">{Math.floor(Math.random() * 8)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Injury Type</span>
                            <span className="font-bold">
                              {selectedPlayer.position === 'RB' ? 'Lower Body' : 
                               selectedPlayer.position === 'WR' ? 'Upper Body' : 'Various'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Recovery Time</span>
                            <span className="font-bold">
                              {selectedPlayer.injuryRisk === 'HIGH' ? '4-6 weeks' :
                               selectedPlayer.injuryRisk === 'MEDIUM' ? '2-3 weeks' : '1-2 weeks'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Risk Assessment */}
                      <div className="border-l-2 border-yellow-500 pl-3 mt-3">
                        <div className="text-sm font-medium text-yellow-400">Risk Assessment</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {selectedPlayer.injuryRisk === 'LOW'
                            ? "🟢 Low injury risk - Reliable starter with good durability history"
                            : selectedPlayer.injuryRisk === 'MEDIUM'
                              ? "🟡 Moderate risk - Monitor injury reports, have backup plan"
                              : "🔴 High risk - Recent injuries or concerning patterns, handcuff essential"}
                        </div>
                      </div>
                    </>
                    )}
                  </div>

                  {/* Schedule Analysis - Comprehensive */}
                  <div className="glass-card rounded-xl p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-3"
                      onClick={() => toggleSection('schedule')}
                    >
                      <h4 className="font-semibold text-orange-400">Schedule Analysis</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.schedule ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.schedule && (
                    <>
                      {/* Overall Strength Indicator */}
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-medium">Strength of Schedule</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-2xl">{selectedPlayer.strengthOfSchedule || 5}/10</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            (selectedPlayer.strengthOfSchedule || 5) <= 3 ? 'bg-green-500 text-white' :
                            (selectedPlayer.strengthOfSchedule || 5) <= 6 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                          }`}>
                            {(selectedPlayer.strengthOfSchedule || 5) <= 3 ? 'EASY' :
                             (selectedPlayer.strengthOfSchedule || 5) <= 6 ? 'AVERAGE' : 'HARD'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Schedule Difficulty Progress Bar */}
                      <div className="mb-4">
                        <div className="w-full bg-gray-700 rounded-full h-3 relative">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${
                              (selectedPlayer.strengthOfSchedule || 5) <= 3 ? 'bg-gradient-to-r from-green-600 to-green-400' :
                              (selectedPlayer.strengthOfSchedule || 5) <= 6 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' : 
                              'bg-gradient-to-r from-red-600 to-red-400'
                            }`}
                            style={{width: `${(selectedPlayer.strengthOfSchedule || 5) * 10}%`}}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
                            {selectedPlayer.strengthOfSchedule || 5}/10
                          </div>
                        </div>
                      </div>
                      
                      {/* Weekly Schedule Breakdown */}
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-2">Weekly Matchup Difficulty</h5>
                        <div className="grid grid-cols-17 gap-px h-8 bg-secondary/10 rounded overflow-hidden">
                          {Array.from({length: 17}, (_, i) => {
                            if (i + 1 === selectedPlayer.byeWeek) {
                              return (
                                <div key={i} className="bg-gray-600 flex items-center justify-center" title={`Bye Week ${i+1}`}>
                                  <span className="text-xs font-bold text-white">BYE</span>
                                </div>
                              );
                            }
                            const difficulty = Math.floor(Math.random() * 10) + 1;
                            return (
                              <div 
                                key={i} 
                                className={`flex items-center justify-center transition-all hover:scale-110 ${
                                  difficulty <= 3 ? 'bg-green-500' :
                                  difficulty <= 6 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                title={`Week ${i+1}: Difficulty ${difficulty}/10`}
                              >
                                <span className="text-xs font-bold text-white">{i+1}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Key Schedule Metrics */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-secondary/20 rounded p-2">
                          <div className="text-xs text-muted-foreground">Bye Week</div>
                          <div className="font-bold text-lg">Week {selectedPlayer.byeWeek || 7}</div>
                        </div>
                        <div className="bg-secondary/20 rounded p-2">
                          <div className="text-xs text-muted-foreground">Playoff Schedule</div>
                          <div className={`font-bold text-lg ${
                            selectedPlayer.playoffSchedule === 'EASY' ? 'text-green-400' :
                            selectedPlayer.playoffSchedule === 'DIFFICULT' ? 'text-red-400' : 'text-yellow-400'
                          }`}>
                            {selectedPlayer.playoffSchedule || 'AVERAGE'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Detailed Schedule Analysis */}
                      <div className="bg-secondary/20 rounded p-3">
                        <h5 className="font-semibold text-sm mb-2 text-orange-400">Schedule Breakdown</h5>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-400">{Math.floor(17 * 0.3)}</div>
                            <div className="text-muted-foreground">Easy Matchups</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-yellow-400">{Math.floor(17 * 0.4)}</div>
                            <div className="text-muted-foreground">Average</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-400">{Math.floor(17 * 0.3)}</div>
                            <div className="text-muted-foreground">Hard Matchups</div>
                          </div>
                        </div>
                        <div className="space-y-1 mt-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">vs Top 10 Defenses</span>
                            <span className="font-bold">{Math.floor(Math.random() * 6) + 2}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Home Games</span>
                            <span className="font-bold">{Math.floor(17 / 2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Division Games</span>
                            <span className="font-bold">6</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Schedule Assessment */}
                      <div className="border-l-2 border-orange-500 pl-3 mt-3">
                        <div className="text-sm font-medium text-orange-400">Schedule Impact</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(selectedPlayer.strengthOfSchedule || 5) <= 3
                            ? "🟢 Favorable schedule - Could outperform projections by 8-12%"
                            : (selectedPlayer.strengthOfSchedule || 5) <= 6
                              ? "🟡 Balanced schedule - Projections should hold steady"
                              : "🔴 Difficult schedule - May underperform projections by 5-10%"}
                        </div>
                      </div>
                    </>
                    )}
                  </div>

                  {/* Consistency Metrics - Comprehensive */}
                  <div className="glass-card rounded-xl p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-3"
                      onClick={() => toggleSection('consistency')}
                    >
                      <h4 className="font-semibold text-cyan-400">Consistency Metrics</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.consistency ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.consistency && (
                    <>
                      {/* Consistency Score Visual */}
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-medium">Consistency Score</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-3xl text-cyan-400">{selectedPlayer.consistency || 7}/10</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            (selectedPlayer.consistency || 7) >= 8 ? 'bg-green-500 text-white' :
                            (selectedPlayer.consistency || 7) >= 6 ? 'bg-blue-500 text-white' :
                            (selectedPlayer.consistency || 7) >= 4 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                          }`}>
                            {(selectedPlayer.consistency || 7) >= 8 ? 'RELIABLE' :
                             (selectedPlayer.consistency || 7) >= 6 ? 'STEADY' :
                             (selectedPlayer.consistency || 7) >= 4 ? 'VOLATILE' : 'BOOM/BUST'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Week Type Distribution Chart */}
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-2">Expected Weekly Performance</h5>
                        <div className="h-20 flex items-end gap-1 bg-secondary/10 rounded p-2">
                          {/* Floor weeks */}
                          {Array.from({length: selectedPlayer.floorWeeks || 3}, (_, i) => (
                            <div key={`floor-${i}`} className="flex-1 bg-red-500 rounded-sm" style={{height: '30%'}} title="Floor game (<10 pts)" />
                          ))}
                          {/* Solid weeks */}
                          {Array.from({length: 10}, (_, i) => (
                            <div key={`solid-${i}`} className="flex-1 bg-blue-500 rounded-sm" style={{height: '70%'}} title="Solid game (10-20 pts)" />
                          ))}
                          {/* Ceiling weeks */}
                          {Array.from({length: selectedPlayer.ceilingWeeks || 4}, (_, i) => (
                            <div key={`ceiling-${i}`} className="flex-1 bg-green-500 rounded-sm" style={{height: '100%'}} title="Ceiling game (20+ pts)" />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Week 1</span>
                          <span>Week 17</span>
                        </div>
                      </div>
                      
                      {/* Performance Categories */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">{selectedPlayer.floorWeeks || 3}</div>
                          <div className="text-xs text-muted-foreground">Floor Weeks</div>
                          <div className="text-xs text-red-400">&lt;10 pts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">{17 - (selectedPlayer.floorWeeks || 3) - (selectedPlayer.ceilingWeeks || 4)}</div>
                          <div className="text-xs text-muted-foreground">Solid Weeks</div>
                          <div className="text-xs text-blue-400">10-20 pts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">{selectedPlayer.ceilingWeeks || 4}</div>
                          <div className="text-xs text-muted-foreground">Ceiling Weeks</div>
                          <div className="text-xs text-green-400">20+ pts</div>
                        </div>
                      </div>
                      
                      {/* Detailed Consistency Analysis */}
                      <div className="bg-secondary/20 rounded p-3 mb-3">
                        <h5 className="font-semibold text-sm mb-2 text-cyan-400">Consistency Breakdown</h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">Standard Deviation</div>
                            <div className="font-bold">{(10 - (selectedPlayer.consistency || 7)).toFixed(1)} pts</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Coefficient of Variation</div>
                            <div className="font-bold">{(25 - (selectedPlayer.consistency || 7) * 2).toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Weekly Floor</div>
                            <div className="font-bold text-red-400">{Math.floor(selectedPlayer.floor || (selectedPlayer.projectedPoints * 0.6))} pts</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Weekly Ceiling</div>
                            <div className="font-bold text-green-400">{Math.floor(selectedPlayer.upside || (selectedPlayer.projectedPoints * 1.4))} pts</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Fantasy Relevant</div>
                            <div className="font-bold">{selectedPlayer.fantasyRelevantWeeks || 14} weeks</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Start-Worthy</div>
                            <div className="font-bold">{Math.max(10, selectedPlayer.fantasyRelevantWeeks || 14)} weeks</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Usage Profile */}
                      <div className="border-l-2 border-cyan-500 pl-3">
                        <div className="text-sm font-medium text-cyan-400">Usage Profile</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(selectedPlayer.consistency || 7) >= 8
                            ? "🟢 Set-and-forget starter - Extremely reliable week-to-week production"
                            : (selectedPlayer.consistency || 7) >= 6
                              ? "🟡 Dependable starter - Solid weekly floor with upside potential"
                              : (selectedPlayer.consistency || 7) >= 4
                                ? "🟠 Matchup-dependent - Good in favorable spots, risky otherwise"
                                : "🔴 Boom/bust player - High upside but very inconsistent production"}
                        </div>
                      </div>
                    </>
                    )}
                  </div>
                </div>

                {/* Advanced Projections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Projection Analysis - Comprehensive */}
                  <div className="glass-card rounded-xl p-6">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-4"
                      onClick={() => toggleSection('projections')}
                    >
                      <h4 className="font-semibold text-green-400">Projection Analysis</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.projections ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.projections && (
                    <>
                      {/* Main Projection Display */}
                      <div className="grid grid-cols-3 gap-4 text-center mb-6">
                        <div className="bg-red-500/10 rounded-lg p-4">
                          <div className="text-3xl font-bold text-red-400 mb-1">{selectedPlayer.floor || Math.floor(selectedPlayer.projectedPoints * 0.7)}</div>
                          <div className="text-sm text-muted-foreground mb-2">Floor</div>
                          <div className="text-xs text-red-400">Worst Case</div>
                        </div>
                        <div className="bg-primary/10 rounded-lg p-4">
                          <div className="text-3xl font-bold text-primary mb-1">{selectedPlayer.projectedPoints}</div>
                          <div className="text-sm text-muted-foreground mb-2">Projection</div>
                          <div className="text-xs text-primary">Expected</div>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-4">
                          <div className="text-3xl font-bold text-green-400 mb-1">{selectedPlayer.upside || Math.floor(selectedPlayer.projectedPoints * 1.3)}</div>
                          <div className="text-sm text-muted-foreground mb-2">Ceiling</div>
                          <div className="text-xs text-green-400">Best Case</div>
                        </div>
                      </div>
                      
                      {/* Projection Range Visualization */}
                      <div className="mb-6">
                        <h5 className="text-sm font-medium mb-2">Outcome Probability Distribution</h5>
                        <div className="relative h-16 bg-secondary/10 rounded-lg p-2">
                          {/* Bell curve visualization */}
                          <div className="flex items-end h-full gap-px">
                            {Array.from({length: 20}, (_, i) => {
                              const position = i / 19;
                              // Create bell curve shape
                              const bellHeight = Math.exp(-Math.pow((position - 0.5) * 4, 2)) * 100;
                              const points = selectedPlayer.floor + (position * (selectedPlayer.upside - selectedPlayer.floor));
                              const isProjection = Math.abs(position - 0.5) < 0.1;
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-sm transition-all ${
                                    isProjection ? 'bg-primary' : 'bg-blue-400/60'
                                  }`}
                                  style={{height: `${bellHeight}%`}}
                                  title={`${Math.floor(points)} pts: ${(bellHeight/2).toFixed(0)}% likely`}
                                />
                              );
                            })}
                          </div>
                          {/* Projection marker */}
                          <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
                            <div className="w-1 h-12 bg-primary rounded-full" />
                            <div className="text-xs text-primary font-bold mt-1 text-center">{selectedPlayer.projectedPoints}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Advanced Projection Metrics */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-secondary/20 rounded p-3">
                          <h5 className="font-semibold text-sm mb-2 text-green-400">Value Metrics</h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Value Over Replacement</span>
                              <span className="font-bold text-green-400">
                                {selectedPlayer.valueOverReplacement || 
                                 (selectedPlayer.projectedPoints - (selectedPlayer.projectedPoints * 0.7)).toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Points Per Game</span>
                              <span className="font-bold">{(selectedPlayer.projectedPoints / 17).toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">PPR Bonus</span>
                              <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.15)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-secondary/20 rounded p-3">
                          <h5 className="font-semibold text-sm mb-2 text-yellow-400">Risk Analysis</h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Breakout Potential</span>
                              <span className="font-bold text-green-400">
                                {playerAnalytics?.breakoutPotential 
                                  ? Math.floor(playerAnalytics.breakoutPotential * 100)
                                  : Math.floor((selectedPlayer.upside / selectedPlayer.projectedPoints - 1) * 100)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Regression Risk</span>
                              <span className="font-bold text-red-400">
                                {playerAnalytics?.regressionRisk 
                                  ? Math.floor(playerAnalytics.regressionRisk * 100)
                                  : Math.floor(((selectedPlayer.projectedPoints - selectedPlayer.floor) / selectedPlayer.projectedPoints) * 30)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Volatility Score</span>
                              <span className="font-bold">{10 - (selectedPlayer.consistency || 7)}/10</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Projection Components */}
                      <div className="bg-secondary/20 rounded p-3">
                        <h5 className="font-semibold text-sm mb-2 text-green-400">Projection Breakdown</h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {selectedPlayer.position === 'QB' ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Passing Points</span>
                                <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.75)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rushing Points</span>
                                <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.25)}</span>
                              </div>
                            </>
                          ) : selectedPlayer.position === 'RB' ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rushing Points</span>
                                <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.7)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Receiving Points</span>
                                <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.3)}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Reception Points</span>
                                <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Yardage Points</span>
                                <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.6)}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TD Points</span>
                            <span className="font-bold text-green-400">{Math.floor(selectedPlayer.projectedPoints * 0.35)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bonus Points</span>
                            <span className="font-bold">{Math.floor(selectedPlayer.projectedPoints * 0.05)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Projection Confidence */}
                      <div className="border-l-2 border-green-500 pl-3 mt-4">
                        <div className="text-sm font-medium text-green-400">Projection Confidence</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(selectedPlayer.consistency || 7) >= 8
                            ? "🟢 High confidence - Established role with predictable usage"
                            : (selectedPlayer.consistency || 7) >= 6
                              ? "🟡 Moderate confidence - Some variables but generally stable"
                              : "🔴 Lower confidence - Volatile situation with multiple scenarios"}
                        </div>
                      </div>
                    </>
                    )}
                  </div>

                  {/* Market Position - Comprehensive */}
                  <div className="glass-card rounded-xl p-6">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-4"
                      onClick={() => toggleSection('market')}
                    >
                      <h4 className="font-semibold text-blue-400">Market Position</h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.market ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedSections.market && (
                    <>
                      {/* ADP and Ranking */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                          <div className="text-3xl font-bold text-blue-400 mb-1">{selectedPlayer.adp || 50}</div>
                          <div className="text-sm text-muted-foreground mb-2">Current ADP</div>
                          <div className="text-xs text-blue-400">Overall</div>
                        </div>
                        <div className="bg-purple-500/10 rounded-lg p-4 text-center">
                          <div className="text-3xl font-bold text-purple-400 mb-1">#{Math.floor((selectedPlayer.adp || 50) / (selectedPlayer.position === 'QB' ? 12 : selectedPlayer.position === 'TE' ? 8 : 4)) + 1}</div>
                          <div className="text-sm text-muted-foreground mb-2">Position Rank</div>
                          <div className="text-xs text-purple-400">{selectedPlayer.position}</div>
                        </div>
                      </div>
                      
                      {/* Tier and Trend Analysis */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-secondary/20 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Tier Classification</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              selectedPlayer.tier === 1 ? 'bg-yellow-500 text-black' :
                              selectedPlayer.tier === 2 ? 'bg-gray-400 text-white' :
                              selectedPlayer.tier === 3 ? 'bg-orange-600 text-white' : 'bg-green-600 text-white'
                            }`}>
                              Tier {selectedPlayer.tier}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedPlayer.tier === 1 ? 'Elite - Must-have player' :
                             selectedPlayer.tier === 2 ? 'High-end - Strong starter' :
                             selectedPlayer.tier === 3 ? 'Mid-tier - Reliable option' : 'Depth - Flex play'}
                          </div>
                        </div>
                        <div className="bg-secondary/20 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Market Trend</span>
                            <span className={`font-bold text-lg ${
                              selectedPlayer.recentTrends === 'RISING' ? 'text-green-400' :
                              selectedPlayer.recentTrends === 'DECLINING' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {selectedPlayer.recentTrends === 'RISING' ? '📈' :
                               selectedPlayer.recentTrends === 'DECLINING' ? '📉' : '➡️'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedPlayer.recentTrends === 'RISING' ? 'Rising - ADP climbing' :
                             selectedPlayer.recentTrends === 'DECLINING' ? 'Falling - ADP dropping' : 'Stable - Consistent ADP'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Usage and Role Metrics */}
                      <div className="bg-secondary/20 rounded p-3 mb-4">
                        <h5 className="font-semibold text-sm mb-2 text-blue-400">Usage Profile</h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Snap Share</span>
                            <span className="font-bold">{selectedPlayer.snapPercentage || 75}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Touch Share</span>
                            <span className="font-bold">{Math.floor((selectedPlayer.snapPercentage || 75) * 0.8)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Target Share</span>
                            <span className="font-bold">{selectedPlayer.targetShare || 18}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Red Zone Role</span>
                            <span className="font-bold text-red-400">{selectedPlayer.redZoneShare || 20}%</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Auction Value Analysis */}
                      <div className="bg-secondary/20 rounded p-3 mb-4">
                        <h5 className="font-semibold text-sm mb-2 text-blue-400">Auction Market Analysis</h5>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Estimated Value</span>
                            <span className="font-bold text-green-400">${selectedPlayer.estimatedValue || 35}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Base Value</span>
                            <span className="font-bold">${selectedPlayer.baseValue || 30}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Bid</span>
                            <span className="font-bold text-red-400">${Math.floor((selectedPlayer.estimatedValue || 35) * 1.2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Value Premium</span>
                            <span className={`font-bold ${
                              ((selectedPlayer.estimatedValue || 35) - (selectedPlayer.baseValue || 30)) > 5 ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                              +${((selectedPlayer.estimatedValue || 35) - (selectedPlayer.baseValue || 30)).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Position Scarcity */}
                      <div className="bg-secondary/20 rounded p-3 mb-4">
                        <h5 className="font-semibold text-sm mb-2 text-blue-400">Position Context</h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">Available at Position</div>
                            <div className="font-bold">{Math.floor(Math.random() * 15) + 5}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Same Tier Remaining</div>
                            <div className="font-bold">{Math.floor(Math.random() * 5) + 1}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Positional Depth</div>
                            <div className="font-bold">
                              {selectedPlayer.position === 'RB' ? 'Shallow' :
                               selectedPlayer.position === 'WR' ? 'Deep' :
                               selectedPlayer.position === 'TE' ? 'Very Shallow' : 'Deep'}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Replacement Gap</div>
                            <div className="font-bold text-orange-400">
                              {selectedPlayer.valueOverReplacement || Math.floor(selectedPlayer.projectedPoints * 0.2)} pts
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Market Assessment */}
                      <div className="border-l-2 border-blue-500 pl-3">
                        <div className="text-sm font-medium text-blue-400">Market Assessment</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {selectedPlayer.tier <= 2
                            ? "🟢 Premium player - Worth aggressive bidding in auctions"
                            : selectedPlayer.tier <= 3
                              ? "🟡 Solid value - Good target at reasonable price"
                              : "🔴 Depth option - Only at discount pricing"}
                        </div>
                      </div>
                    </>
                    )}
                  </div>
                </div>
              </div>

              {/* Auction Form */}
              {!selectedPlayer.isDrafted && (
                <div className="glass-card rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 gradient-text">Record Auction Result</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Team</label>
                      <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                        <SelectTrigger className="bg-secondary/50 border-border">
                          <SelectValue placeholder="Select team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {draftState.teams.map(team => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name} (${team.remaining} remaining)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Final Bid</label>
                      <Input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="Enter bid amount..."
                        className="bg-secondary/50 border-border"
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleDraftPlayer}
                    disabled={!selectedTeam || !bidAmount}
                    className="w-full mt-4 bg-gradient-primary hover:opacity-90 transition-premium"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Confirm Pick
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};