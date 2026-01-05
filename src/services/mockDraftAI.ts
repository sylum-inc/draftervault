import { Player } from './auctionDraftService';

export type DraftStrategy =
  | 'balanced'       // Even distribution across positions
  | 'zero_rb'        // Prioritize WR/TE early
  | 'hero_rb'        // Get one elite RB, then WR heavy
  | 'robust_rb'      // Prioritize RBs early
  | 'stars_and_scrubs' // Pay up for elite, fill with cheap players
  | 'value_hunter'   // Always chase the best value
  | 'contrarian';    // Go against the grain

export interface AITeam {
  id: string;
  name: string;
  strategy: DraftStrategy;
  aggression: number; // 0-1, how likely to overbid
  budget: number;
  spent: number;
  roster: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  targetPositions: string[];
}

export interface DraftDecision {
  shouldBid: boolean;
  bidAmount: number;
  confidence: number;
  reasoning: string;
}

const strategyDescriptions: Record<DraftStrategy, string> = {
  balanced: 'Builds a well-rounded team with even positional investment',
  zero_rb: 'Prioritizes elite WRs and TEs, waits on RBs',
  hero_rb: 'Targets one elite RB, then loads up on WRs',
  robust_rb: 'Secures multiple starting-caliber RBs early',
  stars_and_scrubs: 'Spends big on 2-3 elite players, fills rest cheaply',
  value_hunter: 'Always chases the best value regardless of position',
  contrarian: 'Targets positions others are ignoring',
};

export class MockDraftAI {
  private teams: AITeam[] = [];

  constructor(teamCount: number = 11) {
    this.initializeTeams(teamCount);
  }

  private initializeTeams(count: number): void {
    const strategies: DraftStrategy[] = [
      'balanced', 'zero_rb', 'hero_rb', 'robust_rb',
      'stars_and_scrubs', 'value_hunter', 'contrarian'
    ];

    const teamNames = [
      'Alpha Squad', 'Beta Force', 'Gamma Gurus', 'Delta Dynasty',
      'Epsilon Elite', 'Zeta Zone', 'Eta Experts', 'Theta Titans',
      'Iota Impact', 'Kappa Kings', 'Lambda Legends'
    ];

    for (let i = 0; i < count; i++) {
      this.teams.push({
        id: `ai-team-${i + 1}`,
        name: teamNames[i] || `AI Team ${i + 1}`,
        strategy: strategies[i % strategies.length],
        aggression: 0.3 + Math.random() * 0.5, // 0.3 - 0.8
        budget: 200,
        spent: 0,
        roster: { QB: 0, RB: 0, WR: 0, TE: 0 },
        targetPositions: this.getTargetPositions(strategies[i % strategies.length]),
      });
    }
  }

  private getTargetPositions(strategy: DraftStrategy): string[] {
    switch (strategy) {
      case 'zero_rb':
        return ['WR', 'WR', 'TE', 'WR', 'RB', 'QB', 'RB'];
      case 'hero_rb':
        return ['RB', 'WR', 'WR', 'WR', 'TE', 'QB', 'RB'];
      case 'robust_rb':
        return ['RB', 'RB', 'WR', 'WR', 'RB', 'TE', 'QB'];
      case 'stars_and_scrubs':
        return ['RB', 'WR', 'WR', 'RB', 'TE', 'QB'];
      default:
        return ['RB', 'WR', 'RB', 'WR', 'TE', 'QB'];
    }
  }

  public getTeams(): AITeam[] {
    return this.teams;
  }

  public getStrategyDescription(strategy: DraftStrategy): string {
    return strategyDescriptions[strategy];
  }

  public evaluatePlayer(team: AITeam, player: Player, currentBid: number): DraftDecision {
    const positionNeed = this.calculatePositionNeed(team, player.position);
    const valueScore = this.calculateValueScore(player, currentBid);
    const strategyFit = this.calculateStrategyFit(team, player);
    const budgetFit = this.calculateBudgetFit(team, currentBid);

    const overallScore = (
      positionNeed * 0.3 +
      valueScore * 0.3 +
      strategyFit * 0.25 +
      budgetFit * 0.15
    );

    const shouldBid = overallScore > 0.5 && budgetFit > 0.3;
    const maxBid = this.calculateMaxBid(team, player, overallScore);
    const bidAmount = Math.min(
      currentBid + Math.ceil(Math.random() * 3 * team.aggression),
      maxBid
    );

    return {
      shouldBid,
      bidAmount,
      confidence: overallScore,
      reasoning: this.generateReasoning(team, player, overallScore, positionNeed),
    };
  }

