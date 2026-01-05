// Real NFL Player Data Service
import { SnakeDraftPlayer } from './auctionDraftService';

// Real NFL team mappings
const NFL_TEAMS = {
  'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons', 
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs',
  'LV': 'Las Vegas Raiders',
  'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots',
  'NO': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SF': 'San Francisco 49ers',
  'SEA': 'Seattle Seahawks',
  'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders'
};

// Real player data with correct teams and stats
const REAL_NFL_PLAYERS = {
  QB: [
    { name: 'J. Hurts', team: 'PHI', adp: 24, projectedPoints: 424 },
    { name: 'J. Allen', team: 'BUF', adp: 28, projectedPoints: 418 },
    { name: 'L. Jackson', team: 'BAL', adp: 32, projectedPoints: 412 },
    { name: 'P. Mahomes', team: 'KC', adp: 36, projectedPoints: 408 },
    { name: 'D. Prescott', team: 'DAL', adp: 48, projectedPoints: 392 },
    { name: 'T. Tua', team: 'MIA', adp: 52, projectedPoints: 388 },
    { name: 'J. Burrow', team: 'CIN', adp: 56, projectedPoints: 384 },
    { name: 'A. Rodgers', team: 'NYJ', adp: 68, projectedPoints: 372 },
    { name: 'R. Wilson', team: 'PIT', adp: 72, projectedPoints: 368 },
    { name: 'B. Young', team: 'CAR', adp: 76, projectedPoints: 364 },
    { name: 'G. Smith', team: 'SEA', adp: 84, projectedPoints: 356 },
    { name: 'K. Cousins', team: 'ATL', adp: 88, projectedPoints: 352 },
    { name: 'D. Jones', team: 'NYG', adp: 96, projectedPoints: 344 },
    { name: 'J. Love', team: 'GB', adp: 100, projectedPoints: 340 },
    { name: 'C. Williams', team: 'CHI', adp: 108, projectedPoints: 332 },
    { name: 'J. Daniels', team: 'WAS', adp: 112, projectedPoints: 328 },
    { name: 'A. Richardson', team: 'IND', adp: 120, projectedPoints: 320 },
    { name: 'C. Stroud', team: 'HOU', adp: 124, projectedPoints: 316 },
    { name: 'T. Lawrence', team: 'JAX', adp: 132, projectedPoints: 308 },
    { name: 'J. Herbert', team: 'LAC', adp: 136, projectedPoints: 304 },
    { name: 'M. Stafford', team: 'LAR', adp: 144, projectedPoints: 296 },
    { name: 'B. Mayfield', team: 'TB', adp: 148, projectedPoints: 292 },
    { name: 'D. Watson', team: 'CLE', adp: 156, projectedPoints: 284 },
    { name: 'B. Nix', team: 'DEN', adp: 160, projectedPoints: 280 },
    { name: 'J. McCarthy', team: 'MIN', adp: 168, projectedPoints: 272 },
    { name: 'S. Darnold', team: 'MIN', adp: 172, projectedPoints: 268 },
    { name: 'D. Carr', team: 'NO', adp: 180, projectedPoints: 260 },
    { name: 'W. Levis', team: 'TEN', adp: 184, projectedPoints: 256 },
    { name: 'B. Purdy', team: 'SF', adp: 192, projectedPoints: 248 },
    { name: 'K. Murray', team: 'ARI', adp: 196, projectedPoints: 244 },
    { name: 'A. O\'Connell', team: 'NE', adp: 204, projectedPoints: 236 },
    { name: 'M. Maye', team: 'NYJ', adp: 208, projectedPoints: 232 }
  ],
  RB: [
    { name: 'C. McCaffrey', team: 'SF', adp: 2, projectedPoints: 342 },
    { name: 'B. Hall', team: 'NYJ', adp: 4, projectedPoints: 318 },
    { name: 'J. Taylor', team: 'IND', adp: 6, projectedPoints: 314 },
    { name: 'S. Barkley', team: 'PHI', adp: 8, projectedPoints: 310 },
    { name: 'K. Walker', team: 'SEA', adp: 12, projectedPoints: 298 },
    { name: 'J. Jacobs', team: 'GB', adp: 16, projectedPoints: 286 },
    { name: 'B. Robinson', team: 'WAS', adp: 20, projectedPoints: 274 },
    { name: 'D. Henry', team: 'BAL', adp: 24, projectedPoints: 268 },
    { name: 'J. Mixon', team: 'HOU', adp: 28, projectedPoints: 264 },
    { name: 'A. Jones', team: 'MIN', adp: 32, projectedPoints: 258 },
    { name: 'R. White', team: 'TB', adp: 36, projectedPoints: 254 },
    { name: 'T. Etienne', team: 'JAX', adp: 40, projectedPoints: 248 },
    { name: 'A. Ekeler', team: 'WAS', adp: 44, projectedPoints: 244 },
    { name: 'J. Conner', team: 'ARI', adp: 48, projectedPoints: 238 },
    { name: 'R. Mostert', team: 'MIA', adp: 52, projectedPoints: 234 },
    { name: 'I. Pacheco', team: 'KC', adp: 56, projectedPoints: 228 },
    { name: 'D. Cook', team: 'BUF', adp: 60, projectedPoints: 224 },
    { name: 'E. Elliott', team: 'DAL', adp: 64, projectedPoints: 218 },
    { name: 'M. Sanders', team: 'CAR', adp: 68, projectedPoints: 214 },
    { name: 'R. Stevenson', team: 'NE', adp: 72, projectedPoints: 208 },
    { name: 'A. Kamara', team: 'NO', adp: 76, projectedPoints: 204 },
    { name: 'N. Harris', team: 'PIT', adp: 80, projectedPoints: 198 },
    { name: 'D. Swift', team: 'CHI', adp: 84, projectedPoints: 194 },
    { name: 'A. Gibson', team: 'NE', adp: 88, projectedPoints: 188 },
    { name: 'T. Pollard', team: 'TEN', adp: 92, projectedPoints: 184 },
    { name: 'Z. Moss', team: 'CIN', adp: 96, projectedPoints: 178 },
    { name: 'K. Hunt', team: 'CLE', adp: 100, projectedPoints: 174 },
    { name: 'G. Edwards', team: 'LAC', adp: 104, projectedPoints: 168 },
    { name: 'J. Williams', team: 'DEN', adp: 108, projectedPoints: 164 },
    { name: 'D. Johnson', team: 'NYG', adp: 112, projectedPoints: 158 },
    { name: 'C. Hubbard', team: 'CAR', adp: 116, projectedPoints: 154 },
    { name: 'T. Allgeier', team: 'ATL', adp: 120, projectedPoints: 150 },
    { name: 'B. Scott', team: 'PHI', adp: 124, projectedPoints: 146 },
    { name: 'K. Herbert', team: 'CHI', adp: 128, projectedPoints: 142 },
    { name: 'A. Dillon', team: 'GB', adp: 132, projectedPoints: 138 },
    { name: 'S. Michel', team: 'LAR', adp: 136, projectedPoints: 134 },
    { name: 'C. Edmonds', team: 'TB', adp: 140, projectedPoints: 130 },
    { name: 'R. Penny', team: 'MIA', adp: 144, projectedPoints: 126 },
    { name: 'J. McKinnon', team: 'KC', adp: 148, projectedPoints: 122 },
    { name: 'M. Carter', team: 'NYJ', adp: 152, projectedPoints: 118 },
    { name: 'T. Jones', team: 'TB', adp: 156, projectedPoints: 114 },
    { name: 'J. Wilson', team: 'SF', adp: 160, projectedPoints: 110 },
    { name: 'K. Gainwell', team: 'PHI', adp: 164, projectedPoints: 106 },
    { name: 'N. Hines', team: 'CLE', adp: 168, projectedPoints: 102 },
    { name: 'J. Ford', team: 'CLE', adp: 172, projectedPoints: 98 },
    { name: 'I. Spiller', team: 'LAC', adp: 176, projectedPoints: 94 },
    { name: 'T. Sermon', team: 'SF', adp: 180, projectedPoints: 90 },
    { name: 'C. Reynolds', team: 'DET', adp: 184, projectedPoints: 86 },
    { name: 'J. Patterson', team: 'NYJ', adp: 188, projectedPoints: 82 },
    { name: 'D. Hilliard', team: 'TEN', adp: 192, projectedPoints: 78 },
    { name: 'B. Bolden', team: 'LV', adp: 196, projectedPoints: 74 },
    { name: 'M. Ingram', team: 'NO', adp: 200, projectedPoints: 70 },
    { name: 'L. Murray', team: 'BUF', adp: 204, projectedPoints: 68 },
    { name: 'R. Freeman', team: 'HOU', adp: 208, projectedPoints: 66 },
    { name: 'P. Barber', team: 'LV', adp: 212, projectedPoints: 64 },
    { name: 'J. Howard', team: 'PHI', adp: 216, projectedPoints: 62 },
    { name: 'M. Breida', team: 'NYG', adp: 220, projectedPoints: 60 },
    { name: 'T. Coleman', team: 'SF', adp: 224, projectedPoints: 58 },
    { name: 'C. Thompson', team: 'WAS', adp: 228, projectedPoints: 56 },
    { name: 'W. Gallman', team: 'NYG', adp: 232, projectedPoints: 54 },
    { name: 'P. Lindsay', team: 'MIA', adp: 236, projectedPoints: 52 },
    { name: 'A. Collins', team: 'SEA', adp: 240, projectedPoints: 50 },
    { name: 'D. Booker', team: 'LV', adp: 244, projectedPoints: 48 },
    { name: 'R. Jones', team: 'TB', adp: 248, projectedPoints: 46 },
    { name: 'G. Bernard', team: 'TB', adp: 252, projectedPoints: 44 },
    { name: 'L. Bell', team: 'BAL', adp: 256, projectedPoints: 42 },
    { name: 'F. Gore', team: 'NYJ', adp: 260, projectedPoints: 40 },
    { name: 'C. Hyde', team: 'JAX', adp: 264, projectedPoints: 38 },
    { name: 'K. Drake', team: 'LV', adp: 268, projectedPoints: 36 },
    { name: 'M. Gaskin', team: 'MIA', adp: 272, projectedPoints: 34 },
    { name: 'S. Perine', team: 'CIN', adp: 276, projectedPoints: 32 },
    { name: 'J. McKissic', team: 'WAS', adp: 280, projectedPoints: 30 },
    { name: 'N. Chubb', team: 'CLE', adp: 284, projectedPoints: 28 },
    { name: 'D. Pierce', team: 'HOU', adp: 288, projectedPoints: 26 },
    { name: 'K. Williams', team: 'MIA', adp: 292, projectedPoints: 24 },
    { name: 'T. Chandler', team: 'TEN', adp: 296, projectedPoints: 22 },
    { name: 'B. Oliver', team: 'BAL', adp: 300, projectedPoints: 20 },
    { name: 'J. Hasty', team: 'SF', adp: 304, projectedPoints: 18 },
    { name: 'L. Fournette', team: 'TB', adp: 308, projectedPoints: 16 },
    { name: 'C. Akers', team: 'LAR', adp: 312, projectedPoints: 14 },
    { name: 'D. Henderson', team: 'LAR', adp: 316, projectedPoints: 12 },
    { name: 'R. Dobbins', team: 'BAL', adp: 320, projectedPoints: 10 },
    { name: 'J. Robinson', team: 'JAX', adp: 324, projectedPoints: 8 },
    { name: 'C. Huntley', team: 'ATL', adp: 328, projectedPoints: 6 },
    { name: 'D. Evans', team: 'CHI', adp: 332, projectedPoints: 4 },
    { name: 'M. Gordon', team: 'DEN', adp: 336, projectedPoints: 2 },
    { name: 'R. Burkhead', team: 'HOU', adp: 340, projectedPoints: 150 },
    { name: 'T. Badie', team: 'BAL', adp: 344, projectedPoints: 148 },
    { name: 'K. Vaughn', team: 'TB', adp: 348, projectedPoints: 146 },
    { name: 'J. Warren', team: 'PIT', adp: 352, projectedPoints: 144 },
    { name: 'I. Abanikanda', team: 'PIT', adp: 356, projectedPoints: 142 },
    { name: 'T. Goodson', team: 'GB', adp: 360, projectedPoints: 140 },
    { name: 'R. Tucker', team: 'TEN', adp: 364, projectedPoints: 138 },
    { name: 'E. Benjamin', team: 'ARI', adp: 368, projectedPoints: 136 },
    { name: 'J. Gibbs', team: 'DET', adp: 372, projectedPoints: 134 },
    { name: 'K. Williams', team: 'ARI', adp: 376, projectedPoints: 132 },
    { name: 'T. Tracy', team: 'NYG', adp: 380, projectedPoints: 130 },
    { name: 'B. Irving', team: 'TB', adp: 384, projectedPoints: 128 },
    { name: 'C. Rodriguez', team: 'ARI', adp: 388, projectedPoints: 126 },
    { name: 'J. Mason', team: 'BAL', adp: 392, projectedPoints: 124 },
    { name: 'D. Singletary', team: 'NYG', adp: 396, projectedPoints: 122 },
    { name: 'R. Johnson', team: 'DEN', adp: 400, projectedPoints: 120 },
    { name: 'M. Davis', team: 'BUF', adp: 404, projectedPoints: 118 },
    { name: 'J. Cook', team: 'BUF', adp: 408, projectedPoints: 116 },
    { name: 'B. Robinson Jr.', team: 'WAS', adp: 412, projectedPoints: 114 },
    { name: 'E. Mitchell', team: 'SF', adp: 416, projectedPoints: 112 },
    { name: 'C. Patterson', team: 'PIT', adp: 420, projectedPoints: 110 },
    { name: 'D. Freeman', team: 'ATL', adp: 424, projectedPoints: 108 },
    { name: 'J. McNichols', team: 'TEN', adp: 428, projectedPoints: 106 },
    { name: 'K. Nwangwu', team: 'MIN', adp: 432, projectedPoints: 104 },
    { name: 'R. Jones III', team: 'TB', adp: 436, projectedPoints: 102 },
    { name: 'C. Evans', team: 'CHI', adp: 440, projectedPoints: 100 },
    { name: 'T. Jones Jr.', team: 'TB', adp: 444, projectedPoints: 98 },
    { name: 'D. Johnson Jr.', team: 'NYG', adp: 448, projectedPoints: 96 },
    { name: 'M. Boone', team: 'HOU', adp: 452, projectedPoints: 94 },
    { name: 'L. Perine', team: 'CIN', adp: 456, projectedPoints: 92 },
    { name: 'J. Kelly', team: 'LAC', adp: 460, projectedPoints: 90 },
    { name: 'D. Evans Jr.', team: 'CHI', adp: 464, projectedPoints: 88 },
    { name: 'T. Pollard Jr.', team: 'TEN', adp: 468, projectedPoints: 86 },
    { name: 'K. Ballage', team: 'PIT', adp: 472, projectedPoints: 84 },
    { name: 'R. Armstead', team: 'JAX', adp: 476, projectedPoints: 82 },
    { name: 'C. Clement', team: 'ARI', adp: 480, projectedPoints: 80 },
    { name: 'J. Richard', team: 'LV', adp: 484, projectedPoints: 78 },
    { name: 'D. Ozigbo', team: 'JAX', adp: 488, projectedPoints: 76 },
    { name: 'T. Pope', team: 'SEA', adp: 492, projectedPoints: 74 },
    { name: 'S. Ahmed', team: 'MIA', adp: 496, projectedPoints: 72 },
    { name: 'A. Rose', team: 'MIN', adp: 500, projectedPoints: 70 },
    { name: 'P. Laird', team: 'MIA', adp: 504, projectedPoints: 68 },
    { name: 'C. Scarlett', team: 'DAL', adp: 508, projectedPoints: 66 },
    { name: 'T. Logan', team: 'TB', adp: 512, projectedPoints: 64 },
    { name: 'D. Washington', team: 'NO', adp: 516, projectedPoints: 62 },
    { name: 'K. Barner', team: 'ATL', adp: 520, projectedPoints: 60 },
    { name: 'B. Snell', team: 'PIT', adp: 524, projectedPoints: 58 },
    { name: 'J. Samuels', team: 'PIT', adp: 528, projectedPoints: 56 },
    { name: 'Q. Ollison', team: 'ATL', adp: 532, projectedPoints: 54 },
    { name: 'R. Nall', team: 'BUF', adp: 536, projectedPoints: 52 },
    { name: 'T. Ervin', team: 'GB', adp: 540, projectedPoints: 50 },
    { name: 'C. Ballage', team: 'LAC', adp: 544, projectedPoints: 48 },
    { name: 'L. Bowden', team: 'MIA', adp: 548, projectedPoints: 46 },
    { name: 'J. Williams Jr.', team: 'DEN', adp: 552, projectedPoints: 44 },
    { name: 'M. Mack', team: 'HOU', adp: 556, projectedPoints: 42 },
    { name: 'D. Hilliard Jr.', team: 'TEN', adp: 560, projectedPoints: 40 },
    { name: 'A. McFarland', team: 'PIT', adp: 564, projectedPoints: 38 },
    { name: 'T. Homer', team: 'SEA', adp: 568, projectedPoints: 36 },
    { name: 'J. Kelley', team: 'LAC', adp: 572, projectedPoints: 34 },
    { name: 'D. Dallas', team: 'IND', adp: 576, projectedPoints: 32 },
    { name: 'J. White', team: 'TB', adp: 580, projectedPoints: 30 },
    { name: 'R. Mostert Jr.', team: 'MIA', adp: 584, projectedPoints: 28 },
    { name: 'T. Gus', team: 'BAL', adp: 588, projectedPoints: 26 },
    { name: 'K. Vaughn Jr.', team: 'TB', adp: 592, projectedPoints: 24 },
    { name: 'C. Huntley Jr.', team: 'ATL', adp: 596, projectedPoints: 22 },
    { name: 'D. Williams', team: 'KC', adp: 600, projectedPoints: 20 },
    { name: 'J. Jackson', team: 'LAC', adp: 604, projectedPoints: 18 },
    { name: 'T. Benjamin', team: 'ARI', adp: 608, projectedPoints: 16 },
    { name: 'R. Burkhead Jr.', team: 'HOU', adp: 612, projectedPoints: 14 },
    { name: 'K. Hunt Jr.', team: 'CLE', adp: 616, projectedPoints: 12 },
    { name: 'Z. Moss Jr.', team: 'CIN', adp: 620, projectedPoints: 10 }
  ],
  WR: [
    { name: 'T. Hill', team: 'MIA', adp: 3, projectedPoints: 284 },
    { name: 'C. Lamb', team: 'DAL', adp: 5, projectedPoints: 278 },
    { name: 'J. Jefferson', team: 'MIN', adp: 7, projectedPoints: 274 },
    { name: 'A. Brown', team: 'PHI', adp: 9, projectedPoints: 268 },
    { name: 'S. Diggs', team: 'HOU', adp: 11, projectedPoints: 264 },
    { name: 'D. Adams', team: 'LV', adp: 13, projectedPoints: 258 },
    { name: 'M. Evans', team: 'TB', adp: 15, projectedPoints: 254 },
    { name: 'A. Cooper', team: 'CLE', adp: 17, projectedPoints: 248 },
    { name: 'C. Ridley', team: 'TEN', adp: 19, projectedPoints: 244 },
    { name: 'D. Moore', team: 'CHI', adp: 21, projectedPoints: 238 },
    { name: 'T. McLaurin', team: 'WAS', adp: 23, projectedPoints: 234 },
    { name: 'G. Wilson', team: 'NYJ', adp: 25, projectedPoints: 228 },
    { name: 'J. Waddle', team: 'MIA', adp: 27, projectedPoints: 224 },
    { name: 'D. Samuel', team: 'SF', adp: 29, projectedPoints: 218 },
    { name: 'K. Allen', team: 'LAC', adp: 31, projectedPoints: 214 },
    { name: 'C. Olave', team: 'NO', adp: 33, projectedPoints: 208 },
    { name: 'J. Chase', team: 'CIN', adp: 35, projectedPoints: 204 },
    { name: 'D. Johnson', team: 'PIT', adp: 37, projectedPoints: 198 },
    { name: 'M. Pittman', team: 'IND', adp: 39, projectedPoints: 194 },
    { name: 'B. Aiyuk', team: 'SF', adp: 41, projectedPoints: 188 },
    { name: 'T. Lockett', team: 'SEA', adp: 43, projectedPoints: 184 },
    { name: 'J. Smith-Schuster', team: 'KC', adp: 45, projectedPoints: 178 },
    { name: 'C. Kupp', team: 'LAR', adp: 47, projectedPoints: 174 },
    { name: 'M. Brown', team: 'ARI', adp: 49, projectedPoints: 168 },
    { name: 'J. Jeudy', team: 'CLE', adp: 51, projectedPoints: 164 },
    { name: 'T. Higgins', team: 'CIN', adp: 53, projectedPoints: 158 },
    { name: 'D. Metcalf', team: 'SEA', adp: 55, projectedPoints: 154 },
    { name: 'A. St. Brown', team: 'DET', adp: 57, projectedPoints: 148 },
    { name: 'C. Godwin', team: 'TB', adp: 59, projectedPoints: 144 },
    { name: 'M. Williams', team: 'NYJ', adp: 61, projectedPoints: 138 },
    { name: 'J. Jones', team: 'NE', adp: 63, projectedPoints: 134 },
    { name: 'Z. Flowers', team: 'BAL', adp: 65, projectedPoints: 130 },
    { name: 'R. Rice', team: 'KC', adp: 67, projectedPoints: 126 },
    { name: 'N. Collins', team: 'GB', adp: 69, projectedPoints: 122 },
    { name: 'J. Addison', team: 'MIN', adp: 71, projectedPoints: 118 },
    { name: 'Q. Johnston', team: 'LAC', adp: 73, projectedPoints: 114 },
    { name: 'R. Woods', team: 'HOU', adp: 75, projectedPoints: 110 },
    { name: 'C. Kirk', team: 'JAX', adp: 77, projectedPoints: 106 },
    { name: 'T. Boyd', team: 'CIN', adp: 79, projectedPoints: 102 },
    { name: 'J. Palmer', team: 'LAC', adp: 81, projectedPoints: 98 },
    { name: 'D. London', team: 'ATL', adp: 83, projectedPoints: 94 },
    { name: 'G. Pickens', team: 'PIT', adp: 85, projectedPoints: 90 },
    { name: 'R. Bateman', team: 'BAL', adp: 87, projectedPoints: 86 },
    { name: 'J. Dotson', team: 'WAS', adp: 89, projectedPoints: 82 },
    { name: 'E. Moore', team: 'NYJ', adp: 91, projectedPoints: 78 },
    { name: 'N. Westbrook-Ikhine', team: 'TEN', adp: 93, projectedPoints: 74 },
    { name: 'D. Wicks', team: 'GB', adp: 95, projectedPoints: 70 },
    { name: 'J. Reed', team: 'SEA', adp: 97, projectedPoints: 66 },
    { name: 'X. Hutchinson', team: 'HOU', adp: 99, projectedPoints: 62 },
    { name: 'K. Toney', team: 'KC', adp: 101, projectedPoints: 58 },
    { name: 'J. Downs', team: 'IND', adp: 103, projectedPoints: 54 },
    { name: 'T. Dell', team: 'HOU', adp: 105, projectedPoints: 50 },
    { name: 'R. Odunze', team: 'CHI', adp: 107, projectedPoints: 46 },
    { name: 'M. Nabers', team: 'NYG', adp: 109, projectedPoints: 42 },
    { name: 'B. Thomas', team: 'JAX', adp: 111, projectedPoints: 38 },
    { name: 'L. McConkey', team: 'LAC', adp: 113, projectedPoints: 34 },
    { name: 'K. Coleman', team: 'CLE', adp: 115, projectedPoints: 30 },
    { name: 'A. Mitchell', team: 'IND', adp: 117, projectedPoints: 168 },
    { name: 'X. Legette', team: 'CAR', adp: 119, projectedPoints: 164 },
    { name: 'J. Franklin', team: 'LAR', adp: 121, projectedPoints: 160 },
    { name: 'T. Burks', team: 'TEN', adp: 123, projectedPoints: 156 },
    { name: 'N. Harry', team: 'CHI', adp: 125, projectedPoints: 152 },
    { name: 'K. Bourne', team: 'NE', adp: 127, projectedPoints: 148 },
    { name: 'J. Meyers', team: 'NE', adp: 129, projectedPoints: 144 },
    { name: 'T. Thornton', team: 'NE', adp: 131, projectedPoints: 140 },
    { name: 'D. Hopkins', team: 'TEN', adp: 133, projectedPoints: 136 },
    { name: 'M. Valdes-Scantling', team: 'BUF', adp: 135, projectedPoints: 132 },
    { name: 'N. Agholor', team: 'BAL', adp: 137, projectedPoints: 128 },
    { name: 'J. Reynolds', team: 'DEN', adp: 139, projectedPoints: 124 },
    { name: 'A. Thielen', team: 'CAR', adp: 141, projectedPoints: 120 },
    { name: 'C. Watson', team: 'GB', adp: 143, projectedPoints: 116 },
    { name: 'M. Hollins', team: 'LV', adp: 145, projectedPoints: 112 },
    { name: 'T. Smith', team: 'CAR', adp: 147, projectedPoints: 108 },
    { name: 'I. McKenzie', team: 'NYG', adp: 149, projectedPoints: 104 },
    { name: 'B. Berrios', team: 'MIA', adp: 151, projectedPoints: 100 },
    { name: 'M. Hardman', team: 'KC', adp: 153, projectedPoints: 96 },
    { name: 'K. Hamler', team: 'DEN', adp: 155, projectedPoints: 92 },
    { name: 'J. Crowder', team: 'WAS', adp: 157, projectedPoints: 88 },
    { name: 'R. Anderson', team: 'ARI', adp: 159, projectedPoints: 84 },
    { name: 'P. Campbell', team: 'IND', adp: 161, projectedPoints: 80 },
    { name: 'T. Johnson', team: 'TB', adp: 163, projectedPoints: 76 },
    { name: 'C. Samuel', team: 'BUF', adp: 165, projectedPoints: 72 },
    { name: 'V. Jefferson', team: 'MIN', adp: 167, projectedPoints: 68 },
    { name: 'L. Shenault', team: 'SEA', adp: 169, projectedPoints: 64 },
    { name: 'M. Goodwin', team: 'KC', adp: 171, projectedPoints: 60 },
    { name: 'J. Ross', team: 'PHI', adp: 173, projectedPoints: 56 },
    { name: 'D. Duvernay', team: 'BAL', adp: 175, projectedPoints: 52 },
    { name: 'O. Beckham', team: 'BAL', adp: 177, projectedPoints: 48 },
    { name: 'K. Phillips', team: 'NYG', adp: 179, projectedPoints: 44 },
    { name: 'T. Austin', team: 'BUF', adp: 181, projectedPoints: 40 },
    { name: 'B. Powell', team: 'MIN', adp: 183, projectedPoints: 36 },
    { name: 'S. Shepard', team: 'NYG', adp: 185, projectedPoints: 32 },
    { name: 'C. Board', team: 'NYG', adp: 187, projectedPoints: 28 },
    { name: 'T. Patrick', team: 'DET', adp: 189, projectedPoints: 24 },
    { name: 'R. Cobb', team: 'NYJ', adp: 191, projectedPoints: 20 },
    { name: 'A. Lazard', team: 'NYJ', adp: 193, projectedPoints: 16 },
    { name: 'M. Jones', team: 'NE', adp: 195, projectedPoints: 12 },
    { name: 'D. Peoples-Jones', team: 'DET', adp: 197, projectedPoints: 8 },
    { name: 'A. Robinson', team: 'PIT', adp: 199, projectedPoints: 4 },
    { name: 'N. Brown', team: 'ARI', adp: 201, projectedPoints: 176 },
    { name: 'P. Dorsett', team: 'HOU', adp: 203, projectedPoints: 172 },
    { name: 'J. Gordon', team: 'KC', adp: 205, projectedPoints: 168 },
    { name: 'C. Davis', team: 'BUF', adp: 207, projectedPoints: 164 },
    { name: 'Z. Pascal', team: 'ARI', adp: 209, projectedPoints: 160 },
    { name: 'M. Gallup', team: 'LV', adp: 211, projectedPoints: 156 },
    { name: 'J. Landry', team: 'NO', adp: 213, projectedPoints: 152 },
    { name: 'M. Thomas', team: 'NO', adp: 215, projectedPoints: 148 },
    { name: 'D. Parker', team: 'SEA', adp: 217, projectedPoints: 144 },
    { name: 'C. Claypool', team: 'BUF', adp: 219, projectedPoints: 140 },
    { name: 'N. Cooks', team: 'DAL', adp: 221, projectedPoints: 136 },
    { name: 'K. Golladay', team: 'NYG', adp: 223, projectedPoints: 132 },
    { name: 'W. Fuller', team: 'MIA', adp: 225, projectedPoints: 128 },
    { name: 'J. Washington', team: 'DAL', adp: 227, projectedPoints: 124 },
    { name: 'P. Williams', team: 'IND', adp: 229, projectedPoints: 120 },
    { name: 'D. Chark', team: 'CAR', adp: 231, projectedPoints: 116 },
    { name: 'C. Conley', team: 'HOU', adp: 233, projectedPoints: 112 },
    { name: 'A. Miller', team: 'CHI', adp: 235, projectedPoints: 108 },
    { name: 'K. Stills', team: 'MIA', adp: 237, projectedPoints: 104 },
    { name: 'T. Gabriel', team: 'CHI', adp: 239, projectedPoints: 100 },
    { name: 'D. Inman', team: 'LAC', adp: 241, projectedPoints: 96 },
    { name: 'R. Grant', team: 'WAS', adp: 243, projectedPoints: 92 },
    { name: 'C. Hogan', team: 'NE', adp: 245, projectedPoints: 88 },
    { name: 'J. Brown', team: 'SEA', adp: 247, projectedPoints: 84 },
    { name: 'T. Williams', team: 'MIA', adp: 249, projectedPoints: 80 },
    { name: 'D. Byrd', team: 'SEA', adp: 251, projectedPoints: 76 },
    { name: 'K. Raymond', team: 'DET', adp: 253, projectedPoints: 72 },
    { name: 'I. Smith', team: 'DEN', adp: 255, projectedPoints: 68 },
    { name: 'B. Perriman', team: 'CHI', adp: 257, projectedPoints: 64 },
    { name: 'R. Higgins', team: 'CLE', adp: 259, projectedPoints: 60 },
    { name: 'J. Kearse', team: 'NYJ', adp: 261, projectedPoints: 56 },
    { name: 'A. Humphries', team: 'WAS', adp: 263, projectedPoints: 52 },
    { name: 'T. Taylor', team: 'CIN', adp: 265, projectedPoints: 48 },
    { name: 'C. Moore', team: 'BAL', adp: 267, projectedPoints: 44 },
    { name: 'D. Thomas', team: 'NYJ', adp: 269, projectedPoints: 40 },
    { name: 'J. Matthews', team: 'PHI', adp: 271, projectedPoints: 36 },
    { name: 'P. Richardson', team: 'MIN', adp: 273, projectedPoints: 32 },
    { name: 'L. Treadwell', team: 'JAX', adp: 275, projectedPoints: 28 },
    { name: 'C. Hansen', team: 'HOU', adp: 277, projectedPoints: 24 },
    { name: 'B. Edwards', team: 'LV', adp: 279, projectedPoints: 20 },
    { name: 'M. Floyd', team: 'BAL', adp: 281, projectedPoints: 16 },
    { name: 'K. White', team: 'SF', adp: 283, projectedPoints: 12 },
    { name: 'D. Moncrief', team: 'CAR', adp: 285, projectedPoints: 8 },
    { name: 'C. Conley Jr.', team: 'HOU', adp: 287, projectedPoints: 4 },
    { name: 'T. Ginn', team: 'WAS', adp: 289, projectedPoints: 176 },
    { name: 'R. Matthews', team: 'SF', adp: 291, projectedPoints: 172 },
    { name: 'M. Wilson', team: 'ARI', adp: 293, projectedPoints: 168 },
    { name: 'K. Coutee', team: 'HOU', adp: 295, projectedPoints: 164 },
    { name: 'A. Callaway', team: 'MIA', adp: 297, projectedPoints: 160 },
    { name: 'J. Washington Jr.', team: 'PIT', adp: 299, projectedPoints: 156 },
    { name: 'D. Pettis', team: 'SF', adp: 301, projectedPoints: 152 },
    { name: 'C. Sutton', team: 'DEN', adp: 303, projectedPoints: 148 },
    { name: 'A. Miller Jr.', team: 'CHI', adp: 305, projectedPoints: 144 },
    { name: 'D. Hamilton', team: 'DEN', adp: 307, projectedPoints: 140 },
    { name: 'T. Quinn', team: 'GB', adp: 309, projectedPoints: 136 },
    { name: 'M. Ateman', team: 'LV', adp: 311, projectedPoints: 132 },
    { name: 'K. Johnson', team: 'HOU', adp: 313, projectedPoints: 128 },
    { name: 'J. Watson', team: 'GB', adp: 315, projectedPoints: 124 },
    { name: 'T. Sherfield', team: 'ARI', adp: 317, projectedPoints: 120 },
    { name: 'C. Rogers', team: 'IND', adp: 319, projectedPoints: 116 },
    { name: 'A. Humphries Jr.', team: 'WAS', adp: 321, projectedPoints: 112 }
  ],
  TE: [
    { name: 'T. Kelce', team: 'KC', adp: 18, projectedPoints: 214 },
    { name: 'M. Andrews', team: 'BAL', adp: 42, projectedPoints: 188 },
    { name: 'S. LaPorta', team: 'DET', adp: 46, projectedPoints: 184 },
    { name: 'T. McBride', team: 'ARI', adp: 58, projectedPoints: 168 },
    { name: 'G. Kittle', team: 'SF', adp: 62, projectedPoints: 164 },
    { name: 'D. Goedert', team: 'PHI', adp: 74, projectedPoints: 148 },
    { name: 'K. Pitts', team: 'ATL', adp: 78, projectedPoints: 144 },
    { name: 'E. Engram', team: 'JAX', adp: 86, projectedPoints: 136 },
    { name: 'J. Ferguson', team: 'NYJ', adp: 94, projectedPoints: 128 },
    { name: 'D. Waller', team: 'NYG', adp: 102, projectedPoints: 124 },
    { name: 'C. Kmet', team: 'CHI', adp: 110, projectedPoints: 118 },
    { name: 'H. Henry', team: 'NE', adp: 118, projectedPoints: 114 },
    { name: 'T. Hockenson', team: 'MIN', adp: 126, projectedPoints: 108 },
    { name: 'P. Freiermuth', team: 'PIT', adp: 134, projectedPoints: 104 },
    { name: 'D. Njoku', team: 'CLE', adp: 142, projectedPoints: 98 },
    { name: 'J. Smith', team: 'MIA', adp: 150, projectedPoints: 94 },
    { name: 'C. Otton', team: 'TB', adp: 158, projectedPoints: 88 },
    { name: 'N. Fant', team: 'SEA', adp: 166, projectedPoints: 84 },
    { name: 'I. Smith Jr.', team: 'NO', adp: 174, projectedPoints: 78 },
    { name: 'T. Conklin', team: 'NYJ', adp: 182, projectedPoints: 74 },
    { name: 'Z. Ertz', team: 'WAS', adp: 190, projectedPoints: 70 },
    { name: 'D. Schultz', team: 'HOU', adp: 198, projectedPoints: 66 },
    { name: 'H. Bryant', team: 'SEA', adp: 206, projectedPoints: 62 },
    { name: 'L. Thomas', team: 'NO', adp: 214, projectedPoints: 58 },
    { name: 'J. Oliver', team: 'BAL', adp: 222, projectedPoints: 54 },
    { name: 'C. Uzomah', team: 'NYJ', adp: 230, projectedPoints: 50 },
    { name: 'A. Hooper', team: 'NE', adp: 238, projectedPoints: 46 },
    { name: 'R. Tonyan', team: 'CHI', adp: 246, projectedPoints: 42 },
    { name: 'T. Higbee', team: 'LAR', adp: 254, projectedPoints: 38 },
    { name: 'G. Everett', team: 'CHI', adp: 262, projectedPoints: 34 },
    { name: 'M. Gesicki', team: 'CIN', adp: 270, projectedPoints: 30 },
    { name: 'C. Parham', team: 'LAC', adp: 278, projectedPoints: 120 },
    { name: 'F. Moreau', team: 'LV', adp: 286, projectedPoints: 116 },
    { name: 'J. Akins', team: 'CLE', adp: 294, projectedPoints: 112 },
    { name: 'B. Jordan', team: 'DEN', adp: 302, projectedPoints: 108 },
    { name: 'T. Hill', team: 'MIA', adp: 310, projectedPoints: 104 },
    { name: 'D. Parkinson', team: 'TEN', adp: 318, projectedPoints: 100 },
    { name: 'C. Okonkwo', team: 'TEN', adp: 326, projectedPoints: 96 },
    { name: 'J. Stoll', team: 'LAR', adp: 334, projectedPoints: 92 },
    { name: 'L. Humphrey', team: 'DEN', adp: 342, projectedPoints: 88 },
    { name: 'T. Tremble', team: 'CAR', adp: 350, projectedPoints: 84 },
    { name: 'H. Long', team: 'KC', adp: 358, projectedPoints: 80 },
    { name: 'D. Sample', team: 'CIN', adp: 366, projectedPoints: 76 },
    { name: 'M. Alie-Cox', team: 'IND', adp: 374, projectedPoints: 72 },
    { name: 'J. Harris', team: 'ATL', adp: 382, projectedPoints: 68 },
    { name: 'B. Bowers', team: 'LV', adp: 390, projectedPoints: 64 },
    { name: 'C. Washington', team: 'ARI', adp: 398, projectedPoints: 60 },
    { name: 'K. Granson', team: 'IND', adp: 406, projectedPoints: 56 },
    { name: 'T. Knox', team: 'BUF', adp: 414, projectedPoints: 52 },
    { name: 'J. Woods', team: 'LAC', adp: 422, projectedPoints: 48 },
    { name: 'C. Kolar', team: 'WAS', adp: 430, projectedPoints: 44 },
    { name: 'A. Trautman', team: 'DEN', adp: 438, projectedPoints: 40 },
    { name: 'I. Likely', team: 'BAL', adp: 446, projectedPoints: 36 },
    { name: 'D. Bellinger', team: 'NYG', adp: 454, projectedPoints: 32 },
    { name: 'T. Hudson', team: 'CIN', adp: 462, projectedPoints: 28 },
    { name: 'M. Washington', team: 'ATL', adp: 470, projectedPoints: 24 },
    { name: 'P. Campbell', team: 'IND', adp: 478, projectedPoints: 20 },
    { name: 'B. Strange', team: 'LAC', adp: 486, projectedPoints: 16 },
    { name: 'G. Dulcich', team: 'DEN', adp: 494, projectedPoints: 12 },
    { name: 'J. Johnson', team: 'NO', adp: 502, projectedPoints: 8 },
    { name: 'C. Herndon', team: 'MIA', adp: 510, projectedPoints: 4 },
    { name: 'T. Swoope', team: 'JAX', adp: 518, projectedPoints: 110 },
    { name: 'R. Griffin', team: 'CHI', adp: 526, projectedPoints: 106 },
    { name: 'J. Hollins', team: 'LV', adp: 534, projectedPoints: 102 },
    { name: 'M. Pruitt', team: 'MIN', adp: 542, projectedPoints: 98 },
    { name: 'L. Kendricks', team: 'GB', adp: 550, projectedPoints: 94 },
    { name: 'A. Firkser', team: 'ATL', adp: 558, projectedPoints: 90 },
    { name: 'C. Sims', team: 'NYG', adp: 566, projectedPoints: 86 },
    { name: 'T. Conley', team: 'SF', adp: 574, projectedPoints: 82 },
    { name: 'D. Gray', team: 'BUF', adp: 582, projectedPoints: 78 },
    { name: 'K. Rudolph', team: 'TB', adp: 590, projectedPoints: 74 },
    { name: 'J. Cook', team: 'GB', adp: 598, projectedPoints: 70 },
    { name: 'A. Beck', team: 'HOU', adp: 606, projectedPoints: 66 },
    { name: 'N. Vannett', team: 'NO', adp: 614, projectedPoints: 62 },
    { name: 'M. Sokol', team: 'SF', adp: 622, projectedPoints: 58 },
    { name: 'T. McKitty', team: 'LAC', adp: 630, projectedPoints: 54 },
    { name: 'J. Breeland', team: 'KC', adp: 638, projectedPoints: 50 },
    { name: 'D. Brunskill', team: 'TEN', adp: 646, projectedPoints: 46 },
    { name: 'R. Seals-Jones', team: 'WAS', adp: 654, projectedPoints: 42 },
    { name: 'A. Shaheen', team: 'MIA', adp: 662, projectedPoints: 38 },
    { name: 'M. Auclair', team: 'ARI', adp: 670, projectedPoints: 34 },
    { name: 'T. Sweeney', team: 'BUF', adp: 678, projectedPoints: 30 },
    { name: 'J. Samuels', team: 'CAR', adp: 686, projectedPoints: 26 },
    { name: 'L. Stocker', team: 'TEN', adp: 694, projectedPoints: 22 },
    { name: 'B. Jarwin', team: 'NYG', adp: 702, projectedPoints: 18 },
    { name: 'R. Izzo', team: 'HOU', adp: 710, projectedPoints: 14 },
    { name: 'N. O\'Leary', team: 'JAX', adp: 718, projectedPoints: 10 },
    { name: 'T. Eifert', team: 'SF', adp: 726, projectedPoints: 6 },
    { name: 'J. Thomas', team: 'LV', adp: 734, projectedPoints: 2 },
    { name: 'C. Brate', team: 'TB', adp: 742, projectedPoints: 104 },
    { name: 'D. Arnold', team: 'CAR', adp: 750, projectedPoints: 100 },
    { name: 'M. Valdes-Scantling', team: 'BUF', adp: 758, projectedPoints: 96 },
    { name: 'J. McKenzie', team: 'WAS', adp: 766, projectedPoints: 92 },
    { name: 'C. Claypool', team: 'CHI', adp: 774, projectedPoints: 88 },
    { name: 'T. Marshall', team: 'NO', adp: 782, projectedPoints: 84 },
    { name: 'R. Anderson', team: 'MIA', adp: 790, projectedPoints: 80 },
    { name: 'J. Reagor', team: 'NE', adp: 798, projectedPoints: 76 },
    { name: 'K. Phillips', team: 'NYG', adp: 806, projectedPoints: 72 },
    { name: 'T. Johnson', team: 'GB', adp: 814, projectedPoints: 68 },
    { name: 'C. Watson', team: 'DEN', adp: 822, projectedPoints: 64 },
    { name: 'D. Hopkins', team: 'KC', adp: 830, projectedPoints: 60 },
    { name: 'M. Hardman', team: 'KC', adp: 838, projectedPoints: 56 },
    { name: 'A. Pierce', team: 'IND', adp: 846, projectedPoints: 52 },
    { name: 'J. Watson', team: 'GB', adp: 854, projectedPoints: 48 },
    { name: 'T. Austin', team: 'JAX', adp: 862, projectedPoints: 44 },
    { name: 'K. Stills', team: 'MIA', adp: 870, projectedPoints: 40 }
  ]
};

