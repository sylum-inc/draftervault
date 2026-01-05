import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Clock, Users, Trophy, Target, Play, Pause, SkipForward } from 'lucide-react';
import { Player, Team, AuctionDraftService, SnakeDraftPlayer } from '@/services/auctionDraftService';

interface SnakeDraftInterfaceProps {
  draftService: AuctionDraftService;
  teams: Team[];
  onDraftComplete: () => void;
}

export const SnakeDraftInterface: React.FC<SnakeDraftInterfaceProps> = ({ 
  draftService, 
  teams, 
  onDraftComplete 
}) => {
  const [availablePlayers, setAvailablePlayers] = useState<SnakeDraftPlayer[]>([]);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [currentPick, setCurrentPick] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('All');
  const [filteredPlayers, setFilteredPlayers] = useState<SnakeDraftPlayer[]>([]);
  const [draftHistory, setDraftHistory] = useState<Array<{
    pick: number;
    round: number;
    teamId: string;
    player: SnakeDraftPlayer;
  }>>([]);

  useEffect(() => {
    // Initialize snake draft players (all NFL players excluding the 60 auction players)
    const snakePlayers = draftService.getSnakeDraftPlayers();
    setAvailablePlayers(snakePlayers);
    
    // Create snake draft order (1-2-3-4-4-3-2-1...)
    const totalRounds = 15; // Standard snake draft rounds
    const order: string[] = [];
    
    for (let round = 0; round < totalRounds; round++) {
      if (round % 2 === 0) {
        // Forward order (1-2-3-4)
        teams.forEach(team => order.push(team.id));
      } else {
        // Reverse order (4-3-2-1)
        teams.slice().reverse().forEach(team => order.push(team.id));
      }
    }
    
    setDraftOrder(order);
  }, [draftService, teams]);

  useEffect(() => {
    // Filter available players based on search and position
    let filtered = availablePlayers.filter(p => !p.isDrafted);
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.team.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedPosition !== 'All') {
      filtered = filtered.filter(p => p.position === selectedPosition);
    }
    
    // Sort by tier and then estimated value
    filtered.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.estimatedValue - a.estimatedValue;
    });
    
    setFilteredPlayers(filtered);
  }, [availablePlayers, searchQuery, selectedPosition]);

  const getCurrentTeam = () => {
    if (currentPick >= draftOrder.length) return null;
    return teams.find(t => t.id === draftOrder[currentPick]);
  };

  const getCurrentRound = () => {
    return Math.floor(currentPick / teams.length) + 1;
  };

  const getCurrentPickInRound = () => {
    return (currentPick % teams.length) + 1;
  };

  const draftPlayer = (player: SnakeDraftPlayer) => {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    // Mark player as drafted
    const updatedPlayer = { ...player, isDrafted: true, draftedBy: currentTeam.id, pickNumber: currentPick + 1 };
    
    // Update available players
    setAvailablePlayers(prev => 
      prev.map(p => p.id === player.id ? updatedPlayer : p)
    );

    // Add to draft history
    setDraftHistory(prev => [...prev, {
      pick: currentPick + 1,
      round: getCurrentRound(),
      teamId: currentTeam.id,
      player: updatedPlayer
    }]);

    // Move to next pick
    setCurrentPick(prev => prev + 1);

    // Check if draft is complete
    if (currentPick + 1 >= draftOrder.length || availablePlayers.filter(p => !p.isDrafted).length <= 1) {
      onDraftComplete();
    }
  };

  const simulateNextPick = () => {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    // Get team's roster to determine positional need
    const teamRoster = draftHistory.filter(h => h.teamId === currentTeam.id);
    const positionCounts = {
      QB: teamRoster.filter(h => h.player.position === 'QB').length,
      RB: teamRoster.filter(h => h.player.position === 'RB').length,
      WR: teamRoster.filter(h => h.player.position === 'WR').length,
      TE: teamRoster.filter(h => h.player.position === 'TE').length,
    };

    // Find positional need (prioritize positions with fewer players)
    const needyPositions = Object.entries(positionCounts)
      .sort(([,a], [,b]) => a - b)
      .map(([pos]) => pos);

    // Get available players prioritizing positional need
    const undraftedPlayers = availablePlayers.filter(p => !p.isDrafted);
    let targetPlayer = undraftedPlayers.find(p => p.position === needyPositions[0]);
    
    // If no player in most needed position, take best available
    if (!targetPlayer) {
      targetPlayer = undraftedPlayers.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return b.estimatedValue - a.estimatedValue;
      })[0];
    }

    if (targetPlayer) {
      draftPlayer(targetPlayer);
    }
  };

  const startSimulation = () => {
    setIsSimulating(true);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
  };

  useEffect(() => {
    if (isSimulating && currentPick < draftOrder.length) {
      const timer = setTimeout(() => {
        simulateNextPick();
      }, 2000); // 2 second delay between picks

      return () => clearTimeout(timer);
    } else if (isSimulating) {
      setIsSimulating(false);
    }
  }, [isSimulating, currentPick]);

  const isDraftComplete = currentPick >= draftOrder.length || availablePlayers.filter(p => !p.isDrafted).length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Snake Draft
        </h1>
        <div className="flex items-center justify-center gap-6 text-lg">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span>Round {getCurrentRound()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            <span>Pick {getCurrentPickInRound()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span>{availablePlayers.filter(p => !p.isDrafted).length} Available</span>
          </div>
        </div>
      </div>

      {/* Current Pick Info */}
      {!isDraftComplete && (
        <Card className="glass-card border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {getCurrentTeam()?.name}'s Pick
                </div>
                <div className="text-muted-foreground">
                  Pick #{currentPick + 1} • Round {getCurrentRound()}
                </div>
              </div>
              <div className="flex gap-3">
                {!isSimulating ? (
                  <Button onClick={startSimulation} className="bg-green-500 hover:bg-green-600">
                    <Play className="w-4 h-4 mr-2" />
                    Auto Draft
                  </Button>
                ) : (
                  <Button onClick={stopSimulation} variant="destructive">
                    <Pause className="w-4 h-4 mr-2" />
                    Stop Auto
                  </Button>
                )}
                <Button onClick={simulateNextPick} variant="outline">
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip Pick
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search available players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-border"
            />
          </div>
          
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-32 bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Pos</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
              <SelectItem value="K">K</SelectItem>
              <SelectItem value="DST">DST</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Available Players */}
      {!isDraftComplete && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.slice(0, 20).map((player) => (
            <Card
              key={player.id}
              className="glass-card cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
              onClick={() => !isSimulating && draftPlayer(player)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge 
                    className={`
                      ${player.position === 'QB' ? 'bg-red-500' : 
                        player.position === 'RB' ? 'bg-green-500' : 
                        player.position === 'WR' ? 'bg-blue-500' : 'bg-yellow-500'} 
                      text-white
                    `}
                  >
                    {player.position}
                  </Badge>
                  <Badge variant="outline">Tier {player.tier}</Badge>
                </div>
                
                <div className="space-y-1">
                  <div className="font-bold text-lg">{player.name}</div>
                  <div className="text-sm text-muted-foreground">{player.team}</div>
                  <div className="text-xs text-accent">
                    {player.projectedPoints} projected points
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Draft History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {draftHistory.slice(-10).reverse().map((pick) => {
              const team = teams.find(t => t.id === pick.teamId);
              return (
                <div key={`${pick.pick}`} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary text-white">#{pick.pick}</Badge>
                    <div>
                      <div className="font-bold">{pick.player.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {pick.player.position} • {pick.player.team}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{team?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Round {pick.round}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isDraftComplete && (
        <Card className="glass-card text-center">
          <CardContent className="p-8">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Snake Draft Complete!</h2>
            <p className="text-muted-foreground mb-6">
              All available players have been drafted. Check your final rosters!
            </p>
            <Button onClick={onDraftComplete} className="bg-gradient-to-r from-primary to-accent">
              View Final Results
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};