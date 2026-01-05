import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlayerPerformanceChartProps {
  playerName: string;
  position: string;
  data: {
    year: string;
    actual: number;
    expected: number;
    differential: number;
  }[];
  compact?: boolean;
}

export const PlayerPerformanceChart: React.FC<PlayerPerformanceChartProps> = ({
  playerName,
  position,
  data,
  compact = false
}) => {
  const currentYearDiff = data[data.length - 1]?.differential || 0;
  const trend = currentYearDiff > 5 ? 'outperforming' : currentYearDiff < -5 ? 'underperforming' : 'meeting';
  
  const getTrendIcon = () => {
    if (currentYearDiff > 5) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (currentYearDiff < -5) return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-yellow-500" />;
  };

  const getTrendColor = () => {
    if (currentYearDiff > 5) return 'text-green-600';
    if (currentYearDiff < -5) return 'text-red-600';
    return 'text-yellow-600';
  };

  if (compact) {
    return (
      <div className="w-full h-16 relative">
        <div className="absolute top-0 left-0 z-10 flex items-center space-x-1">
          {getTrendIcon()}
          <span className={`text-xs font-medium ${getTrendColor()}`}>
            {currentYearDiff > 0 ? '+' : ''}{currentYearDiff.toFixed(1)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="expected" 
              stroke="#94a3b8" 
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(0,0,0,0.8)', 
                border: 'none', 
                borderRadius: '4px',
                fontSize: '12px'
              }}
              formatter={(value, name) => [
                `${value} pts`,
                name === 'actual' ? 'Actual' : 'Expected'
              ]}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-sm">{playerName} Performance Trend</h4>
            <p className="text-xs text-muted-foreground">{position} • 3-Year History</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={trend === 'outperforming' ? 'default' : trend === 'underperforming' ? 'destructive' : 'secondary'}>
              {getTrendIcon()}
              <span className="ml-1">
                {trend === 'outperforming' ? 'Exceeding' : trend === 'underperforming' ? 'Below' : 'Meeting'} Expectations
              </span>
            </Badge>
          </div>
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="year" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '6px' 
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)} pts`,
                  name === 'actual' ? 'Actual Points' : 'Expected Points'
                ]}
                labelFormatter={(year) => `${year} Season`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="expected"
                stackId="1"
                stroke="#94a3b8"
                fill="url(#expectedGradient)"
                strokeWidth={2}
                strokeDasharray="5,5"
                name="Expected"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stackId="2"
                stroke="#8b5cf6"
                fill="url(#actualGradient)"
                strokeWidth={3}
                name="Actual"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Avg Differential</p>
            <p className={`font-semibold ${getTrendColor()}`}>
              {(data.reduce((sum, d) => sum + d.differential, 0) / data.length).toFixed(1)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Best Season</p>
            <p className="font-semibold text-green-600">
              {Math.max(...data.map(d => d.actual)).toFixed(1)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Consistency</p>
            <p className="font-semibold">
              {(100 - (Math.max(...data.map(d => d.actual)) - Math.min(...data.map(d => d.actual))) / Math.max(...data.map(d => d.actual)) * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};