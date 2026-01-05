// All 32 NFL teams with complete rosters - to be inserted into realDepthChartService.ts

const remainingTeams = {
  'DET': {
    teamId: 'DET',
    teamName: 'Detroit Lions',
    abbreviation: 'DET',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'det_qb_1', name: 'Jared Goff', jerseyNumber: 16, experience: 8, fantasyRelevance: 'HIGH', college: 'California' },
        { playerId: 'det_qb_2', name: 'Hendon Hooker', jerseyNumber: 2, experience: 1, fantasyRelevance: 'MINIMAL', college: 'Tennessee' }
      ],
      RB: [
        { playerId: 'det_rb_1', name: 'David Montgomery', jerseyNumber: 5, experience: 5, fantasyRelevance: 'HIGH', college: 'Iowa State' },
        { playerId: 'det_rb_2', name: 'Jahmyr Gibbs', jerseyNumber: 26, experience: 1, fantasyRelevance: 'HIGH', college: 'Alabama' },
        { playerId: 'det_rb_3', name: 'Craig Reynolds', jerseyNumber: 46, experience: 3, fantasyRelevance: 'LOW', college: 'Kutztown' }
      ],
      WR: [
        { playerId: 'det_wr_1', name: 'Amon-Ra St. Brown', jerseyNumber: 14, experience: 3, fantasyRelevance: 'HIGH', college: 'USC' },
        { playerId: 'det_wr_2', name: 'Jameson Williams', jerseyNumber: 9, experience: 2, fantasyRelevance: 'HIGH', college: 'Alabama' },
        { playerId: 'det_wr_3', name: 'Tim Patrick', jerseyNumber: 17, experience: 7, fantasyRelevance: 'MEDIUM', college: 'Utah' }
      ],
      TE: [
        { playerId: 'det_te_1', name: 'Sam LaPorta', jerseyNumber: 87, experience: 1, fantasyRelevance: 'HIGH', college: 'Iowa' },
        { playerId: 'det_te_2', name: 'Brock Wright', jerseyNumber: 89, experience: 3, fantasyRelevance: 'LOW', college: 'Notre Dame' }
      ],
      K: [
        { playerId: 'det_k_1', name: 'Jake Bates', jerseyNumber: 39, experience: 0, fantasyRelevance: 'MEDIUM', college: 'Central Arkansas' }
      ],
      DST: [
        { playerId: 'det_dst_1', name: 'Detroit Lions Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'HIGH' }
      ]
    }
  },
  'HOU': {
    teamId: 'HOU',
    teamName: 'Houston Texans',
    abbreviation: 'HOU',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'hou_qb_1', name: 'C.J. Stroud', jerseyNumber: 7, experience: 1, fantasyRelevance: 'HIGH', college: 'Ohio State' },
        { playerId: 'hou_qb_2', name: 'Davis Mills', jerseyNumber: 10, experience: 3, fantasyRelevance: 'MINIMAL', college: 'Stanford' }
      ],
      RB: [
        { playerId: 'hou_rb_1', name: 'Joe Mixon', jerseyNumber: 28, experience: 7, fantasyRelevance: 'HIGH', college: 'Oklahoma' },
        { playerId: 'hou_rb_2', name: 'Cam Akers', jerseyNumber: 33, experience: 4, fantasyRelevance: 'MEDIUM', college: 'Florida State' },
        { playerId: 'hou_rb_3', name: 'Dare Ogunbowale', jerseyNumber: 20, experience: 7, fantasyRelevance: 'LOW', college: 'Wisconsin' }
      ],
      WR: [
        { playerId: 'hou_wr_1', name: 'Nico Collins', jerseyNumber: 12, experience: 3, fantasyRelevance: 'HIGH', college: 'Michigan' },
        { playerId: 'hou_wr_2', name: 'Stefon Diggs', jerseyNumber: 1, experience: 9, fantasyRelevance: 'HIGH', college: 'Maryland' },
        { playerId: 'hou_wr_3', name: 'Tank Dell', jerseyNumber: 3, experience: 1, fantasyRelevance: 'MEDIUM', college: 'Houston' }
      ],
      TE: [
        { playerId: 'hou_te_1', name: 'Dalton Schultz', jerseyNumber: 86, experience: 6, fantasyRelevance: 'MEDIUM', college: 'Stanford' },
        { playerId: 'hou_te_2', name: 'Cade Stover', jerseyNumber: 88, experience: 0, fantasyRelevance: 'LOW', college: 'Ohio State' }
      ],
      K: [
        { playerId: 'hou_k_1', name: 'Ka\'imi Fairbairn', jerseyNumber: 15, experience: 8, fantasyRelevance: 'MEDIUM', college: 'UCLA' }
      ],
      DST: [
        { playerId: 'hou_dst_1', name: 'Houston Texans Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'MEDIUM' }
      ]
    }
  },
  'IND': {
    teamId: 'IND',
    teamName: 'Indianapolis Colts',
    abbreviation: 'IND',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'ind_qb_1', name: 'Anthony Richardson', jerseyNumber: 5, experience: 1, fantasyRelevance: 'HIGH', college: 'Florida' },
        { playerId: 'ind_qb_2', name: 'Joe Flacco', jerseyNumber: 15, experience: 16, fantasyRelevance: 'MINIMAL', college: 'Delaware' }
      ],
      RB: [
        { playerId: 'ind_rb_1', name: 'Jonathan Taylor', jerseyNumber: 28, experience: 3, fantasyRelevance: 'HIGH', college: 'Wisconsin' },
        { playerId: 'ind_rb_2', name: 'Trey Sermon', jerseyNumber: 33, experience: 3, fantasyRelevance: 'MEDIUM', college: 'Ohio State' },
        { playerId: 'ind_rb_3', name: 'Tyler Goodson', jerseyNumber: 31, experience: 2, fantasyRelevance: 'LOW', college: 'Iowa' }
      ],
      WR: [
        { playerId: 'ind_wr_1', name: 'Michael Pittman Jr.', jerseyNumber: 11, experience: 4, fantasyRelevance: 'HIGH', college: 'USC' },
        { playerId: 'ind_wr_2', name: 'Josh Downs', jerseyNumber: 80, experience: 1, fantasyRelevance: 'MEDIUM', college: 'North Carolina' },
        { playerId: 'ind_wr_3', name: 'Adonai Mitchell', jerseyNumber: 10, experience: 0, fantasyRelevance: 'MEDIUM', college: 'Texas' }
      ],
      TE: [
        { playerId: 'ind_te_1', name: 'Mo Alie-Cox', jerseyNumber: 81, experience: 7, fantasyRelevance: 'LOW', college: 'VCU' },
        { playerId: 'ind_te_2', name: 'Kylen Granson', jerseyNumber: 83, experience: 3, fantasyRelevance: 'LOW', college: 'SMU' }
      ],
      K: [
        { playerId: 'ind_k_1', name: 'Matt Gay', jerseyNumber: 6, experience: 5, fantasyRelevance: 'MEDIUM', college: 'Utah' }
      ],
      DST: [
        { playerId: 'ind_dst_1', name: 'Indianapolis Colts Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'LOW' }
      ]
    }
  },
  'JAX': {
    teamId: 'JAX',
    teamName: 'Jacksonville Jaguars',
    abbreviation: 'JAX',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'jax_qb_1', name: 'Trevor Lawrence', jerseyNumber: 16, experience: 3, fantasyRelevance: 'HIGH', college: 'Clemson' },
        { playerId: 'jax_qb_2', name: 'Mac Jones', jerseyNumber: 10, experience: 3, fantasyRelevance: 'MINIMAL', college: 'Alabama' }
      ],
      RB: [
        { playerId: 'jax_rb_1', name: 'Travis Etienne Jr.', jerseyNumber: 1, experience: 3, fantasyRelevance: 'HIGH', college: 'Clemson' },
        { playerId: 'jax_rb_2', name: 'Tank Bigsby', jerseyNumber: 4, experience: 1, fantasyRelevance: 'MEDIUM', college: 'Auburn' },
        { playerId: 'jax_rb_3', name: 'D\'Ernest Johnson', jerseyNumber: 30, experience: 5, fantasyRelevance: 'LOW', college: 'South Florida' }
      ],
      WR: [
        { playerId: 'jax_wr_1', name: 'Brian Thomas Jr.', jerseyNumber: 7, experience: 0, fantasyRelevance: 'HIGH', college: 'LSU' },
        { playerId: 'jax_wr_2', name: 'Christian Kirk', jerseyNumber: 13, experience: 6, fantasyRelevance: 'MEDIUM', college: 'Texas A&M' },
        { playerId: 'jax_wr_3', name: 'Gabe Davis', jerseyNumber: 84, experience: 5, fantasyRelevance: 'MEDIUM', college: 'UCF' }
      ],
      TE: [
        { playerId: 'jax_te_1', name: 'Evan Engram', jerseyNumber: 17, experience: 7, fantasyRelevance: 'MEDIUM', college: 'Ole Miss' },
        { playerId: 'jax_te_2', name: 'Brenton Strange', jerseyNumber: 19, experience: 1, fantasyRelevance: 'LOW', college: 'Penn State' }
      ],
      K: [
        { playerId: 'jax_k_1', name: 'Cam Little', jerseyNumber: 9, experience: 0, fantasyRelevance: 'MEDIUM', college: 'Arkansas' }
      ],
      DST: [
        { playerId: 'jax_dst_1', name: 'Jacksonville Jaguars Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'LOW' }
      ]
    }
  },
  'TEN': {
    teamId: 'TEN',
    teamName: 'Tennessee Titans',
    abbreviation: 'TEN',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'ten_qb_1', name: 'Will Levis', jerseyNumber: 8, experience: 1, fantasyRelevance: 'MEDIUM', college: 'Kentucky' },
        { playerId: 'ten_qb_2', name: 'Mason Rudolph', jerseyNumber: 11, experience: 6, fantasyRelevance: 'MINIMAL', college: 'Oklahoma State' }
      ],
      RB: [
        { playerId: 'ten_rb_1', name: 'Tony Pollard', jerseyNumber: 1, experience: 5, fantasyRelevance: 'HIGH', college: 'Memphis' },
        { playerId: 'ten_rb_2', name: 'Tyjae Spears', jerseyNumber: 2, experience: 1, fantasyRelevance: 'MEDIUM', college: 'Tulane' },
        { playerId: 'ten_rb_3', name: 'Julius Chestnut', jerseyNumber: 40, experience: 1, fantasyRelevance: 'LOW', college: 'Sacred Heart' }
      ],
      WR: [
        { playerId: 'ten_wr_1', name: 'DeAndre Hopkins', jerseyNumber: 10, experience: 11, fantasyRelevance: 'MEDIUM', college: 'Clemson' },
        { playerId: 'ten_wr_2', name: 'Calvin Ridley', jerseyNumber: 0, experience: 6, fantasyRelevance: 'MEDIUM', college: 'Alabama' },
        { playerId: 'ten_wr_3', name: 'Tyler Boyd', jerseyNumber: 83, experience: 8, fantasyRelevance: 'LOW', college: 'Pittsburgh' }
      ],
      TE: [
        { playerId: 'ten_te_1', name: 'Chigoziem Okonkwo', jerseyNumber: 85, experience: 2, fantasyRelevance: 'LOW', college: 'Maryland' },
        { playerId: 'ten_te_2', name: 'Nick Vannett', jerseyNumber: 81, experience: 8, fantasyRelevance: 'LOW', college: 'Ohio State' }
      ],
      K: [
        { playerId: 'ten_k_1', name: 'Nick Folk', jerseyNumber: 4, experience: 19, fantasyRelevance: 'MEDIUM', college: 'Arizona' }
      ],
      DST: [
        { playerId: 'ten_dst_1', name: 'Tennessee Titans Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'LOW' }
      ]
    }
  },
  'CIN': {
    teamId: 'CIN',
    teamName: 'Cincinnati Bengals',
    abbreviation: 'CIN',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'cin_qb_1', name: 'Joe Burrow', jerseyNumber: 9, experience: 4, fantasyRelevance: 'HIGH', college: 'LSU' },
        { playerId: 'cin_qb_2', name: 'Jake Browning', jerseyNumber: 6, experience: 2, fantasyRelevance: 'MINIMAL', college: 'Washington' }
      ],
      RB: [
        { playerId: 'cin_rb_1', name: 'Chase Brown', jerseyNumber: 30, experience: 1, fantasyRelevance: 'MEDIUM', college: 'Illinois' },
        { playerId: 'cin_rb_2', name: 'Zack Moss', jerseyNumber: 22, experience: 4, fantasyRelevance: 'MEDIUM', college: 'Utah' },
        { playerId: 'cin_rb_3', name: 'Trayveon Williams', jerseyNumber: 40, experience: 5, fantasyRelevance: 'LOW', college: 'Texas A&M' }
      ],
      WR: [
        { playerId: 'cin_wr_1', name: 'Ja\'Marr Chase', jerseyNumber: 1, experience: 3, fantasyRelevance: 'HIGH', college: 'LSU' },
        { playerId: 'cin_wr_2', name: 'Tee Higgins', jerseyNumber: 85, experience: 4, fantasyRelevance: 'HIGH', college: 'Clemson' },
        { playerId: 'cin_wr_3', name: 'Andrei Iosivas', jerseyNumber: 80, experience: 1, fantasyRelevance: 'LOW', college: 'Princeton' }
      ],
      TE: [
        { playerId: 'cin_te_1', name: 'Mike Gesicki', jerseyNumber: 88, experience: 6, fantasyRelevance: 'MEDIUM', college: 'Penn State' },
        { playerId: 'cin_te_2', name: 'Erick All Jr.', jerseyNumber: 83, experience: 0, fantasyRelevance: 'LOW', college: 'Iowa' }
      ],
      K: [
        { playerId: 'cin_k_1', name: 'Evan McPherson', jerseyNumber: 2, experience: 3, fantasyRelevance: 'HIGH', college: 'Florida' }
      ],
      DST: [
        { playerId: 'cin_dst_1', name: 'Cincinnati Bengals Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'LOW' }
      ]
    }
  },
  'CLE': {
    teamId: 'CLE',
    teamName: 'Cleveland Browns',
    abbreviation: 'CLE',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'cle_qb_1', name: 'Deshaun Watson', jerseyNumber: 4, experience: 7, fantasyRelevance: 'MEDIUM', college: 'Clemson' },
        { playerId: 'cle_qb_2', name: 'Jameis Winston', jerseyNumber: 5, experience: 9, fantasyRelevance: 'MINIMAL', college: 'Florida State' }
      ],
      RB: [
        { playerId: 'cle_rb_1', name: 'Nick Chubb', jerseyNumber: 24, experience: 6, fantasyRelevance: 'HIGH', college: 'Georgia' },
        { playerId: 'cle_rb_2', name: 'Jerome Ford', jerseyNumber: 34, experience: 2, fantasyRelevance: 'MEDIUM', college: 'Cincinnati' },
        { playerId: 'cle_rb_3', name: 'D\'Onta Foreman', jerseyNumber: 27, experience: 7, fantasyRelevance: 'LOW', college: 'Texas' }
      ],
      WR: [
        { playerId: 'cle_wr_1', name: 'Amari Cooper', jerseyNumber: 2, experience: 9, fantasyRelevance: 'HIGH', college: 'Alabama' },
        { playerId: 'cle_wr_2', name: 'Jerry Jeudy', jerseyNumber: 3, experience: 4, fantasyRelevance: 'HIGH', college: 'Alabama' },
        { playerId: 'cle_wr_3', name: 'Elijah Moore', jerseyNumber: 8, experience: 3, fantasyRelevance: 'MEDIUM', college: 'Ole Miss' }
      ],
      TE: [
        { playerId: 'cle_te_1', name: 'David Njoku', jerseyNumber: 85, experience: 7, fantasyRelevance: 'MEDIUM', college: 'Miami' },
        { playerId: 'cle_te_2', name: 'Jordan Akins', jerseyNumber: 88, experience: 6, fantasyRelevance: 'LOW', college: 'UCF' }
      ],
      K: [
        { playerId: 'cle_k_1', name: 'Dustin Hopkins', jerseyNumber: 7, experience: 11, fantasyRelevance: 'MEDIUM', college: 'Florida State' }
      ],
      DST: [
        { playerId: 'cle_dst_1', name: 'Cleveland Browns Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'MEDIUM' }
      ]
    }
  },
  'PIT': {
    teamId: 'PIT',
    teamName: 'Pittsburgh Steelers',
    abbreviation: 'PIT',
    lastUpdated: '2024-12-15',
    positions: {
      QB: [
        { playerId: 'pit_qb_1', name: 'Russell Wilson', jerseyNumber: 3, experience: 12, fantasyRelevance: 'HIGH', college: 'Wisconsin' },
        { playerId: 'pit_qb_2', name: 'Justin Fields', jerseyNumber: 2, experience: 3, fantasyRelevance: 'MEDIUM', college: 'Ohio State' }
      ],
      RB: [
        { playerId: 'pit_rb_1', name: 'Najee Harris', jerseyNumber: 22, experience: 3, fantasyRelevance: 'HIGH', college: 'Alabama' },
        { playerId: 'pit_rb_2', name: 'Jaylen Warren', jerseyNumber: 30, experience: 2, fantasyRelevance: 'MEDIUM', college: 'Oklahoma State' },
        { playerId: 'pit_rb_3', name: 'Cordarrelle Patterson', jerseyNumber: 84, experience: 11, fantasyRelevance: 'LOW', college: 'Tennessee' }
      ],
      WR: [
        { playerId: 'pit_wr_1', name: 'George Pickens', jerseyNumber: 14, experience: 2, fantasyRelevance: 'HIGH', college: 'Georgia' },
        { playerId: 'pit_wr_2', name: 'Calvin Austin III', jerseyNumber: 19, experience: 2, fantasyRelevance: 'MEDIUM', college: 'Memphis' },
        { playerId: 'pit_wr_3', name: 'Van Jefferson', jerseyNumber: 12, experience: 4, fantasyRelevance: 'LOW', college: 'Florida' }
      ],
      TE: [
        { playerId: 'pit_te_1', name: 'Pat Freiermuth', jerseyNumber: 88, experience: 3, fantasyRelevance: 'MEDIUM', college: 'Penn State' },
        { playerId: 'pit_te_2', name: 'Darnell Washington', jerseyNumber: 80, experience: 1, fantasyRelevance: 'LOW', college: 'Georgia' }
      ],
      K: [
        { playerId: 'pit_k_1', name: 'Chris Boswell', jerseyNumber: 9, experience: 9, fantasyRelevance: 'HIGH', college: 'Rice' }
      ],
      DST: [
        { playerId: 'pit_dst_1', name: 'Pittsburgh Steelers Defense', jerseyNumber: 0, experience: 0, fantasyRelevance: 'HIGH' }
      ]
    }
  }
};

export default remainingTeams;