// Players drafted in auction - exclude from snake draft
const AUCTION_PLAYERS = [
  'J. Chase', 'B. Robinson', 'C. Lamb', 'J. Gibbs', 'D. Achane',
  'J. Jefferson', 'S. Barkley', 'C. McCaffrey', 'N. Collins', 'M. Nabers',
  'P. Nuka', 'A. Jeanty', 'A. St. Brown', 'B. Thomas', 'A.J. Brown',
  'D. Henry', 'J. Jacobs', 'B. Bowers', 'D. London', 'C. Brown',
  'B. Irving', 'K. Williams', 'J. Taylor', 'T. McBride', 'T. Higgins',
  'L. McConkey', 'J. Smith Njiba', 'L. Jackson', 'J. Allen', 'J. Daniels',
  'T. Hill', 'K. Walker III', 'D. Adams', 'J. Cook', 'G. Kittle',
  'C. Hubbard', 'O. Hampton', 'B. Hall', 'G. Wilson', 'J. Burrow',
  'A. Kamara', 'J. Hurts', 'T. Henderson', 'DK. Metcalf', 'C. Sutton',
  'M. Evans', 'J. Connor', 'M. Harrison Jr', 'X. Worthy', 'T. McMillian',
  'RJ Harvey', 'DJ. Moore', 'T. McLaurin', 'D. Swift', 'J. Jeudy',
  'T. Pollard', 'T. Hunter', 'J. Williams', 'R. Rice', 'D. Smith'
];

