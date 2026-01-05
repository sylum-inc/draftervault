import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, 
  Star, Activity, Target, Clock, Heart, BarChart3
} from 'lucide-react';
import { Player, SnakeDraftPlayer } from '@/services/auctionDraftService';
interface PlayerCardWithChartProps {
  player: Player | SnakeDraftPlayer;
  onSelect?: () => void;
  onAnalytics?: () => void;
  isSelected?: boolean;
  showMiniChart?: boolean;
}

export const PlayerCardWithChart: React.FC<PlayerCardWithChartProps> = ({
  player,
  onSelect,
  onAnalytics,
  isSelected = false,
  showMiniChart = true
}) => {

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-500';
      case 'RB': return 'bg-green-500';
      case 'WR': return 'bg-blue-500';
      case 'TE': return 'bg-yellow-500';
      case 'K': return 'bg-purple-500';
      case 'DST': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = () => {
    if (player.recentTrends === 'RISING') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (player.recentTrends === 'DECLINING') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  return (
    <TooltipProvider>
      <Card className={`transition-all duration-200 hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''} ${player.isDrafted ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Badge className={`${getPositionColor(player.position)} text-white text-xs px-2 py-1`}>
                {player.position}
              </Badge>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-muted-foreground">T{player.tier}</span>
                {getTrendIcon()}
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold text-lg leading-none">{player.name}</h3>
            <p className="text-sm text-muted-foreground">{player.team}</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Analytics Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAnalytics?.();
              }}
              className="w-full"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Projected:</span>
              <span className="font-semibold ml-1">{typeof player.projectedPoints === 'number' ? player.projectedPoints.toFixed(1) : player.projectedPoints}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ADP:</span>
              <span className="font-semibold ml-1">{typeof player.adp === 'number' ? player.adp.toFixed(1) : player.adp}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {'valueOverReplacement' in player ? 'VOR:' : 'Value:'}
              </span>
              <span className="font-semibold ml-1">
                {'valueOverReplacement' in player 
                  ? (typeof player.valueOverReplacement === 'number' ? player.valueOverReplacement.toFixed(1) : player.valueOverReplacement)
                  : `$${typeof player.estimatedValue === 'number' ? player.estimatedValue.toFixed(0) : player.estimatedValue}`
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Risk:</span>
              <span className={`font-semibold ml-1 ${getRiskColor(player.injuryRisk)}`}>
                {player.injuryRisk}
              </span>
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="flex items-center justify-between text-xs">
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  <Target className="w-3 h-3" />
                  <span>{player.consistency}/10</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Consistency Rating</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3" />
                  <span>{typeof player.upside === 'number' ? player.upside.toFixed(1) : player.upside}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upside Potential</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{typeof player.floor === 'number' ? player.floor.toFixed(1) : player.floor}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Floor Points</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>W{player.byeWeek}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bye Week</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Snake Draft Specific Metrics */}
          {'breakoutPotential' in player && (
            <>
              <div className="flex items-center justify-between text-xs border-t pt-2">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span>{typeof player.breakoutPotential === 'number' ? player.breakoutPotential.toFixed(0) : player.breakoutPotential}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Breakout Potential</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center space-x-1">
                      <TrendingDown className="w-3 h-3 text-red-500" />
                      <span>{typeof player.bustRisk === 'number' ? player.bustRisk.toFixed(0) : player.bustRisk}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bust Risk</p>
                  </TooltipContent>
                </Tooltip>

                {player.sleeper && (
                  <Badge variant="secondary" className="text-xs">
                    Sleeper
                  </Badge>
                )}
              </div>

              {/* Additional Snake Draft Stats */}
              <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                <div className="text-center">
                  <div className="text-muted-foreground">Rank</div>
                  <div className="font-bold">#{Math.floor(player.adp)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Round</div>
                  <div className="font-bold">R{Math.ceil(player.adp / 12)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Pick</div>
                  <div className="font-bold">{((player.adp - 1) % 12) + 1}</div>
                </div>
              </div>
            </>
          )}

          {/* Action Button */}
          {!player.isDrafted && onSelect && (
            <Button 
              onClick={onSelect}
              className="w-full mt-3"
              variant={isSelected ? "default" : "outline"}
            >
              {'breakoutPotential' in player ? (
                <Target className="w-4 h-4 mr-2" />
              ) : (
                <DollarSign className="w-4 h-4 mr-2" />
              )}
              {isSelected ? 'Selected' : 'Select for Draft'}
            </Button>
          )}

          {player.isDrafted && (
            <Badge variant="secondary" className="w-full justify-center py-2">
              Drafted
            </Badge>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};