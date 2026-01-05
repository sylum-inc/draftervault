// Utility to generate realistic historical performance data for players
export const generatePlayerHistoricalData = (playerName: string, position: string, currentProjection: number) => {
  // Generate 3 years of historical data with realistic variance
  const basePerformance = currentProjection;
  const data = [];
  
  for (let i = 0; i < 3; i++) {
    const year = 2024 - (2 - i);
    
    // Add position-specific variance and career progression
    let expectedBase = basePerformance;
    let actualBase = basePerformance;
    
    // Apply year-based adjustments (rookie progression, veteran decline, etc.)
    if (i === 0) { // 2022 - earlier in career
      expectedBase *= 0.85;
      actualBase *= (0.7 + Math.random() * 0.4); // Higher variance for development
    } else if (i === 1) { // 2023 - development year
      expectedBase *= 0.92;
      actualBase *= (0.8 + Math.random() * 0.4);
    } else { // 2024 - current projection
      actualBase *= (0.85 + Math.random() * 0.3);
    }
    
    // Add position-specific adjustments
    const positionMultipliers = {
      QB: 1.0,
      RB: 0.95, // Slightly more volatile
      WR: 1.02,
      TE: 0.98,
      K: 1.1,   // More consistent
      DST: 0.9  // More volatile
    };
    
    expectedBase *= positionMultipliers[position as keyof typeof positionMultipliers] || 1.0;
    actualBase *= positionMultipliers[position as keyof typeof positionMultipliers] || 1.0;
    
    // Add some realistic injury/breakout scenarios
    const randomFactor = Math.random();
    if (randomFactor < 0.15) { // 15% chance of injury year
      actualBase *= 0.6;
    } else if (randomFactor > 0.85) { // 15% chance of breakout year
      actualBase *= 1.3;
    }
    
    const expected = Math.round(expectedBase);
    const actual = Math.round(actualBase);
    const differential = actual - expected;
    
    data.push({
      year: year.toString(),
      expected,
      actual,
      differential
    });
  }
  
  return data;
};

export const generateMarketTrendData = (players: any[]) => {
  // Generate market trend data showing how values have changed
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
  
  return weeks.map(week => {
    const baseMultiplier = 1 + (Math.sin(week / 12 * Math.PI * 2) * 0.1);
    
    return {
      week: `Week ${week}`,
      QB: Math.round(players.filter(p => p.position === 'QB').reduce((sum, p) => sum + p.estimatedValue, 0) / players.filter(p => p.position === 'QB').length * baseMultiplier),
      RB: Math.round(players.filter(p => p.position === 'RB').reduce((sum, p) => sum + p.estimatedValue, 0) / players.filter(p => p.position === 'RB').length * baseMultiplier * 1.1),
      WR: Math.round(players.filter(p => p.position === 'WR').reduce((sum, p) => sum + p.estimatedValue, 0) / players.filter(p => p.position === 'WR').length * baseMultiplier * 0.95),
      TE: Math.round(players.filter(p => p.position === 'TE').reduce((sum, p) => sum + p.estimatedValue, 0) / players.filter(p => p.position === 'TE').length * baseMultiplier * 1.05)
    };
  });
};

export const generateTeamNeedsRadarData = (team: any, allPlayers: any[]) => {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
  
  return positions.map(position => {
    const positionPlayers = allPlayers.filter(p => p.position === position && p.draftedBy === team.id);
    const averageValue = positionPlayers.length > 0 
      ? positionPlayers.reduce((sum, p) => sum + p.estimatedValue, 0) / positionPlayers.length
      : 0;
    
    // Calculate strength score (0-100)
    const maxPossibleValue = Math.max(...allPlayers.filter(p => p.position === position).map(p => p.estimatedValue));
    const strengthScore = maxPossibleValue > 0 ? (averageValue / maxPossibleValue) * 100 : 0;
    
    return {
      position,
      strength: Math.round(strengthScore),
      count: positionPlayers.length,
      averageValue: Math.round(averageValue)
    };
  });
};