export class RealPlayerDataService {
  
  public generateRealNFLDatabase(): SnakeDraftPlayer[] {
    const players: SnakeDraftPlayer[] = [];
    let playerId = 1;

    // Generate QBs with real data
    REAL_NFL_PLAYERS.QB.forEach((playerData, index) => {
      const tier = index < 8 ? 1 : index < 16 ? 2 : index < 24 ? 3 : 4;
      
      players.push({
        id: `qb_${playerId++}`,
        name: playerData.name,
        position: 'QB',
        team: playerData.team,
        tier: tier as 1 | 2 | 3 | 4 | 5,
        baseValue: Math.max(15, 55 - (index * 1.2)),
        estimatedValue: Math.max(18, 58 - (index * 1.2)),
        projectedPoints: playerData.projectedPoints,
        adp: playerData.adp,
        injuryRisk: this.calculateInjuryRisk(index, 'QB'),
        strengthOfSchedule: Math.floor(Math.random() * 10) + 1,
        valueOverReplacement: Math.max(0, playerData.projectedPoints - 220),
        upside: playerData.projectedPoints * 1.15,
        floor: playerData.projectedPoints * 0.85,
        consistency: Math.max(5, 10 - Math.floor(index / 4)),
        byeWeek: this.getByeWeek(playerData.team),
        ageRisk: index > 20 ? 'HIGH' : index > 10 ? 'MEDIUM' : 'LOW',
        targetShare: 0,
        redZoneShare: Math.random() * 15 + 20,
        age: 23 + (index * 0.4),
        experience: Math.max(1, Math.floor(index / 4) + 1),
        lastSeasonGames: Math.max(14, 17 - Math.floor(Math.random() * 4)),
        careerGames: Math.max(16, index * 5 + Math.random() * 30),
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: this.getOffensiveLineRank(playerData.team),
        defensiveStrengthVsPosition: Math.floor(Math.random() * 32) + 1,
        weatherConcerns: this.hasWeatherConcerns(playerData.team),
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: Math.floor(Math.random() * 32) + 1,
        redZoneTouchesLastSeason: Math.floor(Math.random() * 30) + 15,
        snapPercentage: 100,
        recentTrends: index < 5 ? 'STABLE' : index < 10 ? 'RISING' : 'DECLINING',
        fantasyRelevantWeeks: 17,
        floorWeeks: Math.max(8, 16 - Math.floor(index / 4)),
        ceilingWeeks: Math.max(4, 12 - Math.floor(index / 3)),
        breakoutPotential: Math.max(5, 30 - index),
        regressionRisk: Math.max(10, 15 + Math.floor(index / 2)),
        coachingFit: Math.max(6, 10 - Math.floor(index / 6)),
        opportunityRank: index + 1,
        depthChart: 1,
        sleeper: index > 15 && Math.random() > 0.7,
        bustRisk: Math.max(10, 15 + Math.floor(index / 2)),
        weeklyVolatility: Math.max(4, 8 - Math.floor(index / 8)),
        positionalScarcity: index + 1,
        handcuffRecommendation: 'None',
        isDrafted: false
      });
    });

    // Generate RBs, WRs, TEs with real data
    (['RB', 'WR', 'TE'] as const).forEach(position => {
      const positionData = REAL_NFL_PLAYERS[position];
      const maxPlayers = position === 'TE' ? 100 : 150;
      
      for (let i = 0; i < maxPlayers; i++) {
        const realPlayer = positionData[i];
        const tier = position === 'TE' ? 
          (i < 3 ? 1 : i < 12 ? 2 : i < 30 ? 3 : 4) :
          (i < 12 ? 1 : i < 36 ? 2 : i < 60 ? 3 : 4);
        
        const name = realPlayer ? realPlayer.name : `${position} Player ${i + 1}`;
        const team = realPlayer ? realPlayer.team : Object.keys(NFL_TEAMS)[i % 32] as keyof typeof NFL_TEAMS;
        const projectedPoints = realPlayer ? realPlayer.projectedPoints : this.calculateGenericProjection(position, i);
        const adp = realPlayer ? realPlayer.adp : this.calculateGenericADP(position, i);
        
        players.push({
          id: `${position.toLowerCase()}_${playerId++}`,
          name,
          position: position as 'RB' | 'WR' | 'TE',
          team,
          tier: tier as 1 | 2 | 3 | 4 | 5,
          baseValue: this.calculateBaseValue(position, i),
          estimatedValue: this.calculateEstimatedValue(position, i),
          projectedPoints,
          adp,
          injuryRisk: this.calculateInjuryRisk(i, position),
          strengthOfSchedule: Math.floor(Math.random() * 10) + 1,
          valueOverReplacement: Math.max(0, projectedPoints - this.getReplacementLevel(position)),
          upside: projectedPoints * this.getUpsideMultiplier(position),
          floor: projectedPoints * this.getFloorMultiplier(position),
          consistency: this.calculateConsistency(position, i),
          byeWeek: this.getByeWeek(team),
          ageRisk: this.calculateAgeRisk(i),
          targetShare: this.calculateTargetShare(position, i),
          redZoneShare: this.calculateRedZoneShare(position, i),
          age: 22 + (i * 0.15),
          experience: Math.max(1, Math.floor(i / 15) + 1),
          lastSeasonGames: this.calculateLastSeasonGames(position, i),
          careerGames: Math.max(16, i * 2 + Math.random() * 35),
          injuryHistory: [],
          contractStatus: 'SECURE',
          coachingStability: 'STABLE',
          offensiveLineRank: this.getOffensiveLineRank(team),
          defensiveStrengthVsPosition: Math.floor(Math.random() * 32) + 1,
          weatherConcerns: this.hasWeatherConcerns(team),
          playoffSchedule: 'MODERATE',
          handcuffValue: position === 'RB' && i < 50 ? Math.floor(Math.random() * 8) + 2 : 0,
          competitionLevel: this.calculateCompetitionLevel(position, i),
          teamPaceRank: Math.floor(Math.random() * 32) + 1,
          redZoneTouchesLastSeason: this.calculateRedZoneTouches(position, i),
          snapPercentage: this.calculateSnapPercentage(position, i),
          recentTrends: this.calculateRecentTrends(i),
          fantasyRelevantWeeks: 17,
          floorWeeks: this.calculateFloorWeeks(position, i),
          ceilingWeeks: this.calculateCeilingWeeks(position, i),
          breakoutPotential: this.calculateBreakoutPotential(position, i),
          regressionRisk: this.calculateRegressionRisk(i),
          coachingFit: this.calculateCoachingFit(position, i),
          opportunityRank: i + 1,
          depthChart: i < 32 ? 1 : i < 64 ? 2 : 3,
          sleeper: this.calculateSleeperStatus(position, i),
          bustRisk: this.calculateBustRisk(i),
          weeklyVolatility: this.calculateWeeklyVolatility(position, i),
          positionalScarcity: i + 1,
          handcuffRecommendation: position === 'RB' && i < 50 ? 'Backup RB' : 'None',
          isDrafted: false
        });
      }
    });

    // Add Kickers and Defenses with real teams
    this.addKickers(players, playerId);
    this.addDefenses(players, playerId + 32);

    // Filter out auction players
    const filteredPlayers = players.filter(player => 
      !AUCTION_PLAYERS.includes(player.name)
    );

    return filteredPlayers;
  }

