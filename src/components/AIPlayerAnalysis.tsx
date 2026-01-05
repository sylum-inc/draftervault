import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Shield,
  Zap,
  Clock,
  Users,
  Activity,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type {
  PlayerAnalysisRequest,
  PlayerAnalysisResponse,
  RiskFactor,
  LeagueSettings,
  RosterContext,
} from '@/services/ai/types';

interface AIPlayerAnalysisProps {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  stats: Record<string, number | string>;
  isConfigured: boolean;
  isLoading: boolean;
  analysis: PlayerAnalysisResponse | null;
  onAnalyze: (request: PlayerAnalysisRequest) => Promise<void>;
  leagueSettings?: LeagueSettings;
  rosterContext?: RosterContext;
  draftPosition?: number;
}

const RISK_COLORS: Record<RiskFactor['severity'], string> = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const RISK_ICONS: Record<RiskFactor['type'], React.FC<{ className?: string }>> = {
  injury: Shield,
  age: Clock,
  situation: Users,
  competition: Target,
  scheme: Activity,
  coaching: Zap,
};

export const AIPlayerAnalysis: React.FC<AIPlayerAnalysisProps> = ({
  playerId,
  playerName,
  position,
  team,
  stats,
  isConfigured,
  isLoading,
  analysis,
  onAnalyze,
  leagueSettings,
  rosterContext,
  draftPosition,
}) => {
  const handleAnalyze = () => {
    onAnalyze({
      playerId,
      playerName,
      position,
      team,
      stats,
      context: {
        leagueSettings,
        rosterContext,
        draftPosition,
      },
    });
  };

  if (!isConfigured) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <Brain className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Configure AI in settings to unlock player analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis && !isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Player Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Get deep insights on {playerName}'s strengths, weaknesses, and outlook
            </p>
          </div>
          <Button onClick={handleAnalyze} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Analyze Player
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse text-primary" />
            Analyzing {playerName}...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {analysis?.confidence}% Confidence
            </Badge>
            <Button variant="ghost" size="icon" onClick={handleAnalyze}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="rounded-lg bg-secondary/30 p-4">
          <p className="text-sm">{analysis?.summary}</p>
        </div>

        <Tabs defaultValue="strengths" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="strengths">Strengths</TabsTrigger>
            <TabsTrigger value="weaknesses">Weaknesses</TabsTrigger>
            <TabsTrigger value="outlook">Outlook</TabsTrigger>
            <TabsTrigger value="risks">Risks</TabsTrigger>
          </TabsList>

          {/* Strengths */}
          <TabsContent value="strengths" className="mt-4 space-y-2">
            {analysis?.strengths.map((strength, index) => (
              <div key={index} className="flex items-start gap-2 rounded-lg bg-green-500/10 p-2">
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <span className="text-sm">{strength}</span>
              </div>
            ))}
          </TabsContent>

          {/* Weaknesses */}
          <TabsContent value="weaknesses" className="mt-4 space-y-2">
            {analysis?.weaknesses.map((weakness, index) => (
              <div key={index} className="flex items-start gap-2 rounded-lg bg-red-500/10 p-2">
                <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span className="text-sm">{weakness}</span>
              </div>
            ))}
          </TabsContent>

          {/* Outlook */}
          <TabsContent value="outlook" className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium">This Season</span>
              </div>
              <p className="pl-6 text-sm text-muted-foreground">{analysis?.outlook.shortTerm}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                <span className="font-medium">Dynasty Value</span>
              </div>
              <p className="pl-6 text-sm text-muted-foreground">{analysis?.outlook.longTerm}</p>
            </div>
          </TabsContent>

          {/* Risks */}
          <TabsContent value="risks" className="mt-4 space-y-2">
            {analysis?.riskFactors.map((risk, index) => {
              const Icon = RISK_ICONS[risk.type] || AlertTriangle;
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${RISK_COLORS[risk.severity]}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{risk.type}</span>
                      <Badge variant="outline" className={`text-xs ${RISK_COLORS[risk.severity]}`}>
                        {risk.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm opacity-80">{risk.description}</p>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Player Comparisons */}
        {analysis?.comparisons && analysis.comparisons.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Similar Players
              </h4>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {analysis.comparisons.map((comp, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-secondary/30 p-3"
                  >
                    <div>
                      <span className="font-medium">{comp.playerName}</span>
                      <p className="text-xs text-muted-foreground">{comp.reason}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-primary">{comp.similarity}%</div>
                      <div className="text-xs text-muted-foreground">match</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Recommended Actions */}
        {analysis?.recommendedActions && analysis.recommendedActions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Recommended Actions
              </h4>
              <div className="space-y-2">
                {analysis.recommendedActions.map((action, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg bg-primary/10 p-2">
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-sm">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Compact version for inline use
export const CompactPlayerAnalysis: React.FC<{
  analysis: PlayerAnalysisResponse | null;
  isLoading: boolean;
}> = ({ analysis, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{analysis.summary}</p>

      <div className="flex flex-wrap gap-1">
        {analysis.strengths.slice(0, 2).map((s, i) => (
          <Badge key={i} variant="secondary" className="bg-green-500/10 text-xs text-green-400">
            {s.split(' ').slice(0, 3).join(' ')}...
          </Badge>
        ))}
        {analysis.riskFactors
          .filter((r) => r.severity === 'high')
          .slice(0, 1)
          .map((r, i) => (
            <Badge key={i} variant="secondary" className="bg-red-500/10 text-xs text-red-400">
              {r.type}
            </Badge>
          ))}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>{analysis.confidence}% confidence</span>
        </div>
      </div>
    </div>
  );
};

export default AIPlayerAnalysis;
