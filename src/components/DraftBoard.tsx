import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Edit3, ChevronDown, ChevronUp, Users, DollarSign, Clock, Trophy } from 'lucide-react';
import { Team, SnakeDraftPlayer, Player } from '@/services/auctionDraftService';

interface DraftBoardProps {
  teams: Team[];
  draftHistory: Array<{
    pick: number;
    round: number;
    teamId: string;
    player: SnakeDraftPlayer;
  }>;
  availablePlayers: SnakeDraftPlayer[];
  onEditPick: (pickIndex: number, newPlayer: SnakeDraftPlayer) => void;
  auctionService: any;
  currentPick: number;
}

export const DraftBoard: React.FC<DraftBoardProps> = ({
  teams,
  draftHistory,
  availablePlayers,
  onEditPick,
  auctionService,
  currentPick
}) => {
  const [editingPick, setEditingPick] = useState<number | null>(null);
  const [selectedReplacement, setSelectedReplacement] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  const rounds = 15;
  const totalPicks = teams.length * rounds;

  const getPickAtPosition = (round: number, position: number) => {
    const isEvenRound = round % 2 === 1;
    const pickNumber = isEvenRound 
      ? (round - 1) * teams.length + position
      : (round - 1) * teams.length + (teams.length - position + 1);
    
    return draftHistory.find(h => h.pick === pickNumber);
  };

  const getTeamAtPosition = (round: number, position: number) => {
    const isEvenRound = round % 2 === 1;
    return isEvenRound ? teams[position - 1] : teams[teams.length - position];
  };

  const getTeamAuctionValue = (teamId: string) => {
    const auctionPlayers = auctionService.getAuctionPlayers().filter((p: Player) => p.draftedBy === teamId);
    return auctionPlayers.reduce((total: number, player: Player) => total + (player.draftCost || 0), 0);
  };

  const getAuctionPicks = (teamId: string) => {
    return auctionService.getAuctionPlayers().filter((p: Player) => p.draftedBy === teamId);
  };

  const getRecentPicks = () => {
    return draftHistory.slice(-3);
  };

  const getUpcomingTeams = () => {
    const upcoming = [];
    for (let i = 0; i < 3; i++) {
      const pickNum = currentPick + i;
      if (pickNum < totalPicks) {
        const round = Math.floor(pickNum / teams.length) + 1;
        const position = pickNum % teams.length;
        const isEvenRound = round % 2 === 0;
        const teamIndex = isEvenRound ? teams.length - 1 - position : position;
        upcoming.push({
          pickNumber: pickNum + 1,
          team: teams[teamIndex],
          round
        });
      }
    }
    return upcoming;
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return '#ef4444';
      case 'RB': return '#22c55e';
      case 'WR': return '#3b82f6';
      case 'TE': return '#f59e0b';
      case 'K': return '#8b5cf6';
      case 'DST': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const handleEditPick = (pickIndex: number) => {
    if (selectedReplacement) {
      const newPlayer = availablePlayers.find(p => p.id === selectedReplacement);
      if (newPlayer) {
        onEditPick(pickIndex, newPlayer);
        setEditingPick(null);
        setSelectedReplacement('');
      }
    }
  };

  const recentPicks = getRecentPicks();
  const upcomingTeams = getUpcomingTeams();

  return (
    <div className="w-full">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Collapsed Bar View */}
        <Card className="glass-card mb-4">
          <CardContent className="p-4">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Draft Board</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                  
                  {!isExpanded && (
                    <>
                      {/* Recent Picks */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Recent:</span>
                        <div className="flex gap-2">
                          {recentPicks.map((pick, index) => (
                            <div key={pick.pick} className="flex items-center gap-1 text-xs bg-secondary/50 rounded px-2 py-1">
                              <span className="font-medium">{pick.player.name}</span>
                              <Badge variant="outline" className="text-xs h-4">
                                {pick.player.position}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Upcoming Teams */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Up:</span>
                        <div className="flex gap-2">
                          {upcomingTeams.map((upcoming, index) => (
                            <div key={upcoming.pickNumber} className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                              index === 0 ? 'bg-primary/20 text-primary font-medium' : 'bg-muted/50'
                            }`}>
                              <span>{upcoming.team.name}</span>
                              <span className="text-xs opacity-70">#{upcoming.pickNumber}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!isExpanded && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Pick {currentPick + 1} of {totalPicks}</span>
                  </div>
                )}
              </div>
            </CollapsibleTrigger>

            {/* Expanded Content */}
            <CollapsibleContent className="mt-4">
              {/* Team Headers with Auction Values */}
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="grid grid-cols-4 gap-2">
                  {teams.map(team => {
                    const auctionPicks = getAuctionPicks(team.id);
                    return (
                      <div key={team.id} className="text-center p-3 bg-secondary/50 rounded-lg">
                        <div className="font-bold text-sm">{team.name}</div>
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="w-3 h-3" />
                          Auction: ${getTeamAuctionValue(team.id)}
                        </div>
                        <div className="flex items-center justify-center gap-1 text-xs">
                          <Users className="w-3 h-3" />
                          Snake: {draftHistory.filter(h => h.teamId === team.id).length}/15
                        </div>
                        {auctionPicks.length > 0 && (
                          <div className="text-xs mt-1 text-primary">
                            {auctionPicks.length} auction picks
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auction Picks Section */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Auction Results
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {teams.map(team => {
                    const auctionPicks = getAuctionPicks(team.id);
                    return (
                      <div key={`auction-${team.id}`} className="space-y-1">
                        <div className="font-medium text-sm text-center">{team.name}</div>
                        {auctionPicks.map(player => (
                          <div key={player.id} className="text-xs bg-amber-500/20 border border-amber-500/30 rounded p-2">
                            <div className="font-medium">{player.name}</div>
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className="text-xs">
                                {player.position}
                              </Badge>
                              <span className="font-bold">${player.draftCost}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Draft Grid */}
              <div className="space-y-2">
                <h3 className="font-semibold mb-3">Snake Draft Picks</h3>
                {Array.from({ length: rounds }, (_, roundIndex) => {
                  const round = roundIndex + 1;
                  return (
                    <div key={round} className="grid grid-cols-5 gap-2 items-center">
                      <div className="text-center font-bold text-sm bg-primary/20 rounded p-2">
                        R{round}
                      </div>
                      <div className="grid grid-cols-4 gap-2 col-span-4">
                        {Array.from({ length: teams.length }, (_, posIndex) => {
                          const position = posIndex + 1;
                          const pick = getPickAtPosition(round, position);
                          const team = getTeamAtPosition(round, position);
                          const pickNumber = round % 2 === 1 
                            ? (round - 1) * teams.length + position
                            : (round - 1) * teams.length + (teams.length - position + 1);

                          if (pick) {
                            return (
                              <Dialog key={`${round}-${position}`}>
                                <DialogTrigger asChild>
                                  <div className="relative group cursor-pointer">
                                    <Card className="h-20 transition-all hover:scale-105 border-l-4" 
                                      style={{ borderLeftColor: getPositionColor(pick.player.position) }}>
                                      <CardContent className="p-2 h-full flex flex-col justify-between">
                                        <div className="text-xs font-bold truncate">{pick.player.name}</div>
                                        <div className="flex items-center justify-between">
                                          <Badge variant="outline" className="text-xs">
                                            {pick.player.position}
                                          </Badge>
                                          <Badge variant="secondary" className="text-xs">
                                            {pick.pick}
                                          </Badge>
                                        </div>
                                      </CardContent>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingPick(pick.pick);
                                        }}
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </Button>
                                    </Card>
                                  </div>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Pick #{pick.pick} Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <div className="font-bold">{pick.player.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                          {pick.player.position} - {pick.player.team}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm">Round {pick.round}</div>
                                        <div className="text-sm text-muted-foreground">Pick {pick.pick}</div>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <div className="font-medium">Projected</div>
                                        <div>{pick.player.projectedPoints} pts</div>
                                      </div>
                                      <div>
                                        <div className="font-medium">ADP</div>
                                        <div>{pick.player.adp}</div>
                                      </div>
                                      <div>
                                        <div className="font-medium">Value</div>
                                        <div className={pick.pick < pick.player.adp ? 'text-green-500' : 'text-red-500'}>
                                          {pick.pick < pick.player.adp ? '+' : ''}{pick.player.adp - pick.pick}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            );
                          } else {
                            return (
                              <Card key={`${round}-${position}`} className="h-20 border-dashed border-2 border-muted">
                                <CardContent className="p-2 h-full flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-xs text-muted-foreground">{team?.name}</div>
                                    <div className="text-xs font-bold">#{pickNumber}</div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          }
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {/* Edit Pick Dialog */}
      <Dialog open={editingPick !== null} onOpenChange={() => setEditingPick(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pick #{editingPick}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedReplacement} onValueChange={setSelectedReplacement}>
              <SelectTrigger>
                <SelectValue placeholder="Select replacement player" />
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.filter(p => !p.isDrafted).map(player => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name} ({player.position}) - {player.team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPick(null)}>
                Cancel
              </Button>
              <Button onClick={() => editingPick && handleEditPick(editingPick)}>
                Update Pick
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};