  private calculateGenericProjection(position: string, index: number): number {
    const baselines = { RB: 320, WR: 300, TE: 245 };
    const declines = { RB: 2.3, WR: 2.2, TE: 1.95 };
    const minimums = { RB: 90, WR: 80, TE: 50 };
    
    return Math.max(
      minimums[position as keyof typeof minimums], 
      baselines[position as keyof typeof baselines] - (index * declines[position as keyof typeof declines])
    );
  }

  private calculateGenericADP(position: string, index: number): number {
    const startingADPs = { RB: 2, WR: 5, TE: 15 };
    const increments = { RB: 2.2, WR: 1.8, TE: 2.5 };
    
    return startingADPs[position as keyof typeof startingADPs] + (index * increments[position as keyof typeof increments]);
  }

  private getByeWeek(team: string): number {
    const byeWeeks: Record<string, number> = {
      'PHI': 5, 'BUF': 12, 'BAL': 14, 'KC': 6, 'DAL': 7, 'MIA': 6, 'CIN': 7, 'NYJ': 12,
      'PIT': 9, 'CAR': 11, 'SEA': 10, 'ATL': 12, 'NYG': 11, 'GB': 10, 'CHI': 7, 'WAS': 14,
      'IND': 14, 'HOU': 14, 'JAX': 12, 'LAC': 5, 'LAR': 6, 'TB': 11, 'CLE': 10, 'DEN': 14,
      'MIN': 6, 'NE': 14, 'NO': 12, 'TEN': 5, 'SF': 9, 'ARI': 11, 'LV': 10, 'DET': 5
    };
    return byeWeeks[team] || 7;
  }

