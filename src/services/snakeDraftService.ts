import { SnakeDraftPlayer } from './auctionDraftService';
import { snakeDraftPlayerDatabase } from '@/data/snakeDraftPlayers';

export type SortOption = 'adp' | 'projected' | 'value' | 'upside' | 'recommended' | 'needed' | 'undervalued' | 'breakout' | 'safe' | 'risky';

export interface SnakeDraftAnalytics {
  draftPosition: number;
  roundsRemaining: number;
  userTeamNeeds: string[];
  recommendedTargets: SnakeDraftPlayer[];
  valueTargets: SnakeDraftPlayer[];
  breakoutCandidates: SnakeDraftPlayer[];
  safePlayers: SnakeDraftPlayer[];
  riskyPlayers: SnakeDraftPlayer[];
  positionalRankings: Record<string, SnakeDraftPlayer[]>;
}

export class SnakeDraftService {
  private players: SnakeDraftPlayer[] = [];
  private userTeamId: string = '';
  private draftPosition: number = 1;
  private currentRound: number = 1;
  private totalRounds: number = 16;
  private teams: any[] = [];

  constructor(userTeamId: string = '', draftPosition: number = 1, teams: any[] = []) {
    this.userTeamId = userTeamId;
    this.draftPosition = draftPosition;
    this.teams = teams;
    this.players = [...snakeDraftPlayerDatabase];
  }

  setUserTeam(teamId: string, position: number): void {
    this.userTeamId = teamId;
    this.draftPosition = position;
  }

  getAllPlayers(): SnakeDraftPlayer[] {
    return this.players.filter(p => !p.isDrafted);
  }

  getFilteredPlayers(
    searchQuery: string = '',
    position: string = 'ALL',
    sortBy: SortOption = 'adp'
  ): SnakeDraftPlayer[] {
    let filtered = this.players.filter(p => !p.isDrafted);

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.team.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Position filter
    if (position !== 'ALL') {
      filtered = filtered.filter(p => p.position === position);
    }

    // Sort by option
    return this.sortPlayers(filtered, sortBy);
  }

  private sortPlayers(players: SnakeDraftPlayer[], sortBy: SortOption): SnakeDraftPlayer[] {
    const userTeam = this.teams.find(t => t.id === this.userTeamId);
    
    switch (sortBy) {
      case 'adp':
        return players.sort((a, b) => a.adp - b.adp);
      
      case 'projected':
        return players.sort((a, b) => b.projectedPoints - a.projectedPoints);
      
      case 'value':
        return players.sort((a, b) => b.valueOverReplacement - a.valueOverReplacement);
      
      case 'upside':
        return players.sort((a, b) => b.upside - a.upside);
      
      case 'recommended':
        return this.getRecommendedPlayers(players);
      
      case 'needed':
        return this.getNeededPlayers(players, userTeam);
      
      case 'undervalued':
        return this.getUndervaluedPlayers(players);
      
      case 'breakout':
        return players.sort((a, b) => (b.breakoutPotential || 0) - (a.breakoutPotential || 0));
      
      case 'safe':
        return players.sort((a, b) => b.consistency - a.consistency);
      
      case 'risky':
        return players.sort((a, b) => (b.bustRisk || 0) - (a.bustRisk || 0));
      
      default:
        return players;
    }
  }

  private getRecommendedPlayers(players: SnakeDraftPlayer[]): SnakeDraftPlayer[] {
    const userTeam = this.teams.find(t => t.id === this.userTeamId);
    if (!userTeam) return players;

    return players.sort((a, b) => {
      const aScore = this.calculateRecommendationScore(a, userTeam);
      const bScore = this.calculateRecommendationScore(b, userTeam);
      return bScore - aScore;
    });
  }

  private calculateRecommendationScore(player: SnakeDraftPlayer, userTeam: any): number {
    let score = 0;

    // Base value score
    score += player.valueOverReplacement * 0.3;

    // Position need multiplier
    const positionNeed = this.getPositionNeed(player.position, userTeam);
    score *= positionNeed;

    // ADP vs current pick position
    const picksUntilNextTurn = this.getPicksUntilNextTurn();
    if (player.adp <= this.getCurrentPickNumber() + picksUntilNextTurn) {
      score *= 1.5; // Boost if might not be available next turn
    }

    // Consistency for early rounds, upside for later rounds
    if (this.currentRound <= 6) {
      score += player.consistency * 10;
    } else {
      score += (player.breakoutPotential || 0) * 5;
    }

    // Penalty for injury risk
    if (player.injuryRisk === 'HIGH') score *= 0.8;
    if (player.injuryRisk === 'MEDIUM') score *= 0.9;

    return score;
  }

