import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Clock, X, Bell, BellOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

export interface PlayerAlert {
  id: string;
  playerId: string;
  playerName: string;
  team: string;
  type: 'injury' | 'news' | 'trending_up' | 'trending_down' | 'trade' | 'depth_chart';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  source?: string;
  isRead?: boolean;
}

interface PlayerAlertsProps {
  alerts: PlayerAlert[];
  onDismiss?: (alertId: string) => void;
  onDismissAll?: () => void;
}

// Mock alerts for demonstration
const generateMockAlerts = (): PlayerAlert[] => [
  {
    id: '1',
    playerId: 'player-1',
    playerName: 'Patrick Mahomes',
    team: 'KC',
    type: 'news',
    severity: 'info',
    title: 'Week 1 Outlook Strong',
    description: 'Mahomes practiced in full today. Expected to have full workload against Detroit.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    source: 'NFL Network',
  },
  {
    id: '2',
    playerId: 'player-2',
    playerName: 'Christian McCaffrey',
    team: 'SF',
    type: 'injury',
    severity: 'critical',
    title: 'Limited Practice',
    description: 'CMC was limited in practice with a calf injury. Monitor closely before drafting.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    source: 'Adam Schefter',
  },
  {
    id: '3',
    playerId: 'player-3',
    playerName: 'Ja\'Marr Chase',
    team: 'CIN',
    type: 'trending_up',
    severity: 'info',
    title: 'ADP Rising',
    description: 'Chase\'s ADP has risen 2.5 spots in the last 24 hours. Target share expected to increase.',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: '4',
    playerId: 'player-4',
    playerName: 'Davante Adams',
    team: 'LV',
    type: 'trade',
    severity: 'warning',
    title: 'Trade Rumors',
    description: 'Reports suggest Adams may request a trade. Could significantly impact fantasy value.',
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    source: 'ESPN',
  },
  {
    id: '5',
    playerId: 'player-5',
    playerName: 'Travis Kelce',
    team: 'KC',
    type: 'depth_chart',
    severity: 'info',
    title: 'Target Share Update',
    description: 'Expected to see increased usage with Rashee Rice out for the season.',
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
  },
];

export const PlayerAlerts = ({ alerts: propAlerts, onDismiss, onDismissAll }: PlayerAlertsProps) => {
  const [alerts, setAlerts] = useState<PlayerAlert[]>(propAlerts.length > 0 ? propAlerts : generateMockAlerts());
  const [showNotifications, setShowNotifications] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const getAlertIcon = (type: PlayerAlert['type']) => {
    switch (type) {
      case 'injury':
        return <AlertTriangle className="w-4 h-4" />;
      case 'trending_up':
        return <TrendingUp className="w-4 h-4" />;
      case 'trending_down':
        return <TrendingDown className="w-4 h-4" />;
      case 'trade':
        return <Activity className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: PlayerAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'info':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getTypeLabel = (type: PlayerAlert['type']) => {
    switch (type) {
      case 'injury':
        return 'Injury';
      case 'trending_up':
        return 'Trending Up';
      case 'trending_down':
        return 'Trending Down';
      case 'trade':
        return 'Trade News';
      case 'depth_chart':
        return 'Depth Chart';
      case 'news':
        return 'News';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleDismiss = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    onDismiss?.(alertId);
  };

  const handleDismissAll = () => {
    setAlerts([]);
    onDismissAll?.();
  };

  const filteredAlerts = alerts.filter((a) => filter === 'all' || a.severity === filter);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <Card className="glass-card-elevated">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="gradient-text text-xl flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Player Alerts
            </CardTitle>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400">
                {warningCount} Warning
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {showNotifications ? (
                <Bell className="w-4 h-4 text-muted-foreground" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Switch
                checked={showNotifications}
                onCheckedChange={setShowNotifications}
              />
            </div>
            {alerts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleDismissAll}>
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4">
          {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn-premium' : ''}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className="ml-1 text-xs">
                  ({alerts.filter((a) => a.severity === f).length})
                </span>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Bell className="w-12 h-12 mb-4 opacity-50" />
              <p>No alerts to display</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 hover:bg-secondary/30 transition-colors ${
                    alert.isRead ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}
                    >
                      {getAlertIcon(alert.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{alert.playerName}</span>
                        <Badge variant="outline" className="text-xs">
                          {alert.team}
                        </Badge>
                        <Badge className="text-xs bg-secondary">
                          {getTypeLabel(alert.type)}
                        </Badge>
                      </div>

                      <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {alert.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                        {alert.source && <span>via {alert.source}</span>}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleDismiss(alert.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default PlayerAlerts;
