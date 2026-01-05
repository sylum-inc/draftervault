import { SnakeDraftPlayer } from '@/services/auctionDraftService';
import { realPlayerDataService } from '@/services/realPlayerDataService';
import { CORRECT_AUCTION_PLAYERS } from '@/data/correctAuctionPlayers';

// Create a set of auction player names for fast lookup
const auctionPlayerNames = new Set(CORRECT_AUCTION_PLAYERS.map(p => p.name));

// Filter out auction players and create snake draft eligible players
const allPlayers = realPlayerDataService.generateRealNFLDatabase();

// First, let's get the eligible players by position
const getEligiblePlayersByPosition = (position: string, limit?: number) => {
  return allPlayers
    .filter(p => p.position === position && !auctionPlayerNames.has(p.name))
    .sort((a, b) => a.adp - b.adp)
    .slice(0, limit);
};

// Build the snake draft database
const snakeDraftPlayers: SnakeDraftPlayer[] = [
  // Top 100 RBs (minus 18 auction RBs = 82 remaining RBs needed)
  ...getEligiblePlayersByPosition('RB', 100),
  
  // Top 100 WRs (minus 35 auction WRs = 65 remaining WRs needed) 
  ...getEligiblePlayersByPosition('WR', 100),
  
  // Top 100 TEs (minus 3 auction TEs = 97 remaining TEs needed)
  ...getEligiblePlayersByPosition('TE', 100),
  
  // All remaining QBs (all starters since only 5 in auction)
  ...getEligiblePlayersByPosition('QB', 32), // 32 starting QBs
  
  // All Kickers (none in auction)
  ...getEligiblePlayersByPosition('K', 32), // 32 kickers
  
  // All Defenses (none in auction)  
  ...getEligiblePlayersByPosition('DST', 32), // 32 defenses
];

export const snakeDraftPlayerDatabase: SnakeDraftPlayer[] = snakeDraftPlayers;

// Export helper functions
export const getPlayersByPosition = (position: string): SnakeDraftPlayer[] => {
  return snakeDraftPlayerDatabase.filter(player => player.position === position);
};

export const getAvailablePlayers = (): SnakeDraftPlayer[] => {
  return snakeDraftPlayerDatabase.filter(player => !player.isDrafted);
};

export const getPlayersByTeam = (team: string): SnakeDraftPlayer[] => {
  return snakeDraftPlayerDatabase.filter(player => player.team === team);
};

export const TOTAL_PLAYERS = snakeDraftPlayerDatabase.length;