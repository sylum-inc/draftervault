// Enhanced NFL Data Service using RapidAPI Tank01
export interface NFLPlayerData {
  playerID: string;
  espnName: string;
  team: string;
  pos: string;
  teamID: string;
  espnID: string;
  stats?: {
    fantasyPoints?: number;
    passing?: {
      passingYards: number;
      passingTDs: number;
      passingINTs: number;
    };
    rushing?: {
      rushingYards: number;
      rushingTDs: number;
    };
    receiving?: {
      receptions: number;
      receivingYards: number;
      receivingTDs: number;
    };
  };
  projections?: {
    fantasyPoints: number;
    adp: number;
  };
}

export class NFLDataService {
  private apiKey: string;
  private baseUrl = 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('NFL API request failed:', error);
      return null;
    }
  }

  public async getPlayerStats(season = '2024'): Promise<NFLPlayerData[]> {
    const data = await this.makeRequest(`/getNFLPlayerInfo?playerName=&getStats=true`);
    
    if (!data || !data.body) {
      console.warn('No player data received from API');
      return [];
    }

    return Object.values(data.body).map((player: any) => ({
      playerID: player.playerID,
      espnName: player.espnName,
      team: player.team,
      pos: player.pos,
      teamID: player.teamID,
      espnID: player.espnID,
      stats: player.stats,
      projections: {
        fantasyPoints: this.calculateProjectedPoints(player),
        adp: this.estimateADP(player)
      }
    }));
  }

  public async getTeamRoster(teamAbv: string): Promise<NFLPlayerData[]> {
    const data = await this.makeRequest(`/getNFLTeamRoster?teamAbv=${teamAbv}&getStats=true`);
    
    if (!data || !data.body) {
      return [];
    }

    return data.body.map((player: any) => ({
      playerID: player.playerID,
      espnName: player.espnName,
      team: player.team,
      pos: player.pos,
      teamID: player.teamID,
      espnID: player.espnID,
      stats: player.stats,
      projections: {
        fantasyPoints: this.calculateProjectedPoints(player),
        adp: this.estimateADP(player)
      }
    }));
  }

  public async getPlayerByName(playerName: string): Promise<NFLPlayerData | null> {
    const data = await this.makeRequest(`/getNFLPlayerInfo?playerName=${encodeURIComponent(playerName)}&getStats=true`);
    
    if (!data || !data.body) {
      return null;
    }

    const players = Object.values(data.body) as any[];
    const player = players[0];
    
    if (!player) return null;

    return {
      playerID: player.playerID,
      espnName: player.espnName,
      team: player.team,
      pos: player.pos,
      teamID: player.teamID,
      espnID: player.espnID,
      stats: player.stats,
      projections: {
        fantasyPoints: this.calculateProjectedPoints(player),
        adp: this.estimateADP(player)
      }
    };
  }

  private calculateProjectedPoints(player: any): number {
    if (!player.stats) return 0;

    let points = 0;
    const stats = player.stats;

    // QB Scoring: 4pt passing TD, 1pt per 25 pass yards, 6pt rush TD, 1pt per 10 rush yards, -2 INT
    if (player.pos === 'QB') {
      if (stats.passing) {
        points += (stats.passing.passingYards || 0) / 25;
        points += (stats.passing.passingTDs || 0) * 4;
        points -= (stats.passing.passingINTs || 0) * 2;
      }
      if (stats.rushing) {
        points += (stats.rushing.rushingYards || 0) / 10;
        points += (stats.rushing.rushingTDs || 0) * 6;
      }
    }

    // RB Scoring: 6pt rush TD, 1pt per 10 rush/rec yards, 6pt rec TD, 1pt per reception (PPR)
    if (player.pos === 'RB') {
      if (stats.rushing) {
        points += (stats.rushing.rushingYards || 0) / 10;
        points += (stats.rushing.rushingTDs || 0) * 6;
      }
      if (stats.receiving) {
        points += (stats.receiving.receptions || 0); // PPR
        points += (stats.receiving.receivingYards || 0) / 10;
        points += (stats.receiving.receivingTDs || 0) * 6;
      }
    }

    // WR/TE Scoring: 1pt per reception (PPR), 1pt per 10 rec yards, 6pt rec TD
    if (player.pos === 'WR' || player.pos === 'TE') {
      if (stats.receiving) {
        points += (stats.receiving.receptions || 0); // PPR
        points += (stats.receiving.receivingYards || 0) / 10;
        points += (stats.receiving.receivingTDs || 0) * 6;
      }
      // Some WRs have rushing stats
      if (stats.rushing) {
        points += (stats.rushing.rushingYards || 0) / 10;
        points += (stats.rushing.rushingTDs || 0) * 6;
      }
    }

    // Project for 17 game season if current stats are partial
    return Math.round(points * 1.1); // Slight bump for projections
  }

  private estimateADP(player: any): number {
    const projectedPoints = this.calculateProjectedPoints(player);
    
    // Rough ADP estimation based on projected points and position
    const positionMultipliers = {
      'QB': 0.7,  // QBs typically drafted later
      'RB': 1.2,  // RBs get premium early
      'WR': 1.0,  // WRs standard value
      'TE': 0.6   // TEs except elite ones go late
    };

    const multiplier = positionMultipliers[player.pos as keyof typeof positionMultipliers] || 1.0;
    const baseADP = Math.max(1, Math.round(300 - (projectedPoints * multiplier)));
    
    return Math.min(300, baseADP);
  }

  public async getInjuryReport(): Promise<any> {
    const data = await this.makeRequest('/getNFLTeamSchedule?teamAbv=ALL&season=2024');
    return data;
  }
}

// Enhanced player data with real NFL integration
export interface EnhancedPlayer {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  tier: 1 | 2 | 3 | 4;
  baseValue: number;
  estimatedValue: number;
  projectedPoints: number;
  adp: number;
  isDrafted: boolean;
  draftedBy?: string;
  draftCost?: number;
  pickNumber?: number;
  nflData?: NFLPlayerData;
  byeWeek?: number;
  injuryStatus?: 'Healthy' | 'Questionable' | 'Doubtful' | 'Out';
  trends?: {
    isRising: boolean;
    weeklyTrend: number;
  };
}