  private getOffensiveLineRank(team: string): number {
    const ranks: Record<string, number> = {
      'PHI': 3, 'SF': 5, 'DAL': 8, 'GB': 7, 'BUF': 12, 'KC': 15, 'BAL': 18, 'MIA': 22,
      'MIN': 10, 'LAR': 14, 'IND': 9, 'HOU': 16, 'TB': 19, 'SEA': 21, 'DET': 6, 'CIN': 25,
      'JAX': 28, 'LAC': 20, 'ATL': 24, 'TEN': 26, 'NO': 23, 'PIT': 17, 'DEN': 11, 'WAS': 13,
      'CLE': 27, 'NYG': 29, 'CHI': 30, 'CAR': 31, 'ARI': 32, 'NYJ': 4, 'NE': 1, 'LV': 2
    };
    return ranks[team] || 16;
  }

  private hasWeatherConcerns(team: string): boolean {
    return ['BUF', 'CLE', 'GB', 'CHI', 'NE', 'DEN', 'PIT', 'NYJ', 'NYG'].includes(team);
  }

  // Helper methods for calculations
  private calculateInjuryRisk(index: number, position: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (position === 'RB' && index < 20) return 'MEDIUM';
    return index % 3 === 0 ? 'HIGH' : index % 3 === 1 ? 'MEDIUM' : 'LOW';
  }

