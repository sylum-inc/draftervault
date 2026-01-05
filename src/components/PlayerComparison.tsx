import { useState } from 'react';
import { X, Plus, TrendingUp, TrendingDown, Minus, Trophy, Target, Shield, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Player } from '@/services/auctionDraftService';

interface PlayerComparisonProps {
  players: Player[];
  onClose?: () => void;
}

interface ComparisonMetric {
  key: keyof Player | string;
  label: string;
  icon: typeof TrendingUp;
  higherIsBetter: boolean;
  format?: (value: number) => string;
}

const comparisonMetrics: ComparisonMetric[] = [
  { key: 'projectedPoints', label: 'Projected Points', icon: Trophy, higherIsBetter: true },
  { key: 'estimatedValue', label: 'Auction Value', icon: Target, higherIsBetter: true, format: (v) => `$${v}` },
  { key: 'valueOverReplacement', label: 'VORP', icon: Zap, higherIsBetter: true },
  { key: 'adp', label: 'ADP', icon: TrendingUp, higherIsBetter: false },
  { key: 'upside', label: 'Ceiling', icon: TrendingUp, higherIsBetter: true },
  { key: 'floor', label: 'Floor', icon: Shield, higherIsBetter: true },
  { key: 'consistency', label: 'Consistency', icon: Target, higherIsBetter: true, format: (v) => `${v}/10` },
  { key: 'targetShare', label: 'Target Share', icon: Target, higherIsBetter: true, format: (v) => `${v}%` },
  { key: 'redZoneShare', label: 'Red Zone Share', icon: Zap, higherIsBetter: true, format: (v) => `${v}%` },
  { key: 'strengthOfSchedule', label: 'Schedule', icon: Shield, higherIsBetter: false, format: (v) => `${v}/10` },
];

export const PlayerComparison = ({ players: initialPlayers, onClose }: PlayerComparisonProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>(initialPlayers.slice(0, 4));
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const addPlayer = (player: Player) => {
    if (selectedPlayers.length < 4 && !selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers([...selectedPlayers, player]);
    }
    setIsAddingPlayer(false);
    setSearchQuery('');
  };

  const removePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
  };

  const getValueForMetric = (player: Player, metric: ComparisonMetric): number => {
    const value = player[metric.key as keyof Player];
    return typeof value === 'number' ? value : 0;
  };

  const getBestValue = (metric: ComparisonMetric): number => {
    const values = selectedPlayers.map(p => getValueForMetric(p, metric));
    return metric.higherIsBetter ? Math.max(...values) : Math.min(...values);
  };

  const getWorstValue = (metric: ComparisonMetric): number => {
    const values = selectedPlayers.map(p => getValueForMetric(p, metric));
    return metric.higherIsBetter ? Math.min(...values) : Math.max(...values);
  };

  const isBestValue = (player: Player, metric: ComparisonMetric): boolean => {
    return getValueForMetric(player, metric) === getBestValue(metric);
  };

  const isWorstValue = (player: Player, metric: ComparisonMetric): boolean => {
    return getValueForMetric(player, metric) === getWorstValue(metric);
  };

  const getPositionClass = (position: string) => {
    switch (position) {
      case 'QB': return 'position-qb';
      case 'RB': return 'position-rb';
      case 'WR': return 'position-wr';
      case 'TE': return 'position-te';
      default: return '';
    }
  };

  const filteredPlayers = initialPlayers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedPlayers.find(sp => sp.id === p.id)
  );

  return (
    <Card className="glass-card-elevated">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="gradient-text text-2xl flex items-center gap-2">
            <Target className="w-6 h-6" />
            Player Comparison
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Player Headers */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `200px repeat(${selectedPlayers.length}, 1fr) ${selectedPlayers.length < 4 ? '60px' : ''}` }}>
          <div className="font-semibold text-muted-foreground">Metric</div>
          {selectedPlayers.map((player) => (
            <div key={player.id} className="relative">
              <Card className="glass-card p-4 text-center group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive/80 hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePlayer(player.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
                <Badge className={`${getPositionClass(player.position)} position-badge mb-2`}>
                  {player.position}
                </Badge>
                <h3 className="font-bold text-lg">{player.name}</h3>
                <p className="text-sm text-muted-foreground">{player.team}</p>
                <Badge className={`tier-${player.tier} tier-badge mt-2`}>
                  Tier {player.tier}
                </Badge>
              </Card>
            </div>
          ))}
          {selectedPlayers.length < 4 && (
            <Dialog open={isAddingPlayer} onOpenChange={setIsAddingPlayer}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-full min-h-[120px] border-dashed border-2 hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="w-6 h-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="modal-content max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Player to Compare</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-premium"
                  />
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {filteredPlayers.slice(0, 20).map((player) => (
                        <Button
                          key={player.id}
                          variant="ghost"
                          className="w-full justify-start gap-3 p-3 h-auto hover:bg-primary/10"
                          onClick={() => addPlayer(player)}
                        >
                          <Badge className={`${getPositionClass(player.position)} position-badge`}>
                            {player.position}
                          </Badge>
                          <div className="text-left">
                            <div className="font-semibold">{player.name}</div>
                            <div className="text-xs text-muted-foreground">{player.team}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Metrics Comparison */}
        <div className="space-y-3">
          {comparisonMetrics.map((metric) => (
            <div
              key={metric.key}
              className="grid gap-4 items-center py-3 px-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
              style={{ gridTemplateColumns: `200px repeat(${selectedPlayers.length}, 1fr) ${selectedPlayers.length < 4 ? '60px' : ''}` }}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <metric.icon className="w-4 h-4 text-muted-foreground" />
                {metric.label}
              </div>
              {selectedPlayers.map((player) => {
                const value = getValueForMetric(player, metric);
                const isBest = isBestValue(player, metric);
                const isWorst = isWorstValue(player, metric);
                const displayValue = metric.format ? metric.format(value) : value;

                return (
                  <div
                    key={player.id}
                    className={`
                      flex items-center justify-center gap-2 font-bold text-lg p-2 rounded-lg
                      ${isBest ? 'bg-green-500/20 text-green-400' : ''}
                      ${isWorst && selectedPlayers.length > 1 ? 'bg-red-500/20 text-red-400' : ''}
                      ${!isBest && !isWorst ? 'text-foreground' : ''}
                    `}
                  >
                    {displayValue}
                    {isBest && selectedPlayers.length > 1 && (
                      <TrendingUp className="w-4 h-4" />
                    )}
                    {isWorst && selectedPlayers.length > 1 && (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                );
              })}
              {selectedPlayers.length < 4 && <div />}
            </div>
          ))}
        </div>

        {/* Summary */}
        {selectedPlayers.length >= 2 && (
          <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <h4 className="font-bold mb-2 gradient-text">Quick Analysis</h4>
            <p className="text-sm text-muted-foreground">
              {(() => {
                const bestPlayer = selectedPlayers.reduce((best, player) => {
                  const bestScore = getValueForMetric(best, comparisonMetrics[0]) +
                                   getValueForMetric(best, comparisonMetrics[2]);
                  const playerScore = getValueForMetric(player, comparisonMetrics[0]) +
                                     getValueForMetric(player, comparisonMetrics[2]);
                  return playerScore > bestScore ? player : best;
                });
                return `Based on projected points and VORP, ${bestPlayer.name} appears to offer the best value. Consider schedule strength and injury risk before making your final decision.`;
              })()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerComparison;
