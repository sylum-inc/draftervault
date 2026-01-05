import { useState, useMemo } from 'react';
import { ArrowLeftRight, Plus, X, TrendingUp, TrendingDown, Scale, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Player } from '@/services/auctionDraftService';

interface TradeCalculatorProps {
  availablePlayers: Player[];
  teams: { id: string; name: string }[];
}

interface TradeSide {
  teamId: string;
  players: Player[];
  draftPicks?: string[];
}

export const TradeCalculator = ({ availablePlayers, teams }: TradeCalculatorProps) => {
  const [sideA, setSideA] = useState<TradeSide>({ teamId: teams[0]?.id || '', players: [] });
  const [sideB, setSideB] = useState<TradeSide>({ teamId: teams[1]?.id || '', players: [] });
  const [isAddingPlayer, setIsAddingPlayer] = useState<'A' | 'B' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const calculateValue = (players: Player[]): number => {
    return players.reduce((sum, p) => sum + (p.estimatedValue || 0) + (p.valueOverReplacement || 0) / 10, 0);
  };

  const valueA = useMemo(() => calculateValue(sideA.players), [sideA.players]);
  const valueB = useMemo(() => calculateValue(sideB.players), [sideB.players]);
  const difference = valueA - valueB;
  const percentageDiff = valueB > 0 ? ((difference / valueB) * 100) : 0;

  const getTradeGrade = (): { grade: string; color: string; description: string } => {
    const absDiff = Math.abs(percentageDiff);

    if (absDiff <= 5) return { grade: 'A', color: 'text-green-400', description: 'Fair trade for both sides' };
    if (absDiff <= 10) return { grade: 'B+', color: 'text-green-300', description: 'Slightly favors one side' };
    if (absDiff <= 20) return { grade: 'B', color: 'text-yellow-400', description: 'Moderate advantage' };
    if (absDiff <= 35) return { grade: 'C', color: 'text-orange-400', description: 'Significant imbalance' };
    return { grade: 'F', color: 'text-red-400', description: 'Heavily lopsided trade' };
  };

  const tradeGrade = getTradeGrade();

  const addPlayer = (player: Player, side: 'A' | 'B') => {
    if (side === 'A') {
      setSideA((prev) => ({ ...prev, players: [...prev.players, player] }));
    } else {
      setSideB((prev) => ({ ...prev, players: [...prev.players, player] }));
    }
    setIsAddingPlayer(null);
    setSearchQuery('');
  };

  const removePlayer = (playerId: string, side: 'A' | 'B') => {
    if (side === 'A') {
      setSideA((prev) => ({ ...prev, players: prev.players.filter((p) => p.id !== playerId) }));
    } else {
      setSideB((prev) => ({ ...prev, players: prev.players.filter((p) => p.id !== playerId) }));
    }
  };

  const clearAll = () => {
    setSideA((prev) => ({ ...prev, players: [] }));
    setSideB((prev) => ({ ...prev, players: [] }));
  };

  const filteredPlayers = availablePlayers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !sideA.players.find((sp) => sp.id === p.id) &&
      !sideB.players.find((sp) => sp.id === p.id)
  );

  const getPositionClass = (position: string) => {
    switch (position) {
      case 'QB': return 'position-qb';
      case 'RB': return 'position-rb';
      case 'WR': return 'position-wr';
      case 'TE': return 'position-te';
      default: return '';
    }
  };

  const renderTradeSide = (side: TradeSide, sideLabel: 'A' | 'B', value: number) => (
    <div className="flex-1">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg mb-1">
          {teams.find((t) => t.id === side.teamId)?.name || `Team ${sideLabel}`}
        </h3>
        <p className="text-2xl font-bold gradient-text-gold">${value.toFixed(0)}</p>
        <p className="text-xs text-muted-foreground">Total Value</p>
      </div>

      <div className="space-y-2 min-h-[200px]">
        {side.players.map((player) => (
          <div
            key={player.id}
            className="glass-card p-3 rounded-xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Badge className={`${getPositionClass(player.position)} position-badge`}>
                {player.position}
              </Badge>
              <div>
                <p className="font-semibold text-sm">{player.name}</p>
                <p className="text-xs text-muted-foreground">
                  ${player.estimatedValue} value
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removePlayer(player.id, sideLabel)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <Dialog open={isAddingPlayer === sideLabel} onOpenChange={(open) => setIsAddingPlayer(open ? sideLabel : null)}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent className="modal-content max-w-md">
            <DialogHeader>
              <DialogTitle>Add Player to Trade</DialogTitle>
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
                      onClick={() => addPlayer(player, sideLabel)}
                    >
                      <Badge className={`${getPositionClass(player.position)} position-badge`}>
                        {player.position}
                      </Badge>
                      <div className="text-left flex-1">
                        <div className="font-semibold">{player.name}</div>
                        <div className="text-xs text-muted-foreground">{player.team}</div>
                      </div>
                      <span className="text-sm font-bold text-primary">${player.estimatedValue}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  return (
    <Card className="glass-card-elevated">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="gradient-text text-2xl flex items-center gap-2">
            <Scale className="w-6 h-6" />
            Trade Calculator
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex gap-6">
          {renderTradeSide(sideA, 'A', valueA)}

          {/* Middle Section */}
          <div className="flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-8 h-8 text-primary" />
            </div>

            {(sideA.players.length > 0 || sideB.players.length > 0) && (
              <div className="text-center space-y-2">
                <div className={`text-4xl font-black ${tradeGrade.color}`}>
                  {tradeGrade.grade}
                </div>
                <p className="text-xs text-muted-foreground max-w-[100px]">
                  {tradeGrade.description}
                </p>

                {Math.abs(difference) > 0.5 && (
                  <div className="flex items-center gap-1 text-sm">
                    {difference > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">+${difference.toFixed(0)}</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">${difference.toFixed(0)}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {renderTradeSide(sideB, 'B', valueB)}
        </div>

        {/* Trade Analysis */}
        {sideA.players.length > 0 && sideB.players.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h4 className="font-bold gradient-text">Trade Analysis</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {Math.abs(percentageDiff) <= 10
                ? "This appears to be a balanced trade. Both sides are getting comparable value."
                : difference > 0
                ? `Team A is getting ${Math.abs(percentageDiff).toFixed(0)}% more value. Consider adjusting to make it fairer.`
                : `Team B is getting ${Math.abs(percentageDiff).toFixed(0)}% more value. Consider adjusting to make it fairer.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradeCalculator;