  private calculatePositionNeed(team: AITeam, position: string): number {
    const currentCount = team.roster[position as keyof typeof team.roster] || 0;
    const maxNeeded = position === 'QB' || position === 'TE' ? 1 : 3;

    if (currentCount >= maxNeeded) return 0;
    if (currentCount === 0) return 1;
    return 0.7 - (currentCount * 0.2);
  }

  private calculateValueScore(player: Player, currentBid: number): number {
    const expectedValue = player.estimatedValue;
    const discount = (expectedValue - currentBid) / expectedValue;
    return Math.max(0, Math.min(1, 0.5 + discount));
  }

  private calculateStrategyFit(team: AITeam, player: Player): number {
    const pickNumber = Object.values(team.roster).reduce((a, b) => a + b, 0);
    const targetPosition = team.targetPositions[pickNumber] || 'BPA';

    if (targetPosition === 'BPA') return 0.7;
    if (player.position === targetPosition) return 1;
    if (player.tier === 1) return 0.8; // Always consider elite players
    return 0.4;
  }

  private calculateBudgetFit(team: AITeam, bidAmount: number): number {
    const remaining = team.budget - team.spent;
    const playersNeeded = 7 - Object.values(team.roster).reduce((a, b) => a + b, 0);
    const reserveNeeded = playersNeeded * 1; // $1 minimum per player

    if (bidAmount > remaining - reserveNeeded) return 0;
    if (bidAmount < remaining * 0.3) return 1;
    return 0.5;
  }

  private calculateMaxBid(team: AITeam, player: Player, score: number): number {
    const remaining = team.budget - team.spent;
    const playersNeeded = 7 - Object.values(team.roster).reduce((a, b) => a + b, 0);
    const reserveNeeded = (playersNeeded - 1) * 1;

    const baseMax = player.estimatedValue * (1 + team.aggression * 0.3);
    const budgetMax = remaining - reserveNeeded;
    const scoredMax = baseMax * (0.8 + score * 0.4);

    return Math.min(Math.floor(scoredMax), budgetMax);
  }

  private generateReasoning(team: AITeam, player: Player, score: number, need: number): string {
    if (score > 0.8) return `${player.name} is a perfect fit for ${team.strategy} strategy`;
    if (need > 0.8) return `${team.name} desperately needs a ${player.position}`;
    if (score > 0.6) return `Good value play for ${team.name}`;
    if (score > 0.4) return `Considering ${player.name} but not a priority`;
    return `Passing on ${player.name} - doesn't fit current needs`;
  }

  public simulateAuctionRound(
    player: Player,
    startingBid: number,
    excludeTeamId?: string
  ): { winningTeam: AITeam | null; finalBid: number; bidHistory: { teamId: string; amount: number }[] } {
    const bidHistory: { teamId: string; amount: number }[] = [];
    let currentBid = startingBid;
    let highBidder: AITeam | null = null;
    let consecutivePasses = 0;

    const eligibleTeams = this.teams.filter(t => t.id !== excludeTeamId);

    while (consecutivePasses < eligibleTeams.length) {
      let anyoneBid = false;

      for (const team of eligibleTeams) {
        if (team.id === highBidder?.id) continue;

        const decision = this.evaluatePlayer(team, player, currentBid + 1);

        if (decision.shouldBid && decision.bidAmount > currentBid) {
          currentBid = decision.bidAmount;
          highBidder = team;
          bidHistory.push({ teamId: team.id, amount: currentBid });
          anyoneBid = true;
          consecutivePasses = 0;
        }
      }

      if (!anyoneBid) {
        consecutivePasses++;
      }
    }

    return {
      winningTeam: highBidder,
      finalBid: currentBid,
      bidHistory,
    };
  }

  public draftPlayer(teamId: string, player: Player, cost: number): void {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;

    team.spent += cost;
    team.roster[player.position as keyof typeof team.roster]++;
  }
}

export default MockDraftAI;