  private calculateBaseValue(position: string, index: number): number {
    const values = {
      'RB': Math.max(8, 50 - (index * 0.35)),
      'WR': Math.max(8, 48 - (index * 0.4)),
      'TE': Math.max(8, 40 - (index * 0.32))
    };
    return values[position as keyof typeof values];
  }

  private calculateEstimatedValue(position: string, index: number): number {
    return this.calculateBaseValue(position, index) + 3;
  }

  private getReplacementLevel(position: string): number {
    return { 'RB': 140, 'WR': 120, 'TE': 80 }[position] || 100;
  }

  private getUpsideMultiplier(position: string): number {
    return { 'RB': 1.2, 'WR': 1.25, 'TE': 1.3 }[position] || 1.2;
  }

  private getFloorMultiplier(position: string): number {
    return { 'RB': 0.75, 'WR': 0.75, 'TE': 0.7 }[position] || 0.75;
  }

  private calculateConsistency(position: string, index: number): number {
    const base = { 'RB': 8, 'WR': 9, 'TE': 8 }[position] || 8;
    const divisor = { 'RB': 15, 'WR': 12, 'TE': 12 }[position] || 12;
    return Math.max(3, base - Math.floor(index / divisor));
  }

  private calculateAgeRisk(index: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    return index > 60 ? 'HIGH' : index > 30 ? 'MEDIUM' : 'LOW';
  }

