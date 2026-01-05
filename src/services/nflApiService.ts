// NFL API Service with RapidAPI Integration
export interface NFLPlayerData {
  playerId: string;
  name: string;
  position: string;
  team: string;
  stats: {
    passingYards?: number;
    passingTds?: number;
    interceptions?: number;
    rushingYards?: number;
    rushingTds?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTds?: number;
    targets?: number;
    carries?: number;
    fantasyPoints?: number;
  };
  projections: {
    season: {
      fantasyPoints: number;
      games: number;
      confidence: number;
    };
    weekly: Array<{
      week: number;
      projectedPoints: number;
      matchupRating: number;
    }>;
  };
  analytics: {
    targetShare: number;
    redZoneShare: number;
    airhYards: number;
    avgDepthOfTarget: number;
    yardsAfterCatch: number;
    snapCount: number;
    routeParticipation: number;
    pressureRate?: number;
    blitzRate?: number;
    completionPct?: number;
  };
  injuryReport: {
    status: 'HEALTHY' | 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR';
    injuryType?: string;
    lastInjury?: string;
    gamesReturned?: number;
  };
  schedule: {
    strengthOfSchedule: number;
    homeGames: number;
    awayGames: number;
    domeGames: number;
    outdoorGames: number;
    primetime: number;
    divisional: number;
  };
}

export interface TeamData {
  teamId: string;
  name: string;
  city: string;
  abbreviation: string;
  stats: {
    offensiveRank: number;
    defensiveRank: number;
    paceRank: number;
    redZoneEfficiency: number;
    turnoversForced: number;
    timeOfPossession: number;
    yardsPerGame: number;
    pointsPerGame: number;
    pointsAllowed: number;
  };
  injuries: Array<{
    player: string;
    position: string;
    status: string;
    injury: string;
  }>;
  depthChart: Record<string, Array<{
    player: string;
    depth: number;
  }>>;
}

export interface WeatherData {
  gameId: string;
  week: number;
  temperature: number;
  windSpeed: number;
  precipitation: number;
  domeGame: boolean;
  weatherImpact: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
}

class NFLApiService {
  private readonly rapidApiKey = 'RAPIDAPI_NFL_KEY'; // Will be accessed via edge function
  private readonly baseUrl = 'https://nfl-football-api.p.rapidapi.com';
  
  async fetchPlayerData(playerId: string): Promise<NFLPlayerData | null> {
    try {
      const response = await fetch('/api/nfl/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch player data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching player data:', error);
      return null;
    }
  }

  async fetchTeamData(teamId: string): Promise<TeamData | null> {
    try {
      const response = await fetch('/api/nfl/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch team data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching team data:', error);
      return null;
    }
  }

  async fetchWeatherData(week: number): Promise<WeatherData[]> {
    try {
      const response = await fetch('/api/nfl/weather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ week })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch weather data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching weather data:', error);
      return [];
    }
  }

  async fetchInjuryReport(): Promise<Array<{player: string, status: string, injury: string}>> {
    try {
      const response = await fetch('/api/nfl/injuries');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch injury report: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching injury report:', error);
      return [];
    }
  }

  async fetchDepthCharts(): Promise<Record<string, any>> {
    try {
      const response = await fetch('/api/nfl/depth-charts');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch depth charts: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching depth charts:', error);
      return {};
    }
  }

  async fetchAdvancedMetrics(playerId: string): Promise<any> {
    try {
      const response = await fetch('/api/nfl/advanced-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch advanced metrics: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching advanced metrics:', error);
      return null;
    }
  }

  // ESPN API integration methods
  async fetchESPNData(leagueId?: string): Promise<any> {
    try {
      const response = await fetch('/api/espn/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leagueId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ESPN data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching ESPN data:', error);
      return null;
    }
  }

  async syncWithESPN(leagueId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/espn/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leagueId })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error syncing with ESPN:', error);
      return false;
    }
  }
}

export const nflApiService = new NFLApiService();