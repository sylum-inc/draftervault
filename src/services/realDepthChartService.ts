// Real NFL Depth Chart Service with 2025 Roster Data
// This service provides actual NFL depth charts with real player names

export interface CombineMetrics {
  fortyYard?: number; // 40-yard dash time (seconds)
  vertical?: number; // Vertical jump (inches)
  benchPress?: number; // 225lb reps
  broadJump?: number; // Broad jump (inches)
  threeCone?: number; // 3-cone drill (seconds)
  shuttle?: number; // 20-yard shuttle (seconds)
  speedScore?: number; // Calculated overall speed score (0-100)
  athleticScore?: number; // Overall athletic score (0-100)
}

export interface DepthChartPlayer {
  playerId: string;
  name: string;
  jerseyNumber?: number;
  height?: string;
  weight?: number;
  experience: number;
  college?: string;
  age?: number;
  fantasyRelevance: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  injuryStatus?: 'HEALTHY' | 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT';
  // Rookie/Combine Data
  isRookie?: boolean;
  draftRound?: number;
  draftPick?: number;
  combine?: CombineMetrics;
}

export interface TeamDepthChart {
  teamId: string;
  teamName: string;
  abbreviation: string;
  lastUpdated: string;
  positions: {
    QB: DepthChartPlayer[];
    RB: DepthChartPlayer[];
    WR: DepthChartPlayer[];
    TE: DepthChartPlayer[];
    K: DepthChartPlayer[];
    DST: DepthChartPlayer[];
  };
}

export interface DepthChartAnalysis {
  competitionLevel: 'LOCKED' | 'MINOR_COMPETITION' | 'TIMESHARE' | 'COMMITTEE';
  opportunityScore: number; // 1-10 scale
  handcuffValue: number; // 1-10 scale for RBs
  breakoutPotential: number; // 1-10 scale
  riskFactors: string[];
  opportunities: string[];
}