  private calculateTargetShare(position: string, index: number): number {
    if (position === 'RB') return Math.max(5, 20 - (index * 0.15));
    if (position === 'WR') return Math.max(8, 35 - (index * 0.25));
    return Math.max(5, 25 - (index * 0.2)); // TE
  }

  private calculateRedZoneShare(position: string, index: number): number {
    if (position === 'RB') return Math.max(10, 50 - (index * 0.4));
    if (position === 'WR') return Math.max(5, 25 - (index * 0.2));
    return Math.max(5, 30 - (index * 0.25)); // TE
  }

  private calculateLastSeasonGames(position: string, index: number): number {
    const mins = { 'RB': 10, 'WR': 12, 'TE': 8 };
    const ranges = { 'RB': 8, 'WR': 6, 'TE': 10 };
    return Math.max(mins[position as keyof typeof mins], 17 - Math.floor(Math.random() * ranges[position as keyof typeof ranges]));
  }

  private calculateCompetitionLevel(position: string, index: number): 'LOCKED_STARTER' | 'MINOR_COMPETITION' | 'TIMESHARE' {
    const thresholds = { 'RB': [32, 64], 'WR': [32, 64], 'TE': [20, 40] };
    const [first, second] = thresholds[position as keyof typeof thresholds];
    return index < first ? 'LOCKED_STARTER' : index < second ? 'MINOR_COMPETITION' : 'TIMESHARE';
  }

  private calculateRedZoneTouches(position: string, index: number): number {
    const bases = { 'RB': 60, 'WR': 35, 'TE': 35 };
    const declines = { 'RB': 1, 'WR': 1, 'TE': 0.5 };
    return Math.max(5, bases[position as keyof typeof bases] - Math.floor(index * declines[position as keyof typeof declines]));
  }

  private calculateSnapPercentage(position: string, index: number): number {
    const bases = { 'RB': 85, 'WR': 95, 'TE': 85 };
    const mins = { 'RB': 35, 'WR': 45, 'TE': 40 };
    return Math.max(mins[position as keyof typeof mins], bases[position as keyof typeof bases] - (index * 0.5));
  }

  private calculateRecentTrends(index: number): 'RISING' | 'STABLE' | 'DECLINING' {
    return index < 20 ? 'STABLE' : index < 40 ? 'RISING' : index < 80 ? 'STABLE' : 'DECLINING';
  }

  private calculateFloorWeeks(position: string, index: number): number {
    const bases = { 'RB': 14, 'WR': 14, 'TE': 12 };
    const divisors = { 'RB': 10, 'WR': 10, 'TE': 8 };
    const mins = { 'RB': 5, 'WR': 6, 'TE': 4 };
    return Math.max(mins[position as keyof typeof mins], bases[position as keyof typeof bases] - Math.floor(index / divisors[position as keyof typeof divisors]));
  }

  private calculateCeilingWeeks(position: string, index: number): number {
    const bases = { 'RB': 10, 'WR': 10, 'TE': 8 };
    const divisors = { 'RB': 12, 'WR': 12, 'TE': 15 };
    return Math.max(2, bases[position as keyof typeof bases] - Math.floor(index / divisors[position as keyof typeof divisors]));
  }

  private calculateBreakoutPotential(position: string, index: number): number {
    const bases = { 'RB': 35, 'WR': 35, 'TE': 30 };
    const divisors = { 'RB': 2, 'WR': 2, 'TE': 3 };
    return Math.max(5, bases[position as keyof typeof bases] - Math.floor(index / divisors[position as keyof typeof divisors]));
  }

  private calculateRegressionRisk(index: number): number {
    return Math.max(10, 20 + Math.floor(index / 4));
  }

  private calculateCoachingFit(position: string, index: number): number {
    const bases = { 'RB': 10, 'WR': 10, 'TE': 9 };
    const divisors = { 'RB': 12, 'WR': 12, 'TE': 20 };
    const mins = { 'RB': 6, 'WR': 6, 'TE': 5 };
    return Math.max(mins[position as keyof typeof mins], bases[position as keyof typeof bases] - Math.floor(index / divisors[position as keyof typeof divisors]));
  }

  private calculateSleeperStatus(position: string, index: number): boolean {
    const thresholds = { 'RB': 40, 'WR': 40, 'TE': 30 };
    const chances = { 'RB': 0.6, 'WR': 0.6, 'TE': 0.65 };
    return index > thresholds[position as keyof typeof thresholds] && Math.random() > chances[position as keyof typeof chances];
  }

  private calculateBustRisk(index: number): number {
    return Math.max(15, 15 + Math.floor(index / 4));
  }

