import { useState } from 'react';
import { Clock, ChevronLeft, ChevronRight, RotateCcw, Play, Pause } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Player } from '@/services/auctionDraftService';

export interface DraftPick {
  id: string;
  pickNumber: number;
  player: Player;
  teamId: string;
  teamName: string;
  cost: number;
  timestamp: Date;
  isUserPick: boolean;
}

interface DraftTimelineProps {
  picks: DraftPick[];
  currentPick: number;
  onGoToPick?: (pickNumber: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export const DraftTimeline = ({
  picks,
  currentPick,
  onGoToPick,
  onUndo,
  canUndo = false,
}: DraftTimelineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedPick, setSelectedPick] = useState<DraftPick | null>(null);

  const getPositionClass = (position: string) => {
    switch (position) {
      case 'QB': return 'position-qb';
      case 'RB': return 'position-rb';
      case 'WR': return 'position-wr';
      case 'TE': return 'position-te';
      default: return '';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getValueIndicator = (cost: number, estimatedValue: number) => {
    const diff = estimatedValue - cost;
    const percentage = (diff / estimatedValue) * 100;

    if (percentage > 15) return { label: 'STEAL', color: 'text-green-400 bg-green-400/20' };
    if (percentage > 5) return { label: 'VALUE', color: 'text-blue-400 bg-blue-400/20' };
    if (percentage > -5) return { label: 'FAIR', color: 'text-yellow-400 bg-yellow-400/20' };
    if (percentage > -15) return { label: 'REACH', color: 'text-orange-400 bg-orange-400/20' };
    return { label: 'OVERPAY', color: 'text-red-400 bg-red-400/20' };
  };

  return (
    <Card className="glass-card-elevated">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="gradient-text text-xl flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Draft Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Pick {currentPick} of {picks.length}
            </span>
            {canUndo && (
              <Button variant="ghost" size="sm" onClick={onUndo}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Undo
              </Button>
            )}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4 mt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onGoToPick?.(Math.max(1, currentPick - 1))}
            disabled={currentPick <= 1}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onGoToPick?.(Math.min(picks.length, currentPick + 1))}
            disabled={currentPick >= picks.length}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          <div className="flex-1 mx-4">
            <Slider
              value={[currentPick]}
              min={1}
              max={Math.max(picks.length, 1)}
              step={1}
              onValueChange={([value]) => onGoToPick?.(value)}
              className="cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Speed:</span>
            <Button
              variant={playbackSpeed === 0.5 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPlaybackSpeed(0.5)}
            >
              0.5x
            </Button>
            <Button
              variant={playbackSpeed === 1 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPlaybackSpeed(1)}
            >
              1x
            </Button>
            <Button
              variant={playbackSpeed === 2 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPlaybackSpeed(2)}
            >
              2x
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border">
            {picks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Clock className="w-12 h-12 mb-4 opacity-50" />
                <p>No picks yet</p>
                <p className="text-sm">Picks will appear here as they happen</p>
              </div>
            ) : (
              picks.map((pick, index) => {
                const valueIndicator = getValueIndicator(pick.cost, pick.player.estimatedValue);
                const isActive = pick.pickNumber === currentPick;
                const isPast = pick.pickNumber < currentPick;

                return (
                  <div
                    key={pick.id}
                    className={`
                      p-4 cursor-pointer transition-all
                      ${isActive ? 'bg-primary/20 border-l-4 border-primary' : ''}
                      ${isPast ? 'opacity-60' : ''}
                      ${!isActive && !isPast ? 'hover:bg-secondary/30' : ''}
                      ${pick.isUserPick ? 'bg-accent/5' : ''}
                    `}
                    onClick={() => {
                      setSelectedPick(pick);
                      onGoToPick?.(pick.pickNumber);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Pick Number */}
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center font-bold
                        ${isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary'}
                      `}>
                        {pick.pickNumber}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getPositionClass(pick.player.position)} position-badge`}>
                            {pick.player.position}
                          </Badge>
                          <span className="font-bold truncate">{pick.player.name}</span>
                          <span className="text-sm text-muted-foreground">({pick.player.team})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>{pick.teamName}</span>
                          <span>•</span>
                          <span>{formatTime(pick.timestamp)}</span>
                          {pick.isUserPick && (
                            <Badge variant="outline" className="text-xs">Your Pick</Badge>
                          )}
                        </div>
                      </div>

                      {/* Cost & Value */}
                      <div className="text-right">
                        <div className="text-xl font-bold">${pick.cost}</div>
                        <Badge className={`text-xs ${valueIndicator.color}`}>
                          {valueIndicator.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Pick Details Modal */}
      {selectedPick && (
        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold">{selectedPick.player.name}</h4>
              <p className="text-sm text-muted-foreground">
                Drafted by {selectedPick.teamName} for ${selectedPick.cost}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Expected: ${selectedPick.player.estimatedValue}</p>
              <p className="text-sm">
                {selectedPick.player.estimatedValue - selectedPick.cost > 0 ? (
                  <span className="text-green-400">
                    +${selectedPick.player.estimatedValue - selectedPick.cost} value
                  </span>
                ) : (
                  <span className="text-red-400">
                    ${selectedPick.player.estimatedValue - selectedPick.cost} value
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DraftTimeline;