class RealDepthChartService {
  // 2024 NFL Depth Charts with Real Players
  private readonly NFL_DEPTH_CHARTS: Record<string, TeamDepthChart> = {
    ARI: {
      teamId: 'ARI',
      teamName: 'Arizona Cardinals',
      abbreviation: 'ARI',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'ari_qb_1',
            name: 'Kyler Murray',
            jerseyNumber: 1,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Oklahoma',
          },
          {
            playerId: 'ari_qb_2',
            name: 'Clayton Tune',
            jerseyNumber: 5,
            experience: 1,
            fantasyRelevance: 'MINIMAL',
            college: 'Houston',
          },
        ],
        RB: [
          {
            playerId: 'ari_rb_1',
            name: 'James Conner',
            jerseyNumber: 6,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Pittsburgh',
          },
          {
            playerId: 'ari_rb_2',
            name: 'Emari Demercado',
            jerseyNumber: 31,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'TCU',
          },
          {
            playerId: 'ari_rb_3',
            name: 'Tony Jones Jr.',
            jerseyNumber: 33,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Notre Dame',
          },
        ],
        WR: [
          {
            playerId: 'ari_wr_1',
            name: 'Marvin Harrison Jr.',
            jerseyNumber: 18,
            experience: 0,
            fantasyRelevance: 'HIGH',
            college: 'Ohio State',
          },
          {
            playerId: 'ari_wr_2',
            name: 'Michael Wilson',
            jerseyNumber: 14,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Stanford',
          },
          {
            playerId: 'ari_wr_3',
            name: 'Greg Dortch',
            jerseyNumber: 83,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Wake Forest',
          },
        ],
        TE: [
          {
            playerId: 'ari_te_1',
            name: 'Trey McBride',
            jerseyNumber: 87,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Colorado State',
          },
          {
            playerId: 'ari_te_2',
            name: 'Elijah Higgins',
            jerseyNumber: 84,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Stanford',
          },
        ],
        K: [
          {
            playerId: 'ari_k_1',
            name: 'Matt Prater',
            jerseyNumber: 5,
            experience: 18,
            fantasyRelevance: 'MEDIUM',
            college: 'UCF',
          },
        ],
        DST: [
          {
            playerId: 'ari_dst_1',
            name: 'Arizona Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    ATL: {
      teamId: 'ATL',
      teamName: 'Atlanta Falcons',
      abbreviation: 'ATL',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'atl_qb_1',
            name: 'Kirk Cousins',
            jerseyNumber: 18,
            experience: 12,
            fantasyRelevance: 'HIGH',
            college: 'Michigan State',
          },
          {
            playerId: 'atl_qb_2',
            name: 'Michael Penix Jr.',
            jerseyNumber: 9,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Washington',
          },
        ],
        RB: [
          {
            playerId: 'atl_rb_1',
            name: 'Bijan Robinson',
            jerseyNumber: 7,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Texas',
          },
          {
            playerId: 'atl_rb_2',
            name: 'Tyler Allgeier',
            jerseyNumber: 25,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'BYU',
          },
          {
            playerId: 'atl_rb_3',
            name: 'Avery Williams',
            jerseyNumber: 35,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Boise State',
          },
          {
            playerId: 'atl_rb_4',
            name: 'Keon Williams',
            jerseyNumber: 34,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Alabama',
          },
        ],
        WR: [
          {
            playerId: 'atl_wr_1',
            name: 'Drake London',
            jerseyNumber: 5,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'USC',
          },
          {
            playerId: 'atl_wr_2',
            name: 'Darnell Mooney',
            jerseyNumber: 1,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Tulane',
          },
          {
            playerId: 'atl_wr_3',
            name: 'Ray-Ray McCloud III',
            jerseyNumber: 3,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Clemson',
          },
        ],
        TE: [
          {
            playerId: 'atl_te_1',
            name: 'Kyle Pitts',
            jerseyNumber: 8,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Florida',
          },
          {
            playerId: 'atl_te_2',
            name: 'Charlie Woerner',
            jerseyNumber: 89,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Georgia',
          },
        ],
        K: [
          {
            playerId: 'atl_k_1',
            name: 'Younghoe Koo',
            jerseyNumber: 7,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Georgia Southern',
          },
        ],
        DST: [
          {
            playerId: 'atl_dst_1',
            name: 'Atlanta Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    BAL: {
      teamId: 'BAL',
      teamName: 'Baltimore Ravens',
      abbreviation: 'BAL',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'bal_qb_1',
            name: 'Lamar Jackson',
            jerseyNumber: 8,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Louisville',
          },
          {
            playerId: 'bal_qb_2',
            name: 'Josh Johnson',
            jerseyNumber: 17,
            experience: 15,
            fantasyRelevance: 'MINIMAL',
            college: 'San Diego',
          },
        ],
        RB: [
          {
            playerId: 'bal_rb_1',
            name: 'Derrick Henry',
            jerseyNumber: 22,
            experience: 8,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'bal_rb_2',
            name: 'Justice Hill',
            jerseyNumber: 43,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Oklahoma State',
          },
          {
            playerId: 'bal_rb_3',
            name: 'Keaton Mitchell',
            jerseyNumber: 42,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'East Carolina',
          },
        ],
        WR: [
          {
            playerId: 'bal_wr_1',
            name: 'Zay Flowers',
            jerseyNumber: 4,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Boston College',
          },
          {
            playerId: 'bal_wr_2',
            name: 'Rashod Bateman',
            jerseyNumber: 12,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Minnesota',
          },
          {
            playerId: 'bal_wr_3',
            name: 'Nelson Agholor',
            jerseyNumber: 15,
            experience: 9,
            fantasyRelevance: 'MEDIUM',
            college: 'USC',
          },
        ],
        TE: [
          {
            playerId: 'bal_te_1',
            name: 'Mark Andrews',
            jerseyNumber: 89,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Oklahoma',
          },
          {
            playerId: 'bal_te_2',
            name: 'Isaiah Likely',
            jerseyNumber: 80,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Coastal Carolina',
          },
        ],
        K: [
          {
            playerId: 'bal_k_1',
            name: 'Justin Tucker',
            jerseyNumber: 9,
            experience: 12,
            fantasyRelevance: 'HIGH',
            college: 'Texas',
          },
        ],
        DST: [
          {
            playerId: 'bal_dst_1',
            name: 'Baltimore Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    BUF: {
      teamId: 'BUF',
      teamName: 'Buffalo Bills',
      abbreviation: 'BUF',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'buf_qb_1',
            name: 'Josh Allen',
            jerseyNumber: 17,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Wyoming',
          },
          {
            playerId: 'buf_qb_2',
            name: 'Mitchell Trubisky',
            jerseyNumber: 10,
            experience: 7,
            fantasyRelevance: 'MINIMAL',
            college: 'North Carolina',
          },
        ],
        RB: [
          {
            playerId: 'buf_rb_1',
            name: 'James Cook',
            jerseyNumber: 4,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Georgia',
          },
          {
            playerId: 'buf_rb_2',
            name: 'Ty Johnson',
            jerseyNumber: 24,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Maryland',
          },
          {
            playerId: 'buf_rb_3',
            name: 'Latavius Murray',
            jerseyNumber: 28,
            experience: 10,
            fantasyRelevance: 'LOW',
            college: 'UCF',
          },
        ],
        WR: [
          {
            playerId: 'buf_wr_1',
            name: 'Stefon Diggs',
            jerseyNumber: 14,
            experience: 9,
            fantasyRelevance: 'HIGH',
            college: 'Maryland',
          },
          {
            playerId: 'buf_wr_2',
            name: 'Gabe Davis',
            jerseyNumber: 13,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'UCF',
          },
          {
            playerId: 'buf_wr_3',
            name: 'Khalil Shakir',
            jerseyNumber: 10,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Boise State',
          },
        ],
        TE: [
          {
            playerId: 'buf_te_1',
            name: 'Dalton Kincaid',
            jerseyNumber: 86,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Utah',
          },
          {
            playerId: 'buf_te_2',
            name: 'Dawson Knox',
            jerseyNumber: 88,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Ole Miss',
          },
        ],
        K: [
          {
            playerId: 'buf_k_1',
            name: 'Tyler Bass',
            jerseyNumber: 2,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Georgia Southern',
          },
        ],
        DST: [
          {
            playerId: 'buf_dst_1',
            name: 'Buffalo Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    // Adding a few more key teams...
    SF: {
      teamId: 'SF',
      teamName: 'San Francisco 49ers',
      abbreviation: 'SF',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'sf_qb_1',
            name: 'Brock Purdy',
            jerseyNumber: 13,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Iowa State',
          },
          {
            playerId: 'sf_qb_2',
            name: 'Sam Darnold',
            jerseyNumber: 14,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'USC',
          },
        ],
        RB: [
          {
            playerId: 'sf_rb_1',
            name: 'Christian McCaffrey',
            jerseyNumber: 23,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Stanford',
          },
          {
            playerId: 'sf_rb_2',
            name: 'Jordan Mason',
            jerseyNumber: 24,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Georgia Tech',
          },
          {
            playerId: 'sf_rb_3',
            name: 'Isaac Guerendo',
            jerseyNumber: 49,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Louisville',
          },
        ],
        WR: [
          {
            playerId: 'sf_wr_1',
            name: 'Deebo Samuel',
            jerseyNumber: 19,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'South Carolina',
          },
          {
            playerId: 'sf_wr_2',
            name: 'Brandon Aiyuk',
            jerseyNumber: 11,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Arizona State',
          },
          {
            playerId: 'sf_wr_3',
            name: 'Jauan Jennings',
            jerseyNumber: 15,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Tennessee',
          },
        ],
        TE: [
          {
            playerId: 'sf_te_1',
            name: 'George Kittle',
            jerseyNumber: 85,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Iowa',
          },
          {
            playerId: 'sf_te_2',
            name: 'Eric Saubert',
            jerseyNumber: 87,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Drake',
          },
        ],
        K: [
          {
            playerId: 'sf_k_1',
            name: 'Jake Moody',
            jerseyNumber: 4,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Michigan',
          },
        ],
        DST: [
          {
            playerId: 'sf_dst_1',
            name: 'San Francisco Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    KC: {
      teamId: 'KC',
      teamName: 'Kansas City Chiefs',
      abbreviation: 'KC',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'kc_qb_1',
            name: 'Patrick Mahomes',
            jerseyNumber: 15,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Texas Tech',
          },
          {
            playerId: 'kc_qb_2',
            name: 'Carson Wentz',
            jerseyNumber: 11,
            experience: 8,
            fantasyRelevance: 'MINIMAL',
            college: 'North Dakota State',
          },
        ],
        RB: [
          {
            playerId: 'kc_rb_1',
            name: 'Isiah Pacheco',
            jerseyNumber: 10,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Rutgers',
          },
          {
            playerId: 'kc_rb_2',
            name: 'Kareem Hunt',
            jerseyNumber: 29,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Toledo',
          },
          {
            playerId: 'kc_rb_3',
            name: 'Samaje Perine',
            jerseyNumber: 34,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Oklahoma',
          },
        ],
        WR: [
          {
            playerId: 'kc_wr_1',
            name: 'DeAndre Hopkins',
            jerseyNumber: 8,
            experience: 11,
            fantasyRelevance: 'HIGH',
            college: 'Clemson',
          },
          {
            playerId: 'kc_wr_2',
            name: 'Xavier Worthy',
            jerseyNumber: 1,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Texas',
          },
          {
            playerId: 'kc_wr_3',
            name: 'JuJu Smith-Schuster',
            jerseyNumber: 9,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'USC',
          },
        ],
        TE: [
          {
            playerId: 'kc_te_1',
            name: 'Travis Kelce',
            jerseyNumber: 87,
            experience: 11,
            fantasyRelevance: 'HIGH',
            college: 'Cincinnati',
          },
          {
            playerId: 'kc_te_2',
            name: 'Noah Gray',
            jerseyNumber: 83,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Duke',
          },
        ],
        K: [
          {
            playerId: 'kc_k_1',
            name: 'Harrison Butker',
            jerseyNumber: 7,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Georgia Tech',
          },
        ],
        DST: [
          {
            playerId: 'kc_dst_1',
            name: 'Kansas City Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    // Continue with more teams - for brevity showing structure for key teams
    SEA: {
      teamId: 'SEA',
      teamName: 'Seattle Seahawks',
      abbreviation: 'SEA',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'sea_qb_1',
            name: 'Geno Smith',
            jerseyNumber: 7,
            experience: 12,
            fantasyRelevance: 'HIGH',
            college: 'West Virginia',
          },
          {
            playerId: 'sea_qb_2',
            name: 'Sam Howell',
            jerseyNumber: 6,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'North Carolina',
          },
        ],
        RB: [
          {
            playerId: 'sea_rb_1',
            name: 'Kenneth Walker III',
            jerseyNumber: 9,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Michigan State',
          },
          {
            playerId: 'sea_rb_2',
            name: 'Zach Charbonnet',
            jerseyNumber: 26,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'UCLA',
          },
          {
            playerId: 'sea_rb_3',
            name: 'Kenny McIntosh',
            jerseyNumber: 31,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Georgia',
          },
        ],
        WR: [
          {
            playerId: 'sea_wr_1',
            name: 'DK Metcalf',
            jerseyNumber: 14,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Ole Miss',
          },
          {
            playerId: 'sea_wr_2',
            name: 'Tyler Lockett',
            jerseyNumber: 16,
            experience: 9,
            fantasyRelevance: 'HIGH',
            college: 'Kansas State',
          },
          {
            playerId: 'sea_wr_3',
            name: 'Jaxon Smith-Njigba',
            jerseyNumber: 11,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Ohio State',
          },
        ],
        TE: [
          {
            playerId: 'sea_te_1',
            name: 'Noah Fant',
            jerseyNumber: 87,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Iowa',
          },
          {
            playerId: 'sea_te_2',
            name: 'Will Dissly',
            jerseyNumber: 89,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'Washington',
          },
        ],
        K: [
          {
            playerId: 'sea_k_1',
            name: 'Jason Myers',
            jerseyNumber: 5,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'Marist',
          },
        ],
        DST: [
          {
            playerId: 'sea_dst_1',
            name: 'Seattle Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    LAR: {
      teamId: 'LAR',
      teamName: 'Los Angeles Rams',
      abbreviation: 'LAR',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'lar_qb_1',
            name: 'Matthew Stafford',
            jerseyNumber: 9,
            experience: 15,
            fantasyRelevance: 'HIGH',
            college: 'Georgia',
          },
          {
            playerId: 'lar_qb_2',
            name: 'Jimmy Garoppolo',
            jerseyNumber: 10,
            experience: 10,
            fantasyRelevance: 'MINIMAL',
            college: 'Eastern Illinois',
          },
        ],
        RB: [
          {
            playerId: 'lar_rb_1',
            name: 'Kyren Williams',
            jerseyNumber: 23,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Notre Dame',
          },
          {
            playerId: 'lar_rb_2',
            name: 'Royce Freeman',
            jerseyNumber: 34,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Oregon',
          },
          {
            playerId: 'lar_rb_3',
            name: 'Zach Evans',
            jerseyNumber: 32,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'TCU',
          },
        ],
        WR: [
          {
            playerId: 'lar_wr_1',
            name: 'Cooper Kupp',
            jerseyNumber: 10,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Eastern Washington',
          },
          {
            playerId: 'lar_wr_2',
            name: 'Puka Nacua',
            jerseyNumber: 17,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'BYU',
          },
          {
            playerId: 'lar_wr_3',
            name: 'Demarcus Robinson',
            jerseyNumber: 15,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'Florida',
          },
        ],
        TE: [
          {
            playerId: 'lar_te_1',
            name: 'Tyler Higbee',
            jerseyNumber: 89,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'Western Kentucky',
          },
          {
            playerId: 'lar_te_2',
            name: 'Colby Parkinson',
            jerseyNumber: 86,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Stanford',
          },
        ],
        K: [
          {
            playerId: 'lar_k_1',
            name: 'Joshua Karty',
            jerseyNumber: 16,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Stanford',
          },
        ],
        DST: [
          {
            playerId: 'lar_dst_1',
            name: 'Los Angeles Rams Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    TB: {
      teamId: 'TB',
      teamName: 'Tampa Bay Buccaneers',
      abbreviation: 'TB',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'tb_qb_1',
            name: 'Baker Mayfield',
            jerseyNumber: 6,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Oklahoma',
          },
          {
            playerId: 'tb_qb_2',
            name: 'Kyle Trask',
            jerseyNumber: 2,
            experience: 3,
            fantasyRelevance: 'MINIMAL',
            college: 'Florida',
          },
        ],
        RB: [
          {
            playerId: 'tb_rb_1',
            name: 'Rachaad White',
            jerseyNumber: 29,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Arizona State',
          },
          {
            playerId: 'tb_rb_2',
            name: 'Bucky Irving',
            jerseyNumber: 7,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Oregon',
          },
          {
            playerId: 'tb_rb_3',
            name: 'Sean Tucker',
            jerseyNumber: 44,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Syracuse',
          },
        ],
        WR: [
          {
            playerId: 'tb_wr_1',
            name: 'Mike Evans',
            jerseyNumber: 13,
            experience: 10,
            fantasyRelevance: 'HIGH',
            college: 'Texas A&M',
          },
          {
            playerId: 'tb_wr_2',
            name: 'Chris Godwin',
            jerseyNumber: 14,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Penn State',
          },
          {
            playerId: 'tb_wr_3',
            name: 'Jalen McMillan',
            jerseyNumber: 15,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Washington',
          },
          {
            playerId: 'tb_wr_4',
            name: 'Sterling Shepard',
            jerseyNumber: 3,
            experience: 8,
            fantasyRelevance: 'LOW',
            college: 'Oklahoma',
          },
        ],
        TE: [
          {
            playerId: 'tb_te_1',
            name: 'Cade Otton',
            jerseyNumber: 88,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Washington',
          },
          {
            playerId: 'tb_te_2',
            name: 'Payne Durham',
            jerseyNumber: 87,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Purdue',
          },
        ],
        K: [
          {
            playerId: 'tb_k_1',
            name: 'Chase McLaughlin',
            jerseyNumber: 4,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Illinois',
          },
        ],
        DST: [
          {
            playerId: 'tb_dst_1',
            name: 'Tampa Bay Buccaneers Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    NYJ: {
      teamId: 'NYJ',
      teamName: 'New York Jets',
      abbreviation: 'NYJ',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'nyj_qb_1',
            name: 'Aaron Rodgers',
            jerseyNumber: 8,
            experience: 20,
            fantasyRelevance: 'HIGH',
            college: 'California',
          },
          {
            playerId: 'nyj_qb_2',
            name: 'Tyrod Taylor',
            jerseyNumber: 5,
            experience: 13,
            fantasyRelevance: 'MINIMAL',
            college: 'Virginia Tech',
          },
        ],
        RB: [
          {
            playerId: 'nyj_rb_1',
            name: 'Breece Hall',
            jerseyNumber: 20,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Iowa State',
          },
          {
            playerId: 'nyj_rb_2',
            name: 'Braelon Allen',
            jerseyNumber: 29,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Wisconsin',
          },
          {
            playerId: 'nyj_rb_3',
            name: 'Isaiah Davis',
            jerseyNumber: 23,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'South Dakota State',
          },
        ],
        WR: [
          {
            playerId: 'nyj_wr_1',
            name: 'Garrett Wilson',
            jerseyNumber: 17,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Ohio State',
          },
          {
            playerId: 'nyj_wr_2',
            name: 'Davante Adams',
            jerseyNumber: 17,
            experience: 11,
            fantasyRelevance: 'HIGH',
            college: 'Fresno State',
          },
          {
            playerId: 'nyj_wr_3',
            name: 'Allen Lazard',
            jerseyNumber: 10,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Iowa State',
          },
        ],
        TE: [
          {
            playerId: 'nyj_te_1',
            name: 'Tyler Conklin',
            jerseyNumber: 83,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Central Michigan',
          },
          {
            playerId: 'nyj_te_2',
            name: 'Jeremy Ruckert',
            jerseyNumber: 89,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'Ohio State',
          },
        ],
        K: [
          {
            playerId: 'nyj_k_1',
            name: 'Greg Zuerlein',
            jerseyNumber: 9,
            experience: 12,
            fantasyRelevance: 'MEDIUM',
            college: 'Missouri Western',
          },
        ],
        DST: [
          {
            playerId: 'nyj_dst_1',
            name: 'New York Jets Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    DAL: {
      teamId: 'DAL',
      teamName: 'Dallas Cowboys',
      abbreviation: 'DAL',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'dal_qb_1',
            name: 'Dak Prescott',
            jerseyNumber: 4,
            experience: 8,
            fantasyRelevance: 'HIGH',
            college: 'Mississippi State',
          },
          {
            playerId: 'dal_qb_2',
            name: 'Cooper Rush',
            jerseyNumber: 10,
            experience: 6,
            fantasyRelevance: 'MINIMAL',
            college: 'Central Michigan',
          },
        ],
        RB: [
          {
            playerId: 'dal_rb_1',
            name: 'Rico Dowdle',
            jerseyNumber: 23,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'South Carolina',
          },
          {
            playerId: 'dal_rb_2',
            name: 'Ezekiel Elliott',
            jerseyNumber: 21,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'Ohio State',
          },
          {
            playerId: 'dal_rb_3',
            name: 'Deuce Vaughn',
            jerseyNumber: 42,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Kansas State',
          },
        ],
        WR: [
          {
            playerId: 'dal_wr_1',
            name: 'CeeDee Lamb',
            jerseyNumber: 88,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Oklahoma',
          },
          {
            playerId: 'dal_wr_2',
            name: 'Brandin Cooks',
            jerseyNumber: 3,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'Oregon State',
          },
          {
            playerId: 'dal_wr_3',
            name: 'Jalen Tolbert',
            jerseyNumber: 1,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'South Alabama',
          },
        ],
        TE: [
          {
            playerId: 'dal_te_1',
            name: 'Jake Ferguson',
            jerseyNumber: 87,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Wisconsin',
          },
          {
            playerId: 'dal_te_2',
            name: 'Luke Schoonmaker',
            jerseyNumber: 86,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Michigan',
          },
        ],
        K: [
          {
            playerId: 'dal_k_1',
            name: 'Brandon Aubrey',
            jerseyNumber: 17,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Notre Dame',
          },
        ],
        DST: [
          {
            playerId: 'dal_dst_1',
            name: 'Dallas Cowboys Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    PHI: {
      teamId: 'PHI',
      teamName: 'Philadelphia Eagles',
      abbreviation: 'PHI',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'phi_qb_1',
            name: 'Jalen Hurts',
            jerseyNumber: 1,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Oklahoma',
          },
          {
            playerId: 'phi_qb_2',
            name: 'Kenny Pickett',
            jerseyNumber: 7,
            experience: 2,
            fantasyRelevance: 'MINIMAL',
            college: 'Pittsburgh',
          },
        ],
        RB: [
          {
            playerId: 'phi_rb_1',
            name: 'Saquon Barkley',
            jerseyNumber: 26,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Penn State',
          },
          {
            playerId: 'phi_rb_2',
            name: 'Kenneth Gainwell',
            jerseyNumber: 14,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Memphis',
          },
          {
            playerId: 'phi_rb_3',
            name: 'Will Shipley',
            jerseyNumber: 31,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Clemson',
          },
        ],
        WR: [
          {
            playerId: 'phi_wr_1',
            name: 'A.J. Brown',
            jerseyNumber: 11,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Ole Miss',
          },
          {
            playerId: 'phi_wr_2',
            name: 'DeVonta Smith',
            jerseyNumber: 6,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'phi_wr_3',
            name: 'Jahan Dotson',
            jerseyNumber: 1,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Penn State',
          },
        ],
        TE: [
          {
            playerId: 'phi_te_1',
            name: 'Dallas Goedert',
            jerseyNumber: 88,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'South Dakota State',
          },
          {
            playerId: 'phi_te_2',
            name: 'Grant Calcaterra',
            jerseyNumber: 87,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'SMU',
          },
        ],
        K: [
          {
            playerId: 'phi_k_1',
            name: 'Jake Elliott',
            jerseyNumber: 4,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Memphis',
          },
        ],
        DST: [
          {
            playerId: 'phi_dst_1',
            name: 'Philadelphia Eagles Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    NYG: {
      teamId: 'NYG',
      teamName: 'New York Giants',
      abbreviation: 'NYG',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'nyg_qb_1',
            name: 'Daniel Jones',
            jerseyNumber: 8,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Duke',
          },
          {
            playerId: 'nyg_qb_2',
            name: 'Drew Lock',
            jerseyNumber: 2,
            experience: 5,
            fantasyRelevance: 'MINIMAL',
            college: 'Missouri',
          },
        ],
        RB: [
          {
            playerId: 'nyg_rb_1',
            name: 'Tyrone Tracy Jr.',
            jerseyNumber: 29,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Purdue',
          },
          {
            playerId: 'nyg_rb_2',
            name: 'Devin Singletary',
            jerseyNumber: 26,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'FAU',
          },
          {
            playerId: 'nyg_rb_3',
            name: 'Eric Gray',
            jerseyNumber: 20,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Oklahoma',
          },
        ],
        WR: [
          {
            playerId: 'nyg_wr_1',
            name: 'Malik Nabers',
            jerseyNumber: 1,
            experience: 0,
            fantasyRelevance: 'HIGH',
            college: 'LSU',
          },
          {
            playerId: 'nyg_wr_2',
            name: 'Darius Slayton',
            jerseyNumber: 86,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Auburn',
          },
          {
            playerId: 'nyg_wr_3',
            name: "Wan'Dale Robinson",
            jerseyNumber: 17,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Kentucky',
          },
        ],
        TE: [
          {
            playerId: 'nyg_te_1',
            name: 'Daniel Bellinger',
            jerseyNumber: 82,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'San Diego State',
          },
          {
            playerId: 'nyg_te_2',
            name: 'Theo Johnson',
            jerseyNumber: 85,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Penn State',
          },
        ],
        K: [
          {
            playerId: 'nyg_k_1',
            name: 'Graham Gano',
            jerseyNumber: 5,
            experience: 13,
            fantasyRelevance: 'MEDIUM',
            college: 'Florida State',
          },
        ],
        DST: [
          {
            playerId: 'nyg_dst_1',
            name: 'New York Giants Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    WAS: {
      teamId: 'WAS',
      teamName: 'Washington Commanders',
      abbreviation: 'WAS',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'was_qb_1',
            name: 'Jayden Daniels',
            jerseyNumber: 5,
            experience: 0,
            fantasyRelevance: 'HIGH',
            college: 'LSU',
          },
          {
            playerId: 'was_qb_2',
            name: 'Marcus Mariota',
            jerseyNumber: 18,
            experience: 9,
            fantasyRelevance: 'MINIMAL',
            college: 'Oregon',
          },
        ],
        RB: [
          {
            playerId: 'was_rb_1',
            name: 'Brian Robinson Jr.',
            jerseyNumber: 8,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Alabama',
          },
          {
            playerId: 'was_rb_2',
            name: 'Austin Ekeler',
            jerseyNumber: 30,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Western Colorado',
          },
          {
            playerId: 'was_rb_3',
            name: 'Jeremy McNichols',
            jerseyNumber: 22,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Boise State',
          },
        ],
        WR: [
          {
            playerId: 'was_wr_1',
            name: 'Terry McLaurin',
            jerseyNumber: 17,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Ohio State',
          },
          {
            playerId: 'was_wr_2',
            name: 'Noah Brown',
            jerseyNumber: 85,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Ohio State',
          },
          {
            playerId: 'was_wr_3',
            name: 'Olamide Zaccheaus',
            jerseyNumber: 14,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'Virginia',
          },
        ],
        TE: [
          {
            playerId: 'was_te_1',
            name: 'Zach Ertz',
            jerseyNumber: 86,
            experience: 11,
            fantasyRelevance: 'MEDIUM',
            college: 'Stanford',
          },
          {
            playerId: 'was_te_2',
            name: 'Ben Skowronek',
            jerseyNumber: 19,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Northwestern',
          },
        ],
        K: [
          {
            playerId: 'was_k_1',
            name: 'Austin Seibert',
            jerseyNumber: 3,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Oklahoma',
          },
        ],
        DST: [
          {
            playerId: 'was_dst_1',
            name: 'Washington Commanders Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    MIN: {
      teamId: 'MIN',
      teamName: 'Minnesota Vikings',
      abbreviation: 'MIN',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'min_qb_1',
            name: 'Sam Darnold',
            jerseyNumber: 14,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'USC',
          },
          {
            playerId: 'min_qb_2',
            name: 'J.J. McCarthy',
            jerseyNumber: 9,
            experience: 0,
            fantasyRelevance: 'MINIMAL',
            college: 'Michigan',
          },
        ],
        RB: [
          {
            playerId: 'min_rb_1',
            name: 'Aaron Jones',
            jerseyNumber: 33,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'UTEP',
          },
          {
            playerId: 'min_rb_2',
            name: 'Cam Akers',
            jerseyNumber: 3,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Florida State',
          },
          {
            playerId: 'min_rb_3',
            name: 'Ty Chandler',
            jerseyNumber: 32,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'North Carolina',
          },
        ],
        WR: [
          {
            playerId: 'min_wr_1',
            name: 'Justin Jefferson',
            jerseyNumber: 18,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'LSU',
          },
          {
            playerId: 'min_wr_2',
            name: 'Jordan Addison',
            jerseyNumber: 3,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'USC',
          },
          {
            playerId: 'min_wr_3',
            name: 'Jalen Nailor',
            jerseyNumber: 83,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'Michigan State',
          },
        ],
        TE: [
          {
            playerId: 'min_te_1',
            name: 'T.J. Hockenson',
            jerseyNumber: 87,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Iowa',
          },
          {
            playerId: 'min_te_2',
            name: 'Johnny Mundt',
            jerseyNumber: 82,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Oregon',
          },
        ],
        K: [
          {
            playerId: 'min_k_1',
            name: 'Will Reichard',
            jerseyNumber: 16,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Alabama',
          },
        ],
        DST: [
          {
            playerId: 'min_dst_1',
            name: 'Minnesota Vikings Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    GB: {
      teamId: 'GB',
      teamName: 'Green Bay Packers',
      abbreviation: 'GB',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'gb_qb_1',
            name: 'Jordan Love',
            jerseyNumber: 10,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Utah State',
          },
          {
            playerId: 'gb_qb_2',
            name: 'Malik Willis',
            jerseyNumber: 7,
            experience: 2,
            fantasyRelevance: 'MINIMAL',
            college: 'Liberty',
          },
        ],
        RB: [
          {
            playerId: 'gb_rb_1',
            name: 'Josh Jacobs',
            jerseyNumber: 8,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'gb_rb_2',
            name: 'Emanuel Wilson',
            jerseyNumber: 31,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Fort Hays State',
          },
          {
            playerId: 'gb_rb_3',
            name: 'MarShawn Lloyd',
            jerseyNumber: 38,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'USC',
          },
        ],
        WR: [
          {
            playerId: 'gb_wr_1',
            name: 'Jayden Reed',
            jerseyNumber: 11,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Michigan State',
          },
          {
            playerId: 'gb_wr_2',
            name: 'Christian Watson',
            jerseyNumber: 9,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'North Dakota State',
          },
          {
            playerId: 'gb_wr_3',
            name: 'Romeo Doubs',
            jerseyNumber: 87,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Nevada',
          },
        ],
        TE: [
          {
            playerId: 'gb_te_1',
            name: 'Tucker Kraft',
            jerseyNumber: 85,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'South Dakota State',
          },
          {
            playerId: 'gb_te_2',
            name: 'Luke Musgrave',
            jerseyNumber: 88,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Oregon State',
          },
        ],
        K: [
          {
            playerId: 'gb_k_1',
            name: 'Brandon McManus',
            jerseyNumber: 8,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'Temple',
          },
        ],
        DST: [
          {
            playerId: 'gb_dst_1',
            name: 'Green Bay Packers Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    CHI: {
      teamId: 'CHI',
      teamName: 'Chicago Bears',
      abbreviation: 'CHI',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'chi_qb_1',
            name: 'Caleb Williams',
            jerseyNumber: 18,
            experience: 0,
            fantasyRelevance: 'HIGH',
            college: 'USC',
          },
          {
            playerId: 'chi_qb_2',
            name: 'Tyson Bagent',
            jerseyNumber: 17,
            experience: 1,
            fantasyRelevance: 'MINIMAL',
            college: 'Shepherd',
          },
        ],
        RB: [
          {
            playerId: 'chi_rb_1',
            name: "D'Andre Swift",
            jerseyNumber: 4,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Georgia',
          },
          {
            playerId: 'chi_rb_2',
            name: 'Roschon Johnson',
            jerseyNumber: 23,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Texas',
          },
          {
            playerId: 'chi_rb_3',
            name: 'Travis Homer',
            jerseyNumber: 25,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'Miami',
          },
        ],
        WR: [
          {
            playerId: 'chi_wr_1',
            name: 'DJ Moore',
            jerseyNumber: 2,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Maryland',
          },
          {
            playerId: 'chi_wr_2',
            name: 'Keenan Allen',
            jerseyNumber: 13,
            experience: 11,
            fantasyRelevance: 'HIGH',
            college: 'California',
          },
          {
            playerId: 'chi_wr_3',
            name: 'Rome Odunze',
            jerseyNumber: 1,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Washington',
          },
        ],
        TE: [
          {
            playerId: 'chi_te_1',
            name: 'Cole Kmet',
            jerseyNumber: 85,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Notre Dame',
          },
          {
            playerId: 'chi_te_2',
            name: 'Gerald Everett',
            jerseyNumber: 7,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'South Alabama',
          },
        ],
        K: [
          {
            playerId: 'chi_k_1',
            name: 'Cairo Santos',
            jerseyNumber: 2,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'Tulane',
          },
        ],
        DST: [
          {
            playerId: 'chi_dst_1',
            name: 'Chicago Bears Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    CLE: {
      teamId: 'CLE',
      teamName: 'Cleveland Browns',
      abbreviation: 'CLE',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'cle_qb_1',
            name: 'Deshaun Watson',
            jerseyNumber: 4,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Clemson',
          },
          {
            playerId: 'cle_qb_2',
            name: 'Jameis Winston',
            jerseyNumber: 5,
            experience: 9,
            fantasyRelevance: 'MINIMAL',
            college: 'Florida State',
          },
        ],
        RB: [
          {
            playerId: 'cle_rb_1',
            name: 'Nick Chubb',
            jerseyNumber: 24,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'Georgia',
          },
          {
            playerId: 'cle_rb_2',
            name: 'Jerome Ford',
            jerseyNumber: 34,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Cincinnati',
          },
          {
            playerId: 'cle_rb_3',
            name: "D'Onta Foreman",
            jerseyNumber: 27,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Texas',
          },
        ],
        WR: [
          {
            playerId: 'cle_wr_1',
            name: 'Amari Cooper',
            jerseyNumber: 2,
            experience: 9,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'cle_wr_2',
            name: 'Jerry Jeudy',
            jerseyNumber: 3,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'cle_wr_3',
            name: 'Elijah Moore',
            jerseyNumber: 8,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Ole Miss',
          },
          {
            playerId: 'cle_wr_4',
            name: 'Cedric Tillman',
            jerseyNumber: 19,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Tennessee',
          },
        ],
        TE: [
          {
            playerId: 'cle_te_1',
            name: 'David Njoku',
            jerseyNumber: 85,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Miami',
          },
          {
            playerId: 'cle_te_2',
            name: 'Jordan Akins',
            jerseyNumber: 88,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'UCF',
          },
        ],
        K: [
          {
            playerId: 'cle_k_1',
            name: 'Dustin Hopkins',
            jerseyNumber: 7,
            experience: 11,
            fantasyRelevance: 'MEDIUM',
            college: 'Florida State',
          },
        ],
        DST: [
          {
            playerId: 'cle_dst_1',
            name: 'Cleveland Browns Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    PIT: {
      teamId: 'PIT',
      teamName: 'Pittsburgh Steelers',
      abbreviation: 'PIT',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'pit_qb_1',
            name: 'Russell Wilson',
            jerseyNumber: 3,
            experience: 12,
            fantasyRelevance: 'HIGH',
            college: 'Wisconsin',
          },
          {
            playerId: 'pit_qb_2',
            name: 'Justin Fields',
            jerseyNumber: 2,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Ohio State',
          },
        ],
        RB: [
          {
            playerId: 'pit_rb_1',
            name: 'Najee Harris',
            jerseyNumber: 22,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'pit_rb_2',
            name: 'Jaylen Warren',
            jerseyNumber: 30,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Oklahoma State',
          },
          {
            playerId: 'pit_rb_3',
            name: 'Cordarrelle Patterson',
            jerseyNumber: 84,
            experience: 11,
            fantasyRelevance: 'LOW',
            college: 'Tennessee',
          },
        ],
        WR: [
          {
            playerId: 'pit_wr_1',
            name: 'George Pickens',
            jerseyNumber: 14,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Georgia',
          },
          {
            playerId: 'pit_wr_2',
            name: 'Calvin Austin III',
            jerseyNumber: 19,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Memphis',
          },
          {
            playerId: 'pit_wr_3',
            name: 'Van Jefferson',
            jerseyNumber: 12,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Florida',
          },
        ],
        TE: [
          {
            playerId: 'pit_te_1',
            name: 'Pat Freiermuth',
            jerseyNumber: 88,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Penn State',
          },
          {
            playerId: 'pit_te_2',
            name: 'Darnell Washington',
            jerseyNumber: 80,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Georgia',
          },
        ],
        K: [
          {
            playerId: 'pit_k_1',
            name: 'Chris Boswell',
            jerseyNumber: 9,
            experience: 9,
            fantasyRelevance: 'HIGH',
            college: 'Rice',
          },
        ],
        DST: [
          {
            playerId: 'pit_dst_1',
            name: 'Pittsburgh Steelers Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'HIGH',
          },
        ],
      },
    },
    CIN: {
      teamId: 'CIN',
      teamName: 'Cincinnati Bengals',
      abbreviation: 'CIN',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'cin_qb_1',
            name: 'Joe Burrow',
            jerseyNumber: 9,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'LSU',
          },
          {
            playerId: 'cin_qb_2',
            name: 'Jake Browning',
            jerseyNumber: 6,
            experience: 2,
            fantasyRelevance: 'MINIMAL',
            college: 'Washington',
          },
        ],
        RB: [
          {
            playerId: 'cin_rb_1',
            name: 'Chase Brown',
            jerseyNumber: 30,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Illinois',
          },
          {
            playerId: 'cin_rb_2',
            name: 'Zack Moss',
            jerseyNumber: 22,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Utah',
          },
          {
            playerId: 'cin_rb_3',
            name: 'Trayveon Williams',
            jerseyNumber: 40,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'Texas A&M',
          },
        ],
        WR: [
          {
            playerId: 'cin_wr_1',
            name: "Ja'Marr Chase",
            jerseyNumber: 1,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'LSU',
          },
          {
            playerId: 'cin_wr_2',
            name: 'Tee Higgins',
            jerseyNumber: 85,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Clemson',
          },
          {
            playerId: 'cin_wr_3',
            name: 'Andrei Iosivas',
            jerseyNumber: 80,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Princeton',
          },
        ],
        TE: [
          {
            playerId: 'cin_te_1',
            name: 'Mike Gesicki',
            jerseyNumber: 88,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Penn State',
          },
          {
            playerId: 'cin_te_2',
            name: 'Erick All Jr.',
            jerseyNumber: 83,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Iowa',
          },
        ],
        K: [
          {
            playerId: 'cin_k_1',
            name: 'Evan McPherson',
            jerseyNumber: 2,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Florida',
          },
        ],
        DST: [
          {
            playerId: 'cin_dst_1',
            name: 'Cincinnati Bengals Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    HOU: {
      teamId: 'HOU',
      teamName: 'Houston Texans',
      abbreviation: 'HOU',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'hou_qb_1',
            name: 'C.J. Stroud',
            jerseyNumber: 7,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Ohio State',
          },
          {
            playerId: 'hou_qb_2',
            name: 'Davis Mills',
            jerseyNumber: 10,
            experience: 3,
            fantasyRelevance: 'MINIMAL',
            college: 'Stanford',
          },
        ],
        RB: [
          {
            playerId: 'hou_rb_1',
            name: 'Joe Mixon',
            jerseyNumber: 28,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Oklahoma',
          },
          {
            playerId: 'hou_rb_2',
            name: 'Cam Akers',
            jerseyNumber: 33,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Florida State',
          },
          {
            playerId: 'hou_rb_3',
            name: 'Dare Ogunbowale',
            jerseyNumber: 20,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Wisconsin',
          },
        ],
        WR: [
          {
            playerId: 'hou_wr_1',
            name: 'Nico Collins',
            jerseyNumber: 12,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Michigan',
          },
          {
            playerId: 'hou_wr_2',
            name: 'Stefon Diggs',
            jerseyNumber: 1,
            experience: 9,
            fantasyRelevance: 'HIGH',
            college: 'Maryland',
          },
          {
            playerId: 'hou_wr_3',
            name: 'Tank Dell',
            jerseyNumber: 3,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Houston',
          },
        ],
        TE: [
          {
            playerId: 'hou_te_1',
            name: 'Dalton Schultz',
            jerseyNumber: 86,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Stanford',
          },
          {
            playerId: 'hou_te_2',
            name: 'Cade Stover',
            jerseyNumber: 88,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Ohio State',
          },
        ],
        K: [
          {
            playerId: 'hou_k_1',
            name: "Ka'imi Fairbairn",
            jerseyNumber: 15,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'UCLA',
          },
        ],
        DST: [
          {
            playerId: 'hou_dst_1',
            name: 'Houston Texans Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    IND: {
      teamId: 'IND',
      teamName: 'Indianapolis Colts',
      abbreviation: 'IND',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'ind_qb_1',
            name: 'Anthony Richardson',
            jerseyNumber: 5,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Florida',
          },
          {
            playerId: 'ind_qb_2',
            name: 'Joe Flacco',
            jerseyNumber: 15,
            experience: 16,
            fantasyRelevance: 'MINIMAL',
            college: 'Delaware',
          },
        ],
        RB: [
          {
            playerId: 'ind_rb_1',
            name: 'Jonathan Taylor',
            jerseyNumber: 28,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Wisconsin',
          },
          {
            playerId: 'ind_rb_2',
            name: 'Trey Sermon',
            jerseyNumber: 33,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Ohio State',
          },
          {
            playerId: 'ind_rb_3',
            name: 'Tyler Goodson',
            jerseyNumber: 31,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'Iowa',
          },
        ],
        WR: [
          {
            playerId: 'ind_wr_1',
            name: 'Michael Pittman Jr.',
            jerseyNumber: 11,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'USC',
          },
          {
            playerId: 'ind_wr_2',
            name: 'Josh Downs',
            jerseyNumber: 80,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'North Carolina',
          },
          {
            playerId: 'ind_wr_3',
            name: 'Adonai Mitchell',
            jerseyNumber: 10,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Texas',
          },
        ],
        TE: [
          {
            playerId: 'ind_te_1',
            name: 'Mo Alie-Cox',
            jerseyNumber: 81,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'VCU',
          },
          {
            playerId: 'ind_te_2',
            name: 'Kylen Granson',
            jerseyNumber: 83,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'SMU',
          },
        ],
        K: [
          {
            playerId: 'ind_k_1',
            name: 'Matt Gay',
            jerseyNumber: 6,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Utah',
          },
        ],
        DST: [
          {
            playerId: 'ind_dst_1',
            name: 'Indianapolis Colts Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    JAX: {
      teamId: 'JAX',
      teamName: 'Jacksonville Jaguars',
      abbreviation: 'JAX',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'jax_qb_1',
            name: 'Trevor Lawrence',
            jerseyNumber: 16,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Clemson',
          },
          {
            playerId: 'jax_qb_2',
            name: 'Mac Jones',
            jerseyNumber: 10,
            experience: 3,
            fantasyRelevance: 'MINIMAL',
            college: 'Alabama',
          },
        ],
        RB: [
          {
            playerId: 'jax_rb_1',
            name: 'Travis Etienne Jr.',
            jerseyNumber: 1,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Clemson',
          },
          {
            playerId: 'jax_rb_2',
            name: 'Tank Bigsby',
            jerseyNumber: 4,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Auburn',
          },
          {
            playerId: 'jax_rb_3',
            name: "D'Ernest Johnson",
            jerseyNumber: 30,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'South Florida',
          },
        ],
        WR: [
          {
            playerId: 'jax_wr_1',
            name: 'Brian Thomas Jr.',
            jerseyNumber: 7,
            experience: 0,
            fantasyRelevance: 'HIGH',
            college: 'LSU',
          },
          {
            playerId: 'jax_wr_2',
            name: 'Christian Kirk',
            jerseyNumber: 13,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Texas A&M',
          },
          {
            playerId: 'jax_wr_3',
            name: 'Gabe Davis',
            jerseyNumber: 84,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'UCF',
          },
        ],
        TE: [
          {
            playerId: 'jax_te_1',
            name: 'Evan Engram',
            jerseyNumber: 17,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Ole Miss',
          },
          {
            playerId: 'jax_te_2',
            name: 'Brenton Strange',
            jerseyNumber: 19,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Penn State',
          },
        ],
        K: [
          {
            playerId: 'jax_k_1',
            name: 'Cam Little',
            jerseyNumber: 9,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Arkansas',
          },
        ],
        DST: [
          {
            playerId: 'jax_dst_1',
            name: 'Jacksonville Jaguars Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    TEN: {
      teamId: 'TEN',
      teamName: 'Tennessee Titans',
      abbreviation: 'TEN',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'ten_qb_1',
            name: 'Will Levis',
            jerseyNumber: 8,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Kentucky',
          },
          {
            playerId: 'ten_qb_2',
            name: 'Mason Rudolph',
            jerseyNumber: 11,
            experience: 6,
            fantasyRelevance: 'MINIMAL',
            college: 'Oklahoma State',
          },
        ],
        RB: [
          {
            playerId: 'ten_rb_1',
            name: 'Tony Pollard',
            jerseyNumber: 1,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Memphis',
          },
          {
            playerId: 'ten_rb_2',
            name: 'Tyjae Spears',
            jerseyNumber: 2,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Tulane',
          },
          {
            playerId: 'ten_rb_3',
            name: 'Julius Chestnut',
            jerseyNumber: 40,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Sacred Heart',
          },
        ],
        WR: [
          {
            playerId: 'ten_wr_1',
            name: 'DeAndre Hopkins',
            jerseyNumber: 10,
            experience: 11,
            fantasyRelevance: 'MEDIUM',
            college: 'Clemson',
          },
          {
            playerId: 'ten_wr_2',
            name: 'Calvin Ridley',
            jerseyNumber: 0,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Alabama',
          },
          {
            playerId: 'ten_wr_3',
            name: 'Tyler Boyd',
            jerseyNumber: 83,
            experience: 8,
            fantasyRelevance: 'LOW',
            college: 'Pittsburgh',
          },
        ],
        TE: [
          {
            playerId: 'ten_te_1',
            name: 'Chigoziem Okonkwo',
            jerseyNumber: 85,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'Maryland',
          },
          {
            playerId: 'ten_te_2',
            name: 'Nick Vannett',
            jerseyNumber: 81,
            experience: 8,
            fantasyRelevance: 'LOW',
            college: 'Ohio State',
          },
        ],
        K: [
          {
            playerId: 'ten_k_1',
            name: 'Nick Folk',
            jerseyNumber: 4,
            experience: 19,
            fantasyRelevance: 'MEDIUM',
            college: 'Arizona',
          },
        ],
        DST: [
          {
            playerId: 'ten_dst_1',
            name: 'Tennessee Titans Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    CAR: {
      teamId: 'CAR',
      teamName: 'Carolina Panthers',
      abbreviation: 'CAR',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'car_qb_1',
            name: 'Bryce Young',
            jerseyNumber: 9,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Alabama',
          },
          {
            playerId: 'car_qb_2',
            name: 'Andy Dalton',
            jerseyNumber: 14,
            experience: 14,
            fantasyRelevance: 'MINIMAL',
            college: 'TCU',
          },
        ],
        RB: [
          {
            playerId: 'car_rb_1',
            name: 'Chuba Hubbard',
            jerseyNumber: 30,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Oklahoma State',
          },
          {
            playerId: 'car_rb_2',
            name: 'Miles Sanders',
            jerseyNumber: 6,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Penn State',
          },
          {
            playerId: 'car_rb_3',
            name: 'Raheem Blackshear',
            jerseyNumber: 22,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'Virginia Tech',
          },
        ],
        WR: [
          {
            playerId: 'car_wr_1',
            name: 'Diontae Johnson',
            jerseyNumber: 5,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Toledo',
          },
          {
            playerId: 'car_wr_2',
            name: 'Adam Thielen',
            jerseyNumber: 19,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'Minnesota State',
          },
          {
            playerId: 'car_wr_3',
            name: 'Xavier Legette',
            jerseyNumber: 17,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'South Carolina',
          },
        ],
        TE: [
          {
            playerId: 'car_te_1',
            name: 'Tommy Tremble',
            jerseyNumber: 82,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Notre Dame',
          },
          {
            playerId: 'car_te_2',
            name: 'Ian Thomas',
            jerseyNumber: 80,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'Indiana',
          },
        ],
        K: [
          {
            playerId: 'car_k_1',
            name: 'Eddy Pineiro',
            jerseyNumber: 4,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'Florida',
          },
        ],
        DST: [
          {
            playerId: 'car_dst_1',
            name: 'Carolina Panthers Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    DEN: {
      teamId: 'DEN',
      teamName: 'Denver Broncos',
      abbreviation: 'DEN',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'den_qb_1',
            name: 'Bo Nix',
            jerseyNumber: 10,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Oregon',
          },
          {
            playerId: 'den_qb_2',
            name: 'Jarrett Stidham',
            jerseyNumber: 4,
            experience: 5,
            fantasyRelevance: 'MINIMAL',
            college: 'Auburn',
          },
        ],
        RB: [
          {
            playerId: 'den_rb_1',
            name: 'Javonte Williams',
            jerseyNumber: 33,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'North Carolina',
          },
          {
            playerId: 'den_rb_2',
            name: 'Jaleel McLaughlin',
            jerseyNumber: 38,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Youngstown State',
          },
          {
            playerId: 'den_rb_3',
            name: 'Samaje Perine',
            jerseyNumber: 34,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Oklahoma',
          },
        ],
        WR: [
          {
            playerId: 'den_wr_1',
            name: 'Courtland Sutton',
            jerseyNumber: 14,
            experience: 6,
            fantasyRelevance: 'HIGH',
            college: 'SMU',
          },
          {
            playerId: 'den_wr_2',
            name: 'Marvin Mims Jr.',
            jerseyNumber: 19,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Oklahoma',
          },
          {
            playerId: 'den_wr_3',
            name: 'Josh Reynolds',
            jerseyNumber: 11,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Texas A&M',
          },
          {
            playerId: 'den_wr_4',
            name: 'Troy Franklin',
            jerseyNumber: 18,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Oregon',
          },
        ],
        TE: [
          {
            playerId: 'den_te_1',
            name: 'Adam Trautman',
            jerseyNumber: 82,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Dayton',
          },
          {
            playerId: 'den_te_2',
            name: 'Lucas Krull',
            jerseyNumber: 83,
            experience: 2,
            fantasyRelevance: 'LOW',
            college: 'Florida',
          },
        ],
        K: [
          {
            playerId: 'den_k_1',
            name: 'Wil Lutz',
            jerseyNumber: 5,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'Georgia State',
          },
        ],
        DST: [
          {
            playerId: 'den_dst_1',
            name: 'Denver Broncos Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    DET: {
      teamId: 'DET',
      teamName: 'Detroit Lions',
      abbreviation: 'DET',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'det_qb_1',
            name: 'Jared Goff',
            jerseyNumber: 16,
            experience: 8,
            fantasyRelevance: 'HIGH',
            college: 'California',
          },
          {
            playerId: 'det_qb_2',
            name: 'Hendon Hooker',
            jerseyNumber: 2,
            experience: 1,
            fantasyRelevance: 'MINIMAL',
            college: 'Tennessee',
          },
        ],
        RB: [
          {
            playerId: 'det_rb_1',
            name: 'Jahmyr Gibbs',
            jerseyNumber: 26,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'det_rb_2',
            name: 'David Montgomery',
            jerseyNumber: 5,
            experience: 5,
            fantasyRelevance: 'HIGH',
            college: 'Iowa State',
          },
          {
            playerId: 'det_rb_3',
            name: 'Craig Reynolds',
            jerseyNumber: 46,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Kutztown',
          },
        ],
        WR: [
          {
            playerId: 'det_wr_1',
            name: 'Amon-Ra St. Brown',
            jerseyNumber: 14,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'USC',
          },
          {
            playerId: 'det_wr_2',
            name: 'Jameson Williams',
            jerseyNumber: 9,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Alabama',
          },
          {
            playerId: 'det_wr_3',
            name: 'Kalif Raymond',
            jerseyNumber: 11,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'Holy Cross',
          },
          {
            playerId: 'det_wr_4',
            name: 'Tim Patrick',
            jerseyNumber: 17,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'Utah',
          },
        ],
        TE: [
          {
            playerId: 'det_te_1',
            name: 'Sam LaPorta',
            jerseyNumber: 87,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Iowa',
          },
          {
            playerId: 'det_te_2',
            name: 'Brock Wright',
            jerseyNumber: 89,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Notre Dame',
          },
        ],
        K: [
          {
            playerId: 'det_k_1',
            name: 'Jake Bates',
            jerseyNumber: 39,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Arkansas',
          },
        ],
        DST: [
          {
            playerId: 'det_dst_1',
            name: 'Detroit Lions Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    LAC: {
      teamId: 'LAC',
      teamName: 'Los Angeles Chargers',
      abbreviation: 'LAC',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'lac_qb_1',
            name: 'Justin Herbert',
            jerseyNumber: 10,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Oregon',
          },
          {
            playerId: 'lac_qb_2',
            name: 'Taylor Heinicke',
            jerseyNumber: 4,
            experience: 7,
            fantasyRelevance: 'MINIMAL',
            college: 'Old Dominion',
          },
        ],
        RB: [
          {
            playerId: 'lac_rb_1',
            name: 'J.K. Dobbins',
            jerseyNumber: 27,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Ohio State',
          },
          {
            playerId: 'lac_rb_2',
            name: 'Gus Edwards',
            jerseyNumber: 30,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Rutgers',
          },
          {
            playerId: 'lac_rb_3',
            name: 'Kimani Vidal',
            jerseyNumber: 28,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Troy',
          },
        ],
        WR: [
          {
            playerId: 'lac_wr_1',
            name: 'Ladd McConkey',
            jerseyNumber: 15,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'Georgia',
          },
          {
            playerId: 'lac_wr_2',
            name: 'Quentin Johnston',
            jerseyNumber: 1,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'TCU',
          },
          {
            playerId: 'lac_wr_3',
            name: 'Joshua Palmer',
            jerseyNumber: 5,
            experience: 3,
            fantasyRelevance: 'LOW',
            college: 'Tennessee',
          },
        ],
        TE: [
          {
            playerId: 'lac_te_1',
            name: 'Will Dissly',
            jerseyNumber: 81,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'Washington',
          },
          {
            playerId: 'lac_te_2',
            name: 'Hayden Hurst',
            jerseyNumber: 84,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'South Carolina',
          },
        ],
        K: [
          {
            playerId: 'lac_k_1',
            name: 'Cameron Dicker',
            jerseyNumber: 3,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Texas',
          },
        ],
        DST: [
          {
            playerId: 'lac_dst_1',
            name: 'Los Angeles Chargers Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    LV: {
      teamId: 'LV',
      teamName: 'Las Vegas Raiders',
      abbreviation: 'LV',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'lv_qb_1',
            name: 'Gardner Minshew',
            jerseyNumber: 15,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Washington State',
          },
          {
            playerId: 'lv_qb_2',
            name: "Aidan O'Connell",
            jerseyNumber: 12,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Purdue',
          },
        ],
        RB: [
          {
            playerId: 'lv_rb_1',
            name: 'Zamir White',
            jerseyNumber: 3,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Georgia',
          },
          {
            playerId: 'lv_rb_2',
            name: 'Alexander Mattison',
            jerseyNumber: 22,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'Boise State',
          },
          {
            playerId: 'lv_rb_3',
            name: 'Dylan Laube',
            jerseyNumber: 23,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'New Hampshire',
          },
        ],
        WR: [
          {
            playerId: 'lv_wr_1',
            name: 'Davante Adams',
            jerseyNumber: 17,
            experience: 10,
            fantasyRelevance: 'HIGH',
            college: 'Fresno State',
          },
          {
            playerId: 'lv_wr_2',
            name: 'Jakobi Meyers',
            jerseyNumber: 16,
            experience: 5,
            fantasyRelevance: 'MEDIUM',
            college: 'NC State',
          },
          {
            playerId: 'lv_wr_3',
            name: 'Tre Tucker',
            jerseyNumber: 11,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Cincinnati',
          },
        ],
        TE: [
          {
            playerId: 'lv_te_1',
            name: 'Brock Bowers',
            jerseyNumber: 89,
            experience: 0,
            fantasyRelevance: 'HIGH',
            college: 'Georgia',
          },
          {
            playerId: 'lv_te_2',
            name: 'Michael Mayer',
            jerseyNumber: 87,
            experience: 1,
            fantasyRelevance: 'LOW',
            college: 'Notre Dame',
          },
        ],
        K: [
          {
            playerId: 'lv_k_1',
            name: 'Daniel Carlson',
            jerseyNumber: 2,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'Auburn',
          },
        ],
        DST: [
          {
            playerId: 'lv_dst_1',
            name: 'Las Vegas Raiders Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    MIA: {
      teamId: 'MIA',
      teamName: 'Miami Dolphins',
      abbreviation: 'MIA',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'mia_qb_1',
            name: 'Tua Tagovailoa',
            jerseyNumber: 1,
            experience: 4,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'mia_qb_2',
            name: 'Tyler Huntley',
            jerseyNumber: 7,
            experience: 4,
            fantasyRelevance: 'MINIMAL',
            college: 'Utah',
          },
        ],
        RB: [
          {
            playerId: 'mia_rb_1',
            name: "De'Von Achane",
            jerseyNumber: 28,
            experience: 1,
            fantasyRelevance: 'HIGH',
            college: 'Texas A&M',
          },
          {
            playerId: 'mia_rb_2',
            name: 'Raheem Mostert',
            jerseyNumber: 31,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'Purdue',
          },
          {
            playerId: 'mia_rb_3',
            name: 'Jaylen Wright',
            jerseyNumber: 25,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Tennessee',
          },
        ],
        WR: [
          {
            playerId: 'mia_wr_1',
            name: 'Tyreek Hill',
            jerseyNumber: 10,
            experience: 8,
            fantasyRelevance: 'HIGH',
            college: 'West Alabama',
          },
          {
            playerId: 'mia_wr_2',
            name: 'Jaylen Waddle',
            jerseyNumber: 17,
            experience: 3,
            fantasyRelevance: 'HIGH',
            college: 'Alabama',
          },
          {
            playerId: 'mia_wr_3',
            name: 'Odell Beckham Jr.',
            jerseyNumber: 3,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'LSU',
          },
        ],
        TE: [
          {
            playerId: 'mia_te_1',
            name: 'Jonnu Smith',
            jerseyNumber: 81,
            experience: 7,
            fantasyRelevance: 'MEDIUM',
            college: 'Florida International',
          },
          {
            playerId: 'mia_te_2',
            name: 'Durham Smythe',
            jerseyNumber: 82,
            experience: 6,
            fantasyRelevance: 'LOW',
            college: 'Notre Dame',
          },
        ],
        K: [
          {
            playerId: 'mia_k_1',
            name: 'Jason Sanders',
            jerseyNumber: 7,
            experience: 6,
            fantasyRelevance: 'MEDIUM',
            college: 'New Mexico',
          },
        ],
        DST: [
          {
            playerId: 'mia_dst_1',
            name: 'Miami Dolphins Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
    NE: {
      teamId: 'NE',
      teamName: 'New England Patriots',
      abbreviation: 'NE',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'ne_qb_1',
            name: 'Drake Maye',
            jerseyNumber: 10,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
            college: 'North Carolina',
          },
          {
            playerId: 'ne_qb_2',
            name: 'Jacoby Brissett',
            jerseyNumber: 7,
            experience: 8,
            fantasyRelevance: 'MINIMAL',
            college: 'NC State',
          },
        ],
        RB: [
          {
            playerId: 'ne_rb_1',
            name: 'Rhamondre Stevenson',
            jerseyNumber: 38,
            experience: 3,
            fantasyRelevance: 'MEDIUM',
            college: 'Oklahoma',
          },
          {
            playerId: 'ne_rb_2',
            name: 'Antonio Gibson',
            jerseyNumber: 24,
            experience: 4,
            fantasyRelevance: 'MEDIUM',
            college: 'Memphis',
          },
          {
            playerId: 'ne_rb_3',
            name: 'JaMycal Hasty',
            jerseyNumber: 28,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Baylor',
          },
        ],
        WR: [
          {
            playerId: 'ne_wr_1',
            name: 'DeMario Douglas',
            jerseyNumber: 3,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Liberty',
          },
          {
            playerId: 'ne_wr_2',
            name: 'Kendrick Bourne',
            jerseyNumber: 84,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'Eastern Washington',
          },
          {
            playerId: 'ne_wr_3',
            name: "Ja'Lynn Polk",
            jerseyNumber: 8,
            experience: 0,
            fantasyRelevance: 'LOW',
            college: 'Washington',
          },
        ],
        TE: [
          {
            playerId: 'ne_te_1',
            name: 'Hunter Henry',
            jerseyNumber: 85,
            experience: 8,
            fantasyRelevance: 'MEDIUM',
            college: 'Arkansas',
          },
          {
            playerId: 'ne_te_2',
            name: 'Austin Hooper',
            jerseyNumber: 81,
            experience: 8,
            fantasyRelevance: 'LOW',
            college: 'Stanford',
          },
        ],
        K: [
          {
            playerId: 'ne_k_1',
            name: 'Joey Slye',
            jerseyNumber: 6,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'Virginia Tech',
          },
        ],
        DST: [
          {
            playerId: 'ne_dst_1',
            name: 'New England Patriots Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'LOW',
          },
        ],
      },
    },
    NO: {
      teamId: 'NO',
      teamName: 'New Orleans Saints',
      abbreviation: 'NO',
      lastUpdated: '2025-09-01',
      positions: {
        QB: [
          {
            playerId: 'no_qb_1',
            name: 'Derek Carr',
            jerseyNumber: 4,
            experience: 10,
            fantasyRelevance: 'MEDIUM',
            college: 'Fresno State',
          },
          {
            playerId: 'no_qb_2',
            name: 'Spencer Rattler',
            jerseyNumber: 18,
            experience: 0,
            fantasyRelevance: 'MINIMAL',
            college: 'South Carolina',
          },
        ],
        RB: [
          {
            playerId: 'no_rb_1',
            name: 'Alvin Kamara',
            jerseyNumber: 41,
            experience: 7,
            fantasyRelevance: 'HIGH',
            college: 'Tennessee',
          },
          {
            playerId: 'no_rb_2',
            name: 'Kendre Miller',
            jerseyNumber: 25,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'TCU',
          },
          {
            playerId: 'no_rb_3',
            name: 'Jamaal Williams',
            jerseyNumber: 30,
            experience: 7,
            fantasyRelevance: 'LOW',
            college: 'BYU',
          },
        ],
        WR: [
          {
            playerId: 'no_wr_1',
            name: 'Chris Olave',
            jerseyNumber: 12,
            experience: 2,
            fantasyRelevance: 'HIGH',
            college: 'Ohio State',
          },
          {
            playerId: 'no_wr_2',
            name: 'Rashid Shaheed',
            jerseyNumber: 89,
            experience: 2,
            fantasyRelevance: 'MEDIUM',
            college: 'Weber State',
          },
          {
            playerId: 'no_wr_3',
            name: 'Cedrick Wilson Jr.',
            jerseyNumber: 1,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'Boise State',
          },
        ],
        TE: [
          {
            playerId: 'no_te_1',
            name: 'Juwan Johnson',
            jerseyNumber: 83,
            experience: 4,
            fantasyRelevance: 'LOW',
            college: 'Oregon',
          },
          {
            playerId: 'no_te_2',
            name: 'Foster Moreau',
            jerseyNumber: 87,
            experience: 5,
            fantasyRelevance: 'LOW',
            college: 'LSU',
          },
        ],
        K: [
          {
            playerId: 'no_k_1',
            name: 'Blake Grupe',
            jerseyNumber: 19,
            experience: 1,
            fantasyRelevance: 'MEDIUM',
            college: 'Arkansas',
          },
        ],
        DST: [
          {
            playerId: 'no_dst_1',
            name: 'New Orleans Saints Defense',
            jerseyNumber: 0,
            experience: 0,
            fantasyRelevance: 'MEDIUM',
          },
        ],
      },
    },
  };

  /**
   * Get depth chart for a specific team
   */
  public getTeamDepthChart(teamAbbreviation: string): TeamDepthChart | null {
    return this.NFL_DEPTH_CHARTS[teamAbbreviation.toUpperCase()] || null;
  }

  /**
   * Get all depth charts
   */
  public getAllDepthCharts(): Record<string, TeamDepthChart> {
    return this.NFL_DEPTH_CHARTS;
  }

  /**
   * Get depth chart for a specific player by finding their team and position
   */
  public getPlayerDepthChart(
    playerName: string
  ): { team: string; position: string; depth: number; teammates: DepthChartPlayer[] } | null {
    for (const [teamAbbrev, team] of Object.entries(this.NFL_DEPTH_CHARTS)) {
      for (const [position, players] of Object.entries(team.positions)) {
        const playerIndex = players.findIndex((p) => {
          // Enhanced matching logic for name variations
          const fullName = p.name.toLowerCase();
          const searchName = playerName.toLowerCase();

          // Exact match
          if (fullName === searchName) return true;

          // Contains match (both directions)
          if (fullName.includes(searchName) || searchName.includes(fullName)) return true;

          // Handle abbreviated first names (e.g., "K. Williams" -> "Kyren Williams")
          if (searchName.includes('.')) {
            const [firstInitial, lastName] = searchName.split('. ');
            const fullNameWords = fullName.split(' ');
            if (fullNameWords.length >= 2) {
              const firstNameChar = fullNameWords[0][0];
              const lastNamePart = fullNameWords[fullNameWords.length - 1];
              if (firstInitial === firstNameChar && lastName === lastNamePart) {
                return true;
              }
            }
          }

          // Handle reverse: "Kyren Williams" should match "K. Williams"
          const fullNameWords = fullName.split(' ');
          if (fullNameWords.length >= 2) {
            const abbreviated = `${fullNameWords[0][0]}. ${fullNameWords[fullNameWords.length - 1]}`;
            if (abbreviated.toLowerCase() === searchName) return true;
          }

          return false;
        });

        if (playerIndex !== -1) {
          return {
            team: teamAbbrev,
            position,
            depth: playerIndex + 1,
            teammates: players,
          };
        }
      }
    }
    return null;
  }

  /**
   * Analyze depth chart situation for fantasy purposes
   */
  public analyzeDepthChart(teamAbbreviation: string, position: string): DepthChartAnalysis {
    const team = this.getTeamDepthChart(teamAbbreviation);
    if (!team || !team.positions[position as keyof typeof team.positions]) {
      return {
        competitionLevel: 'LOCKED',
        opportunityScore: 5,
        handcuffValue: 0,
        breakoutPotential: 0,
        riskFactors: ['Unknown team or position'],
        opportunities: [],
      };
    }

    const positionPlayers = team.positions[position as keyof typeof team.positions];
    const starter = positionPlayers[0];
    const backup = positionPlayers[1];

    const analysis: DepthChartAnalysis = {
      competitionLevel: this.determineCompetitionLevel(positionPlayers, position),
      opportunityScore: this.calculateOpportunityScore(starter, positionPlayers, position),
      handcuffValue: position === 'RB' ? this.calculateHandcuffValue(starter, backup) : 0,
      breakoutPotential: this.calculateBreakoutPotential(positionPlayers, position),
      riskFactors: this.identifyRiskFactors(starter, positionPlayers, position),
      opportunities: this.identifyOpportunities(positionPlayers, position),
    };

    return analysis;
  }

  /**
   * Get players by fantasy relevance
   */
  public getPlayersByFantasyRelevance(
    relevance: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL'
  ): DepthChartPlayer[] {
    const players: DepthChartPlayer[] = [];

    for (const team of Object.values(this.NFL_DEPTH_CHARTS)) {
      for (const positionPlayers of Object.values(team.positions)) {
        players.push(...positionPlayers.filter((p) => p.fantasyRelevance === relevance));
      }
    }

    return players;
  }

  /**
   * Find backup/handcuff players for RBs
   */
  public findHandcuffPlayers(starterName: string): DepthChartPlayer[] {
    const playerInfo = this.getPlayerDepthChart(starterName);
    if (!playerInfo || playerInfo.position !== 'RB' || playerInfo.depth !== 1) {
      return [];
    }

    // Return backup RBs from the same team
    return playerInfo.teammates.slice(1).filter((p) => p.fantasyRelevance !== 'MINIMAL');
  }

  /**
   * Get injury impact on depth chart
   */
  public getInjuryImpact(playerName: string): {
    impactedPlayers: DepthChartPlayer[];
    beneficiaries: DepthChartPlayer[];
    fantasyImplications: string[];
  } {
    const playerInfo = this.getPlayerDepthChart(playerName);
    if (!playerInfo) {
      return { impactedPlayers: [], beneficiaries: [], fantasyImplications: [] };
    }

    const teammates = playerInfo.teammates;
    const playerDepth = playerInfo.depth;

    return {
      impactedPlayers: [teammates[playerDepth - 1]], // The injured player
      beneficiaries: teammates.slice(playerDepth), // Players who move up
      fantasyImplications: this.generateInjuryImplications(playerInfo),
    };
  }

  // Private helper methods
  private determineCompetitionLevel(
    players: DepthChartPlayer[],
    position: string
  ): 'LOCKED' | 'MINOR_COMPETITION' | 'TIMESHARE' | 'COMMITTEE' {
    if (players.length <= 1) return 'LOCKED';

    const starter = players[0];
    const backup = players[1];

    // Consider experience and fantasy relevance
    if (starter.fantasyRelevance === 'HIGH' && backup.fantasyRelevance === 'LOW') {
      return 'LOCKED';
    }

    if (
      position === 'RB' &&
      players.filter((p) => p.fantasyRelevance === 'HIGH' || p.fantasyRelevance === 'MEDIUM')
        .length >= 2
    ) {
      return 'COMMITTEE';
    }

    if (backup.fantasyRelevance === 'MEDIUM' || backup.fantasyRelevance === 'HIGH') {
      return 'TIMESHARE';
    }

    return 'MINOR_COMPETITION';
  }

  private calculateOpportunityScore(
    starter: DepthChartPlayer,
    allPlayers: DepthChartPlayer[],
    position: string
  ): number {
    let score = 7; // Base score

    // Adjust based on fantasy relevance
    if (starter.fantasyRelevance === 'HIGH') score += 2;
    if (starter.fantasyRelevance === 'MEDIUM') score += 1;
    if (starter.fantasyRelevance === 'LOW') score -= 1;

    // Adjust based on competition
    const competingPlayers = allPlayers.filter(
      (p) => p.fantasyRelevance === 'HIGH' || p.fantasyRelevance === 'MEDIUM'
    ).length;
    if (competingPlayers > 2) score -= 2;
    if (competingPlayers === 1) score += 1;

    // Position-specific adjustments
    if (position === 'TE' && starter.fantasyRelevance === 'HIGH') score += 1;
    if (position === 'K') score = 6; // Kickers have consistent but limited upside

    return Math.max(1, Math.min(10, score));
  }

  private calculateHandcuffValue(starter: DepthChartPlayer, backup?: DepthChartPlayer): number {
    if (!backup || starter.fantasyRelevance !== 'HIGH') return 0;

    let value = 5; // Base handcuff value

    // Higher value for better backups
    if (backup.fantasyRelevance === 'MEDIUM') value += 2;
    if (backup.fantasyRelevance === 'HIGH') value += 3;

    // Experience matters
    if (backup.experience >= 2) value += 1;
    if (backup.experience >= 4) value += 1;

    return Math.max(0, Math.min(10, value));
  }

  private calculateBreakoutPotential(players: DepthChartPlayer[], position: string): number {
    const rookiesAndSophomores = players.filter(
      (p) => p.experience <= 1 && p.fantasyRelevance !== 'MINIMAL'
    );

    if (rookiesAndSophomores.length === 0) return 2;

    let potential = 6;
    rookiesAndSophomores.forEach((player) => {
      if (player.fantasyRelevance === 'HIGH') potential += 2;
      if (player.fantasyRelevance === 'MEDIUM') potential += 1;
      if (player.experience === 0) potential += 1; // Rookie bonus
    });

    return Math.max(1, Math.min(10, potential));
  }

  private identifyRiskFactors(
    starter: DepthChartPlayer,
    allPlayers: DepthChartPlayer[],
    position: string
  ): string[] {
    const risks: string[] = [];

    if (starter.experience >= 8) risks.push('Veteran age concerns');
    if (starter.injuryStatus && starter.injuryStatus !== 'HEALTHY')
      risks.push(`Current injury: ${starter.injuryStatus}`);

    const strongBackup = allPlayers.find((p) => p !== starter && p.fantasyRelevance === 'HIGH');
    if (strongBackup) risks.push('Strong backup threatens touches');

    if (
      position === 'RB' &&
      allPlayers.filter((p) => p.fantasyRelevance !== 'MINIMAL').length >= 3
    ) {
      risks.push('Committee backfield reduces individual upside');
    }

    return risks;
  }

  private identifyOpportunities(players: DepthChartPlayer[], position: string): string[] {
    const opportunities: string[] = [];

    const youngTalent = players.filter((p) => p.experience <= 2 && p.fantasyRelevance === 'MEDIUM');
    if (youngTalent.length > 0) {
      opportunities.push('Young talent could emerge');
    }

    const veteranStarter = players[0];
    if (veteranStarter.experience >= 7 && players[1]?.experience <= 2) {
      opportunities.push('Potential changing of the guard');
    }

    if (position === 'WR' && players.filter((p) => p.fantasyRelevance === 'HIGH').length >= 2) {
      opportunities.push('Multiple fantasy-relevant targets');
    }

    return opportunities;
  }

  private generateInjuryImplications(playerInfo: {
    team: string;
    position: string;
    depth: number;
    teammates: DepthChartPlayer[];
  }): string[] {
    const implications: string[] = [];
    const { position, depth, teammates } = playerInfo;

    if (depth === 1) {
      // Starter injury
      const backup = teammates[1];
      if (backup) {
        implications.push(
          `${backup.name} becomes immediate starter with ${backup.fantasyRelevance.toLowerCase()} fantasy relevance`
        );

        if (position === 'RB' && backup.fantasyRelevance === 'MEDIUM') {
          implications.push('Significant uptick in RB2/Flex value expected');
        }

        if (position === 'WR' && backup.fantasyRelevance === 'HIGH') {
          implications.push('Should maintain WR2/WR3 production in expanded role');
        }
      }
    } else {
      // Backup injury
      implications.push('Depth chart thins but minimal immediate fantasy impact');
      if (teammates[depth]) {
        implications.push(`${teammates[depth].name} moves up depth chart`);
      }
    }

    return implications;
  }
}

export const realDepthChartService = new RealDepthChartService();
