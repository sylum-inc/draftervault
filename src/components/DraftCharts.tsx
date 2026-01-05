import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Player, Team } from '@/services/auctionDraftService';

interface DraftChartsProps {
  players: Player[];
  teams: Team[];
  draftedPlayers: Player[];
}

export const DraftCharts: React.FC<DraftChartsProps> = ({ players, teams, draftedPlayers }) => {
  // Position Distribution Data
  const positionData = ['QB', 'RB', 'WR', 'TE'].map(position => {
    const total = players.filter(p => p.position === position).length;
    const drafted = draftedPlayers.filter(p => p.position === position).length;
    return {
      position,
      total,
      drafted,
      remaining: total - drafted,
      percentage: Math.round((drafted / total) * 100)
    };
  });

  // Value Distribution Data
  const valueDistribution = draftedPlayers.map((player, index) => ({
    pick: index + 1,
    cost: player.draftCost || 0,
    estimatedValue: player.estimatedValue,
    efficiency: ((player.estimatedValue - (player.draftCost || 0)) / player.estimatedValue) * 100,
    position: player.position
  }));

  // Team Spending Data
  const teamSpendingData = teams.map(team => ({
    name: team.name.replace('Team ', ''),
    spent: team.spent,
    remaining: team.remaining,
    efficiency: team.spent > 0 ? Math.round((team.spent / 200) * 100) : 0
  }));

  // Tier Analysis Data
  const tierData = [1, 2, 3, 4].map(tier => {
    const tierPlayers = players.filter(p => p.tier === tier);
    const draftedInTier = draftedPlayers.filter(p => p.tier === tier);
    return {
      tier: `Tier ${tier}`,
      total: tierPlayers.length,
      drafted: draftedInTier.length,
      avgCost: draftedInTier.length > 0 ? 
        Math.round(draftedInTier.reduce((sum, p) => sum + (p.draftCost || 0), 0) / draftedInTier.length) : 0,
      avgValue: tierPlayers.length > 0 ? 
        Math.round(tierPlayers.reduce((sum, p) => sum + p.estimatedValue, 0) / tierPlayers.length) : 0
    };
  });

  // Price Trend Data (simulated)
  const priceTrendData = draftedPlayers.slice(0, 20).map((player, index) => ({
    pick: index + 1,
    actualCost: player.draftCost || 0,
    projectedCost: player.estimatedValue,
    inflation: ((player.draftCost || 0) - player.estimatedValue) / player.estimatedValue * 100
  }));

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];
  const POSITION_COLORS = {
    QB: '#8884d8',
    RB: '#82ca9d', 
    WR: '#ffc658',
    TE: '#ff7c7c'
  };

  const chartConfig = {
    position: {
      label: "Position",
    },
    drafted: {
      label: "Drafted",
      color: "hsl(var(--primary))",
    },
    remaining: {
      label: "Remaining", 
      color: "hsl(var(--muted))",
    },
    cost: {
      label: "Cost",
      color: "hsl(var(--destructive))",
    },
    value: {
      label: "Value",
      color: "hsl(var(--primary))",
    },
    spent: {
      label: "Spent",
      color: "hsl(var(--primary))",
    },
    efficiency: {
      label: "Efficiency",
      color: "hsl(var(--accent))",
    },
  };

  return (
    <div className="space-y-6">
      {/* Position Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Position Draft Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="position" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="drafted" fill="hsl(var(--primary))" />
                  <Bar dataKey="remaining" fill="hsl(var(--muted))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Position Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={positionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ position, percentage }) => `${position} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="drafted"
                  >
                    {positionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Value Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Draft Value Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={valueDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cost" name="Cost" />
                  <YAxis dataKey="estimatedValue" name="Value" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Scatter 
                    dataKey="estimatedValue" 
                    fill="hsl(var(--primary))"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Team Spending Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamSpendingData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={60} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="spent" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tier Analysis */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Tier Value Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="avgCost" fill="hsl(var(--destructive))" />
                <Bar dataKey="avgValue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Price Trend Analysis */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Draft Price Inflation Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pick" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="actualCost" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  name="Actual Cost"
                />
                <Line 
                  type="monotone" 
                  dataKey="projectedCost" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Projected Cost"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Real-time Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              ${Math.round(draftedPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0) / Math.max(draftedPlayers.length, 1))}
            </div>
            <div className="text-sm text-muted-foreground">Avg. Cost</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent">
              {Math.round(valueDistribution.filter(v => v.efficiency > 0).length / Math.max(valueDistribution.length, 1) * 100)}%
            </div>
            <div className="text-sm text-muted-foreground">Value Picks</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {Math.round(priceTrendData.reduce((sum, p) => sum + p.inflation, 0) / Math.max(priceTrendData.length, 1))}%
            </div>
            <div className="text-sm text-muted-foreground">Price Inflation</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">
              {Math.round((draftedPlayers.length / players.length) * 100)}%
            </div>
            <div className="text-sm text-muted-foreground">Draft Complete</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};