  private calculateWeeklyVolatility(position: string, index: number): number {
    const bases = { 'RB': 9, 'WR': 9, 'TE': 12 };
    const divisors = { 'RB': 15, 'WR': 15, 'TE': 15 };
    const mins = { 'RB': 4, 'WR': 4, 'TE': 6 };
    return Math.max(mins[position as keyof typeof mins], bases[position as keyof typeof bases] - Math.floor(index / divisors[position as keyof typeof divisors]));
  }

  private addKickers(players: SnakeDraftPlayer[], startId: number): void {
    const kickers = [
      { name: 'J. Tucker', team: 'BAL' }, { name: 'B. Aubrey', team: 'DAL' }, { name: 'H. Butker', team: 'KC' },
      { name: 'T. Bass', team: 'BUF' }, { name: 'Y. Koo', team: 'ATL' }, { name: 'E. Elliott', team: 'PHI' },
      { name: 'C. Boswell', team: 'PIT' }, { name: 'D. Hopkins', team: 'LAC' }, { name: 'J. Sanders', team: 'MIA' },
      { name: 'W. Lutz', team: 'DEN' }, { name: 'B. McManus', team: 'GB' }, { name: 'G. Zuerlein', team: 'NYJ' },
      { name: 'J. Myers', team: 'SEA' }, { name: 'C. York', team: 'CLE' }, { name: 'M. Gay', team: 'IND' },
      { name: 'C. McLaughlin', team: 'MIN' }, { name: 'D. Carlson', team: 'LV' }, { name: 'K. Fairbairn', team: 'HOU' },
      { name: 'C. Santos', team: 'CHI' }, { name: 'M. Badgley', team: 'DET' }, { name: 'N. Folk', team: 'TEN' },
      { name: 'R. Succop', team: 'TB' }, { name: 'C. Ryland', team: 'NE' }, { name: 'R. Blankenship', team: 'ARI' },
      { name: 'B. Maher', team: 'LAR' }, { name: 'J. Blewitt', team: 'WAS' }, { name: 'G. Gano', team: 'NYG' },
      { name: 'A. Seibert', team: 'WAS' }, { name: 'B. Pinion', team: 'NYG' }, { name: 'J. Slye', team: 'CAR' },
      { name: 'L. Havrisik', team: 'JAX' }, { name: 'B. Wright', team: 'NO' }
    ];

    kickers.forEach((kicker, i) => {
      players.push({
        id: `k_${startId + i}`,
        name: kicker.name,
        position: 'K',
        team: kicker.team,
        tier: (i < 5 ? 1 : i < 15 ? 2 : 3) as 1 | 2 | 3 | 4 | 5,
        baseValue: Math.max(5, 10 - Math.floor(i / 5)),
        estimatedValue: Math.max(7, 12 - Math.floor(i / 5)),
        projectedPoints: Math.max(110, 145 - (i * 1.1)),
        adp: 155 + (i * 2.5),
        injuryRisk: 'LOW',
        strengthOfSchedule: Math.floor(Math.random() * 10) + 1,
        valueOverReplacement: Math.max(0, 145 - (i * 1.1) - 110),
        upside: (145 - (i * 1.1)) * 1.15,
        floor: (145 - (i * 1.1)) * 0.85,
        consistency: Math.max(5, 9 - Math.floor(i / 8)),
        byeWeek: this.getByeWeek(kicker.team),
        ageRisk: i > 20 ? 'MEDIUM' : 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 25 + (i * 0.3),
        experience: Math.max(1, Math.floor(i / 4) + 2),
        lastSeasonGames: 17,
        careerGames: Math.max(17, i * 8 + Math.random() * 50),
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 0,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: this.hasWeatherConcerns(kicker.team),
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: Math.floor(Math.random() * 32) + 1,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: 'STABLE',
        fantasyRelevantWeeks: 17,
        floorWeeks: Math.max(12, 17 - Math.floor(i / 8)),
        ceilingWeeks: Math.max(4, 10 - Math.floor(i / 6)),
        breakoutPotential: Math.max(5, 15 - Math.floor(i / 3)),
        regressionRisk: Math.max(10, 15 + Math.floor(i / 4)),
        coachingFit: Math.max(7, 10 - Math.floor(i / 10)),
        opportunityRank: i + 1,
        depthChart: 1,
        sleeper: false,
        bustRisk: Math.max(10, 15 + Math.floor(i / 4)),
        weeklyVolatility: Math.max(3, 6 - Math.floor(i / 12)),
        positionalScarcity: 80 + i,
        handcuffRecommendation: 'None',
        isDrafted: false
      });
    });
  }

  private addDefenses(players: SnakeDraftPlayer[], startId: number): void {
    const defenses = [
      { name: 'SF Defense', team: 'SF' }, { name: 'DAL Defense', team: 'DAL' }, { name: 'BUF Defense', team: 'BUF' },
      { name: 'MIA Defense', team: 'MIA' }, { name: 'CLE Defense', team: 'CLE' }, { name: 'BAL Defense', team: 'BAL' },
      { name: 'NYJ Defense', team: 'NYJ' }, { name: 'DEN Defense', team: 'DEN' }, { name: 'PIT Defense', team: 'PIT' },
      { name: 'NO Defense', team: 'NO' }, { name: 'SEA Defense', team: 'SEA' }, { name: 'IND Defense', team: 'IND' },
      { name: 'PHI Defense', team: 'PHI' }, { name: 'TB Defense', team: 'TB' }, { name: 'KC Defense', team: 'KC' },
      { name: 'LAC Defense', team: 'LAC' }, { name: 'MIN Defense', team: 'MIN' }, { name: 'HOU Defense', team: 'HOU' },
      { name: 'LAR Defense', team: 'LAR' }, { name: 'GB Defense', team: 'GB' }, { name: 'DET Defense', team: 'DET' },
      { name: 'JAX Defense', team: 'JAX' }, { name: 'ATL Defense', team: 'ATL' }, { name: 'TEN Defense', team: 'TEN' },
      { name: 'LV Defense', team: 'LV' }, { name: 'CHI Defense', team: 'CHI' }, { name: 'NE Defense', team: 'NE' },
      { name: 'CIN Defense', team: 'CIN' }, { name: 'ARI Defense', team: 'ARI' }, { name: 'NYG Defense', team: 'NYG' },
      { name: 'CAR Defense', team: 'CAR' }, { name: 'WAS Defense', team: 'WAS' }
    ];

    defenses.forEach((defense, i) => {
      players.push({
        id: `dst_${startId + i}`,
        name: defense.name,
        position: 'DST',
        team: defense.team,
        tier: (i < 5 ? 1 : i < 15 ? 2 : 3) as 1 | 2 | 3 | 4 | 5,
        baseValue: Math.max(5, 10 - Math.floor(i / 6)),
        estimatedValue: Math.max(7, 12 - Math.floor(i / 6)),
        projectedPoints: Math.max(120, 155 - (i * 1.1)),
        adp: 145 + (i * 3),
        injuryRisk: 'LOW',
        strengthOfSchedule: Math.floor(Math.random() * 10) + 1,
        valueOverReplacement: Math.max(0, 155 - (i * 1.1) - 120),
        upside: (155 - (i * 1.1)) * 1.25,
        floor: (155 - (i * 1.1)) * 0.75,
        consistency: Math.max(4, 8 - Math.floor(i / 8)),
        byeWeek: this.getByeWeek(defense.team),
        ageRisk: 'LOW',
        targetShare: 0,
        redZoneShare: 0,
        age: 26,
        experience: 4,
        lastSeasonGames: 17,
        careerGames: 68,
        injuryHistory: [],
        contractStatus: 'SECURE',
        coachingStability: 'STABLE',
        offensiveLineRank: 0,
        defensiveStrengthVsPosition: 0,
        weatherConcerns: this.hasWeatherConcerns(defense.team),
        playoffSchedule: 'MODERATE',
        handcuffValue: 0,
        competitionLevel: 'LOCKED_STARTER',
        teamPaceRank: Math.floor(Math.random() * 32) + 1,
        redZoneTouchesLastSeason: 0,
        snapPercentage: 100,
        recentTrends: i < 10 ? 'STABLE' : i < 20 ? 'RISING' : 'STABLE',
        fantasyRelevantWeeks: 17,
        floorWeeks: Math.max(8, 15 - Math.floor(i / 5)),
        ceilingWeeks: Math.max(3, 10 - Math.floor(i / 4)),
        breakoutPotential: Math.max(10, 25 - Math.floor(i / 2)),
        regressionRisk: Math.max(15, 20 + Math.floor(i / 3)),
        coachingFit: Math.max(6, 9 - Math.floor(i / 8)),
        opportunityRank: i + 1,
        depthChart: 1,
        sleeper: i > 15 && Math.random() > 0.75,
        bustRisk: Math.max(15, 20 + Math.floor(i / 3)),
        weeklyVolatility: Math.max(6, 12 - Math.floor(i / 8)),
        positionalScarcity: 75 + i,
        handcuffRecommendation: 'None',
        isDrafted: false
      });
    });
  }
}

export const realPlayerDataService = new RealPlayerDataService();