  private getNeededPlayers(players: SnakeDraftPlayer[], userTeam: any): SnakeDraftPlayer[] {
    if (!userTeam) return players;

    const needs = this.calculateTeamNeeds(userTeam);
    return players.sort((a, b) => {
      const aNeed = needs[a.position] || 0;
      const bNeed = needs[b.position] || 0;
      if (aNeed !== bNeed) return bNeed - aNeed;
      return b.valueOverReplacement - a.valueOverReplacement;
    });
  }

  private getUndervaluedPlayers(players: SnakeDraftPlayer[]): SnakeDraftPlayer[] {
    return players.sort((a, b) => {
      const aValue = a.estimatedValue - (200 - a.adp * 2); // Rough value vs cost
      const bValue = b.estimatedValue - (200 - b.adp * 2);
      return bValue - aValue;
    });
  }

  private getPositionNeed(position: string, userTeam: any): number {
    if (!userTeam || !userTeam.roster) return 1;

    const current = userTeam.roster[position] || 0;
    const targets = { QB: 2, RB: 4, WR: 5, TE: 2, K: 1, DST: 1 };
    const target = targets[position as keyof typeof targets] || 0;
    
    if (current === 0) return 2.0; // Urgent need
    if (current < target) return 1.5; // High need
    if (current === target) return 1.0; // Filled need
    return 0.7; // Luxury
  }

  private calculateTeamNeeds(userTeam: any): Record<string, number> {
    const needs: Record<string, number> = {};
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    
    positions.forEach(pos => {
      needs[pos] = this.getPositionNeed(pos, userTeam);
    });

    return needs;
  }

  private getCurrentPickNumber(): number {
    return (this.currentRound - 1) * this.teams.length + this.draftPosition;
  }

  private getPicksUntilNextTurn(): number {
    const isEvenRound = this.currentRound % 2 === 0;
    if (isEvenRound) {
      return this.draftPosition * 2 - 1;
    } else {
      return (this.teams.length - this.draftPosition) * 2 + 1;
    }
  }

  getAnalytics(): SnakeDraftAnalytics {
    const userTeam = this.teams.find(t => t.id === this.userTeamId);
    const availablePlayers = this.getAllPlayers();
    
    return {
      draftPosition: this.draftPosition,
      roundsRemaining: this.totalRounds - this.currentRound + 1,
      userTeamNeeds: this.getUserTeamNeeds(userTeam),
      recommendedTargets: this.getRecommendedPlayers(availablePlayers).slice(0, 10),
      valueTargets: this.getUndervaluedPlayers(availablePlayers).slice(0, 10),
      breakoutCandidates: availablePlayers
        .filter(p => (p.breakoutPotential || 0) >= 40)
        .sort((a, b) => (b.breakoutPotential || 0) - (a.breakoutPotential || 0))
        .slice(0, 10),
      safePlayers: availablePlayers
        .filter(p => p.consistency >= 7 && p.injuryRisk === 'LOW')
        .sort((a, b) => b.consistency - a.consistency)
        .slice(0, 10),
      riskyPlayers: availablePlayers
        .filter(p => (p.bustRisk || 0) >= 40)
        .sort((a, b) => (b.bustRisk || 0) - (a.bustRisk || 0))
        .slice(0, 10),
      positionalRankings: this.getPositionalRankings(availablePlayers)
    };
  }

  private getUserTeamNeeds(userTeam: any): string[] {
    if (!userTeam) return [];
    
    const needs: string[] = [];
    const roster = userTeam.roster || {};
    
    if ((roster.QB || 0) < 1) needs.push('QB - Starter needed');
    if ((roster.RB || 0) < 2) needs.push('RB - Need ' + (2 - (roster.RB || 0)) + ' more');
    if ((roster.WR || 0) < 2) needs.push('WR - Need ' + (2 - (roster.WR || 0)) + ' more');
    if ((roster.TE || 0) < 1) needs.push('TE - Starter needed');
    if ((roster.K || 0) < 1) needs.push('K - Kicker needed');
    if ((roster.DST || 0) < 1) needs.push('DST - Defense needed');
    
    return needs;
  }

  private getPositionalRankings(players: SnakeDraftPlayer[]): Record<string, SnakeDraftPlayer[]> {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    const rankings: Record<string, SnakeDraftPlayer[]> = {};
    
    positions.forEach(pos => {
      rankings[pos] = players
        .filter(p => p.position === pos)
        .sort((a, b) => b.projectedPoints - a.projectedPoints)
        .slice(0, 20);
    });
    
    return rankings;
  }

  updateCurrentRound(round: number): void {
    this.currentRound = round;
  }

  draftPlayer(playerId: string, teamId: string): boolean {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isDrafted) return false;

    player.isDrafted = true;
    player.draftedBy = teamId;
    
    // Update team roster
    const team = this.teams.find(t => t.id === teamId);
    if (team && team.roster) {
      team.roster[player.position] = (team.roster[player.position] || 0) + 1;
    }

    return true;
  }
}