import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuctionDraftService, Player, Team, DraftAnalytics } from '@/services/auctionDraftService';
import '@/styles/bloomberg-terminal.css';

interface BloombergDraftInterfaceProps {
  draftService: AuctionDraftService;
}

// Function Key Configuration
const FUNCTION_KEYS = [
  { key: 'F1', label: 'HELP', action: 'help' },
  { key: 'F2', label: 'NEWS', action: 'news' },
  { key: 'F3', label: 'CHART', action: 'chart' },
  { key: 'F4', label: 'ALERT', action: 'alerts' },
  { key: 'F5', label: 'DRAFT', action: 'draft' },
  { key: 'F6', label: 'TEAMS', action: 'teams' },
  { key: 'F7', label: 'ANAL', action: 'analytics' },
  { key: 'F8', label: 'TRADE', action: 'trade' },
];

// Mock news data
const generateNews = (players: Player[]) => {
  const newsTemplates = [
    { type: 'injury', template: (p: Player) => `${p.name} (${p.team}) - ${p.injuryRisk === 'HIGH' ? 'Listed questionable for Week 1' : 'Full practice participant'}`, priority: 'high' },
    { type: 'depth', template: (p: Player) => `${p.name} taking first-team reps in ${p.team} practice`, priority: 'medium' },
    { type: 'contract', template: (p: Player) => `${p.name} contract status: ${p.contractStatus} - Fantasy implications`, priority: 'low' },
    { type: 'trend', template: (p: Player) => `${p.name} ${p.recentTrends === 'RISING' ? 'stock rising' : p.recentTrends === 'DECLINING' ? 'value declining' : 'holding steady'} in camp`, priority: 'medium' },
    { type: 'coach', template: (p: Player) => `${p.team} ${p.coachingStability === 'NEW_COACH' ? 'new coaching staff impacts' : 'offensive scheme unchanged for'} ${p.name}`, priority: 'medium' },
  ];

  return players.slice(0, 20).map((p, i) => {
    const template = newsTemplates[i % newsTemplates.length];
    return {
      id: i,
      text: template.template(p),
      time: `${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
      priority: template.priority,
      type: template.type,
    };
  });
};

export const BloombergDraftInterface: React.FC<BloombergDraftInterfaceProps> = ({ draftService }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [draftedPlayers, setDraftedPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerAnalytics, setPlayerAnalytics] = useState<DraftAnalytics | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [bidAmount, setBidAmount] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState(0);
  const [sortBy, setSortBy] = useState<'adp' | 'value' | 'proj' | 'name' | 'vorp' | 'upside'>('adp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alerts, setAlerts] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<string>('draft');
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedTeamView, setSelectedTeamView] = useState<string>('');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [customAlerts, setCustomAlerts] = useState<Array<{ playerId: string; maxBid: number; triggered: boolean }>>([]);
  const [tradeTeam1, setTradeTeam1] = useState<string>('');
  const [tradeTeam2, setTradeTeam2] = useState<string>('');
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlayers, setComparePlayers] = useState<Player[]>([]);

  // Initialize data
  useEffect(() => {
    const allPlayers = draftService.getPlayers();
    setPlayers(allPlayers);
    setFilteredPlayers(allPlayers.filter(p => !p.isDrafted));
    setDraftedPlayers(allPlayers.filter(p => p.isDrafted));
    setTeams(draftService.getDraftState().teams);
  }, [draftService]);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter and sort players
  useEffect(() => {
    let filtered = players.filter(p => !p.isDrafted);

    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      filtered = filtered.filter(p =>
        p.name.toUpperCase().includes(query) ||
        p.team.toUpperCase().includes(query)
      );
    }

    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }

    if (tierFilter > 0) {
      filtered = filtered.filter(p => p.tier === tierFilter);
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'adp': cmp = a.adp - b.adp; break;
        case 'value': cmp = b.estimatedValue - a.estimatedValue; break;
        case 'proj': cmp = b.projectedPoints - a.projectedPoints; break;
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'vorp': cmp = b.valueOverReplacement - a.valueOverReplacement; break;
        case 'upside': cmp = b.upside - a.upside; break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    setFilteredPlayers(filtered);
  }, [players, searchQuery, positionFilter, tierFilter, sortBy, sortDir]);

  // Handle player selection with analytics
  const handlePlayerSelect = useCallback((player: Player) => {
    if (compareMode) {
      setComparePlayers(prev => {
        if (prev.find(p => p.id === player.id)) {
          return prev.filter(p => p.id !== player.id);
        }
        if (prev.length >= 4) return prev;
        return [...prev, player];
      });
      return;
    }

    setSelectedPlayer(player);
    const analytics = draftService.getPlayerAnalytics(player.id);
    setPlayerAnalytics(analytics);

    const draftProgress = draftedPlayers.length / players.length;
    const available = players.filter(p => p.position === player.position && !p.isDrafted).length;
    const total = players.filter(p => p.position === player.position).length;
    const scarcity = 1 - (available / total);

    let dynamicBid = analytics?.openingBid || player.estimatedValue;
    if (draftProgress > 0.5) dynamicBid += Math.round(dynamicBid * 0.1);
    if (draftProgress > 0.7) dynamicBid += Math.round(dynamicBid * 0.15);
    if (scarcity > 0.6) dynamicBid += Math.round(dynamicBid * 0.2);

    setBidAmount(dynamicBid.toString());
    setShowPlayerModal(true);
  }, [draftService, draftedPlayers.length, players, compareMode]);

  // Handle draft
  const handleDraft = useCallback(() => {
    if (!selectedPlayer || !selectedTeam || !bidAmount) return;

    const cost = parseInt(bidAmount);
    const success = draftService.draftPlayer(selectedPlayer.id, selectedTeam, cost);

    if (success) {
      const allPlayers = draftService.getPlayers();
      setPlayers(allPlayers);
      setDraftedPlayers(allPlayers.filter(p => p.isDrafted));
      setTeams(draftService.getDraftState().teams);
      setAlerts(prev => [`EXEC: ${selectedPlayer.name} → ${teams.find(t => t.id === selectedTeam)?.name} $${cost}`, ...prev.slice(0, 49)]);
      setSelectedPlayer(null);
      setSelectedTeam('');
      setBidAmount('');
      setShowPlayerModal(false);
    }
  }, [selectedPlayer, selectedTeam, bidAmount, draftService, teams]);

  // Handle command input
  const handleCommand = (cmd: string) => {
    const command = cmd.toUpperCase().trim();
    if (command.startsWith('POS ')) {
      setPositionFilter(command.split(' ')[1] || 'ALL');
    } else if (command.startsWith('TIER ')) {
      setTierFilter(parseInt(command.split(' ')[1]) || 0);
    } else if (command === 'CLEAR') {
      setSearchQuery('');
      setPositionFilter('ALL');
      setTierFilter(0);
    } else if (command === 'SIM') {
      setIsSimulating(!isSimulating);
    } else if (command === 'COMPARE') {
      setCompareMode(!compareMode);
      setComparePlayers([]);
    } else {
      setSearchQuery(cmd);
    }
  };

  // Simulate draft
  useEffect(() => {
    if (!isSimulating) return;

    const timer = setInterval(() => {
      const available = draftService.getAvailablePlayers();
      if (available.length === 0) {
        setIsSimulating(false);
        return;
      }

      const randomPlayer = available[Math.floor(Math.random() * Math.min(20, available.length))];
      const randomTeam = teams[Math.floor(Math.random() * teams.length)];
      const bidMultiplier = 0.8 + Math.random() * 0.4;
      const bid = Math.max(1, Math.round(randomPlayer.estimatedValue * bidMultiplier));

      draftService.draftPlayer(randomPlayer.id, randomTeam.id, bid);
      const allPlayers = draftService.getPlayers();
      setPlayers(allPlayers);
      setDraftedPlayers(allPlayers.filter(p => p.isDrafted));
      setTeams(draftService.getDraftState().teams);
      setAlerts(prev => [`AUTO: ${randomPlayer.name} → ${randomTeam.name} $${bid}`, ...prev.slice(0, 49)]);
    }, 1200);

    return () => clearInterval(timer);
  }, [isSimulating, draftService, teams]);

  // Generated news
  const news = useMemo(() => generateNews(players), [players]);

  // Comprehensive stats
  const draftStats = useMemo(() => {
    const totalBudget = teams.reduce((sum, t) => sum + t.budget, 0);
    const remainingBudget = teams.reduce((sum, t) => sum + t.remaining, 0);
    const avgBid = draftedPlayers.length > 0
      ? Math.round(draftedPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0) / draftedPlayers.length)
      : 0;

    const positionSpending: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    draftedPlayers.forEach(p => {
      if (positionSpending[p.position] !== undefined) {
        positionSpending[p.position] += p.draftCost || 0;
      }
    });

    const valueEfficiency = draftedPlayers.length > 0
      ? Math.round((draftedPlayers.reduce((sum, p) => sum + p.estimatedValue, 0) /
          draftedPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0)) * 100)
      : 100;

    return {
      totalPlayers: players.length,
      drafted: draftedPlayers.length,
      remaining: players.length - draftedPlayers.length,
      progress: Math.round((draftedPlayers.length / players.length) * 100),
      avgCost: avgBid,
      totalSpent: totalBudget - remainingBudget,
      totalBudget,
      remainingBudget,
      positionSpending,
      valueEfficiency,
      burnRate: draftedPlayers.length > 0 ? Math.round((totalBudget - remainingBudget) / draftedPlayers.length) : 0,
    };
  }, [players, draftedPlayers, teams]);

  // Position breakdown with comprehensive metrics
  const positionBreakdown = useMemo(() => {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    return positions.map(pos => {
      const posPlayers = players.filter(p => p.position === pos);
      const available = posPlayers.filter(p => !p.isDrafted);
      const drafted = posPlayers.filter(p => p.isDrafted);

      const tierBreakdown = [1, 2, 3, 4].map(tier => ({
        tier,
        total: posPlayers.filter(p => p.tier === tier).length,
        available: available.filter(p => p.tier === tier).length,
      }));

      const avgValue = available.length > 0
        ? Math.round(available.reduce((sum, p) => sum + p.estimatedValue, 0) / available.length)
        : 0;

      const avgProj = available.length > 0
        ? Math.round(available.reduce((sum, p) => sum + p.projectedPoints, 0) / available.length)
        : 0;

      const scarcityScore = Math.round((1 - (available.length / posPlayers.length)) * 100);

      return {
        position: pos,
        total: posPlayers.length,
        drafted: drafted.length,
        available: available.length,
        avgValue,
        avgProj,
        scarcityScore,
        tierBreakdown,
        topAvailable: available.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 3),
        recentPicks: drafted.slice(-3),
        avgDraftCost: drafted.length > 0
          ? Math.round(drafted.reduce((sum, p) => sum + (p.draftCost || 0), 0) / drafted.length)
          : 0,
        valueTrend: drafted.length >= 2
          ? (drafted[drafted.length - 1].draftCost || 0) > (drafted[drafted.length - 2].draftCost || 0)
            ? 'RISING'
            : 'FALLING'
          : 'STABLE',
      };
    });
  }, [players]);

  // Team analytics
  const teamAnalytics = useMemo(() => {
    return teams.map(team => {
      const teamPlayers = draftedPlayers.filter(p => p.draftedBy === team.id);
      const totalProj = teamPlayers.reduce((sum, p) => sum + p.projectedPoints, 0);
      const totalValue = teamPlayers.reduce((sum, p) => sum + p.estimatedValue, 0);
      const totalSpent = teamPlayers.reduce((sum, p) => sum + (p.draftCost || 0), 0);

      const positionCounts = { QB: 0, RB: 0, WR: 0, TE: 0 };
      const positionSpend = { QB: 0, RB: 0, WR: 0, TE: 0 };
      teamPlayers.forEach(p => {
        if (positionCounts[p.position as keyof typeof positionCounts] !== undefined) {
          positionCounts[p.position as keyof typeof positionCounts]++;
          positionSpend[p.position as keyof typeof positionSpend] += p.draftCost || 0;
        }
      });

      const needs: string[] = [];
      if (positionCounts.QB < 1) needs.push('QB');
      if (positionCounts.RB < 2) needs.push('RB');
      if (positionCounts.WR < 2) needs.push('WR');
      if (positionCounts.TE < 1) needs.push('TE');

      const valueEfficiency = totalSpent > 0 ? Math.round((totalValue / totalSpent) * 100) : 100;
      const projPerDollar = totalSpent > 0 ? (totalProj / totalSpent).toFixed(2) : '0.00';

      const riskScore = teamPlayers.reduce((sum, p) => {
        let risk = 0;
        if (p.injuryRisk === 'HIGH') risk += 3;
        else if (p.injuryRisk === 'MEDIUM') risk += 1;
        if (p.ageRisk === 'HIGH') risk += 2;
        else if (p.ageRisk === 'MEDIUM') risk += 1;
        return sum + risk;
      }, 0);

      const avgAge = teamPlayers.length > 0
        ? (teamPlayers.reduce((sum, p) => sum + p.age, 0) / teamPlayers.length).toFixed(1)
        : '0.0';

      // Enhanced Team Scores
      const strengthScore = teamPlayers.reduce((sum, p) => {
        // Score based on tier and value
        let strength = 0;
        if (p.tier === 1) strength += 25;
        else if (p.tier === 2) strength += 15;
        else if (p.tier === 3) strength += 8;
        else strength += 3;
        strength += Math.min(p.valueOverReplacement / 10, 10);
        return sum + strength;
      }, 0);

      const depthScore = (() => {
        let score = 0;
        // Score based on positional depth
        if (positionCounts.QB >= 2) score += 15;
        else if (positionCounts.QB >= 1) score += 10;
        if (positionCounts.RB >= 4) score += 25;
        else if (positionCounts.RB >= 3) score += 20;
        else if (positionCounts.RB >= 2) score += 10;
        if (positionCounts.WR >= 4) score += 25;
        else if (positionCounts.WR >= 3) score += 20;
        else if (positionCounts.WR >= 2) score += 10;
        if (positionCounts.TE >= 2) score += 15;
        else if (positionCounts.TE >= 1) score += 10;
        // Bonus for elite handcuffs
        teamPlayers.forEach(p => {
          if (p.handcuffValue > 50) score += 5;
        });
        return Math.min(score, 100);
      })();

      const injuryInsurance = (() => {
        if (teamPlayers.length === 0) return 0;
        // Calculate based on injury risk distribution and depth
        const lowRisk = teamPlayers.filter(p => p.injuryRisk === 'LOW').length;
        const highRisk = teamPlayers.filter(p => p.injuryRisk === 'HIGH').length;
        const baseScore = Math.round((lowRisk / teamPlayers.length) * 50);
        const depthBonus = Math.min(depthScore / 2, 25);
        const riskPenalty = highRisk * 5;
        return Math.max(0, Math.min(100, baseScore + depthBonus - riskPenalty + 25));
      })();

      // Bye week analysis
      const byeWeeks = teamPlayers.map(p => p.byeWeek);
      const byeWeekCounts: Record<number, number> = {};
      byeWeeks.forEach(bw => {
        byeWeekCounts[bw] = (byeWeekCounts[bw] || 0) + 1;
      });
      const maxByeConflict = Math.max(...Object.values(byeWeekCounts), 0);
      const worstByeWeek = Object.entries(byeWeekCounts).sort((a, b) => b[1] - a[1])[0];

      // Consistency score
      const consistencyScore = teamPlayers.length > 0
        ? Math.round(teamPlayers.reduce((sum, p) => sum + p.consistency, 0) / teamPlayers.length * 10)
        : 0;

      // Upside score
      const upsideScore = teamPlayers.reduce((sum, p) => sum + (p.upside - p.floor), 0);

      return {
        ...team,
        players: teamPlayers,
        totalProj,
        totalValue,
        totalSpent,
        positionCounts,
        positionSpend,
        needs,
        valueEfficiency,
        projPerDollar,
        riskScore,
        avgAge,
        grade: valueEfficiency >= 110 ? 'A' : valueEfficiency >= 100 ? 'B' : valueEfficiency >= 90 ? 'C' : 'D',
        // Enhanced metrics
        strengthScore: Math.round(strengthScore),
        depthScore,
        injuryInsurance,
        byeWeekCounts,
        maxByeConflict,
        worstByeWeek: worstByeWeek ? { week: parseInt(worstByeWeek[0]), count: worstByeWeek[1] } : null,
        consistencyScore,
        upsideScore: Math.round(upsideScore),
        avgFloor: teamPlayers.length > 0 ? Math.round(teamPlayers.reduce((s, p) => s + p.floor, 0) / teamPlayers.length) : 0,
        avgCeiling: teamPlayers.length > 0 ? Math.round(teamPlayers.reduce((s, p) => s + p.upside, 0) / teamPlayers.length) : 0,
      };
    });
  }, [teams, draftedPlayers]);

  // Ticker data
  const tickerData = useMemo(() => {
    const items: Array<{ text: string; type: string; color: string }> = [];

    // Add scarcity alerts
    positionBreakdown.forEach(pb => {
      if (pb.scarcityScore > 70) {
        items.push({
          text: `⚠ ${pb.position} SCARCITY ${pb.scarcityScore}% - ${pb.available} LEFT`,
          type: 'alert',
          color: '#ff3333',
        });
      }
    });

    // Add top values
    filteredPlayers.slice(0, 10).forEach(p => {
      items.push({
        text: `${p.position} ${p.name} $${p.estimatedValue} ADP:${p.adp} VORP:${p.valueOverReplacement}`,
        type: 'player',
        color: '#ffaa00',
      });
    });

    // Add recent picks
    draftedPlayers.slice(-5).reverse().forEach(p => {
      items.push({
        text: `PICK: ${p.name} → ${teams.find(t => t.id === p.draftedBy)?.name} $${p.draftCost}`,
        type: 'pick',
        color: '#00d26a',
      });
    });

    return items;
  }, [filteredPlayers, draftedPlayers, positionBreakdown, teams]);

  // Utility functions
  const getPositionClass = (pos: string) => pos.toLowerCase();
  const getRiskColor = (risk: string) => {
    if (risk === 'LOW') return '#00d26a';
    if (risk === 'MEDIUM') return '#ffaa00';
    return '#ff3333';
  };
  const getTrendClass = (player: Player) => {
    if (player.recentTrends === 'RISING') return 'up';
    if (player.recentTrends === 'DECLINING') return 'down';
    return 'neutral';
  };

  // Render mini bar chart
  const renderMiniChart = (value: number, max: number, color: string, height = 12) => (
    <div style={{ width: '100%', height: `${height}px`, background: '#000', border: '1px solid #333', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color }} />
    </div>
  );

  // Render vertical bar chart
  const renderVerticalBars = (data: Array<{ label: string; value: number; max: number; color: string }>, height = 60) => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: `${height}px` }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', height: `${(d.value / d.max) * height}px`, background: d.color, minHeight: '2px' }} />
          <span style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );

  // Panel header component
  const PanelHeader = ({ title, subtitle, extra }: { title: string; subtitle?: string; extra?: React.ReactNode }) => (
    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span className="panel-title">{title}</span>
        {subtitle && <span style={{ color: '#666', fontSize: '10px', marginLeft: '8px' }}>{subtitle}</span>}
      </div>
      {extra}
    </div>
  );

  // Data row component
  const DataRow = ({ label, value, color = '#fff', highlight = false }: { label: string; value: string | number; color?: string; highlight?: boolean }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 0',
      borderBottom: '1px solid #1a1a1a',
      background: highlight ? 'rgba(255,102,0,0.1)' : 'transparent',
    }}>
      <span style={{ color: '#666', fontSize: '10px' }}>{label}</span>
      <span style={{ color, fontSize: '10px', fontWeight: 600 }}>{value}</span>
    </div>
  );

  // Render the Help Panel (F1)
  const renderHelpPanel = () => (
    <div className="terminal-panel" style={{ gridColumn: 'span 3', gridRow: 'span 2' }}>
      <PanelHeader title="DRAFT VAULT TERMINAL - HELP SYSTEM" subtitle="v2.0" />
      <div className="panel-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div>
          <div style={{ color: '#ff6600', fontSize: '11px', fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>FUNCTION KEYS</div>
          {FUNCTION_KEYS.map(fk => (
            <div key={fk.key} style={{ marginBottom: '6px', fontSize: '10px' }}>
              <span style={{ color: '#ff6600', fontWeight: 600 }}>{fk.key}</span>
              <span style={{ color: '#666' }}> - </span>
              <span style={{ color: '#b0b0b0' }}>{fk.label}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ color: '#ff6600', fontSize: '11px', fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>COMMANDS</div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>POS [QB/RB/WR/TE]</span> <span style={{ color: '#666' }}>- Filter by position</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>TIER [1-4]</span> <span style={{ color: '#666' }}>- Filter by tier</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>SIM</span> <span style={{ color: '#666' }}>- Toggle simulation</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>COMPARE</span> <span style={{ color: '#666' }}>- Toggle compare mode</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>CLEAR</span> <span style={{ color: '#666' }}>- Clear all filters</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>[name/team]</span> <span style={{ color: '#666' }}>- Search players</span></div>
        </div>
        <div>
          <div style={{ color: '#ff6600', fontSize: '11px', fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>KEYBOARD SHORTCUTS</div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>↑/↓</span> <span style={{ color: '#666' }}>- Navigate players</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>ENTER</span> <span style={{ color: '#666' }}>- Select player</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>ESC</span> <span style={{ color: '#666' }}>- Close modal</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>TAB</span> <span style={{ color: '#666' }}>- Next field</span></div>
          <div style={{ marginBottom: '6px', fontSize: '10px' }}><span style={{ color: '#ffaa00' }}>SPACE</span> <span style={{ color: '#666' }}>- Toggle watchlist</span></div>
        </div>
        <div>
          <div style={{ color: '#ff6600', fontSize: '11px', fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>DATA INDICATORS</div>
          <div style={{ marginBottom: '6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: '#00d26a', display: 'inline-block' }}></span>
            <span style={{ color: '#666' }}>Low Risk / Positive</span>
          </div>
          <div style={{ marginBottom: '6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: '#ffaa00', display: 'inline-block' }}></span>
            <span style={{ color: '#666' }}>Medium Risk / Neutral</span>
          </div>
          <div style={{ marginBottom: '6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: '#ff3333', display: 'inline-block' }}></span>
            <span style={{ color: '#666' }}>High Risk / Negative</span>
          </div>
          <div style={{ marginBottom: '6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#0088ff' }}>▲</span>
            <span style={{ color: '#666' }}>Rising Trend</span>
          </div>
          <div style={{ marginBottom: '6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ff6666' }}>▼</span>
            <span style={{ color: '#666' }}>Declining Trend</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the News Panel (F2)
  const renderNewsPanel = () => (
    <>
      <div className="terminal-panel" style={{ gridColumn: 'span 2' }}>
        <PanelHeader title="PLAYER NEWS FEED" subtitle={`${news.length} STORIES`} />
        <div className="panel-content" style={{ maxHeight: '400px', overflow: 'auto' }}>
          {news.map((item) => (
            <div key={item.id} style={{
              padding: '8px',
              borderBottom: '1px solid #1a1a1a',
              borderLeft: `3px solid ${item.priority === 'high' ? '#ff3333' : item.priority === 'medium' ? '#ffaa00' : '#333'}`,
              marginBottom: '4px',
              background: item.priority === 'high' ? 'rgba(255,51,51,0.05)' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '9px',
                  padding: '2px 6px',
                  background: item.type === 'injury' ? '#ff3333' : item.type === 'depth' ? '#0088ff' : item.type === 'contract' ? '#ffaa00' : '#666',
                  color: '#000',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>{item.type}</span>
                <span style={{ color: '#666', fontSize: '9px' }}>{item.time}</span>
              </div>
              <div style={{ color: '#b0b0b0', fontSize: '11px' }}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="terminal-panel">
        <PanelHeader title="INJURY REPORT" />
        <div className="panel-content">
          {players.filter(p => !p.isDrafted && p.injuryRisk === 'HIGH').slice(0, 10).map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
              <div>
                <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px', marginRight: '4px' }}>{p.position}</span>
                <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
              </div>
              <span style={{ color: '#ff3333', fontSize: '9px' }}>HIGH RISK</span>
            </div>
          ))}
          <div style={{ marginTop: '16px', padding: '8px', background: '#0a0a0a', border: '1px solid #333' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>INJURY SUMMARY</div>
            <DataRow label="High Risk Available" value={players.filter(p => !p.isDrafted && p.injuryRisk === 'HIGH').length} color="#ff3333" />
            <DataRow label="Medium Risk Available" value={players.filter(p => !p.isDrafted && p.injuryRisk === 'MEDIUM').length} color="#ffaa00" />
            <DataRow label="Low Risk Available" value={players.filter(p => !p.isDrafted && p.injuryRisk === 'LOW').length} color="#00d26a" />
          </div>
        </div>
      </div>
    </>
  );

  // Render the Charts Panel (F3)
  const renderChartsPanel = () => (
    <>
      <div className="terminal-panel">
        <PanelHeader title="POSITION VALUE DISTRIBUTION" />
        <div className="panel-content">
          {positionBreakdown.map(pb => (
            <div key={pb.position} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className={`position-badge ${getPositionClass(pb.position)}`}>{pb.position}</span>
                <span style={{ color: '#666', fontSize: '10px' }}>AVG: ${pb.avgValue}</span>
              </div>
              {renderVerticalBars(
                pb.tierBreakdown.map(t => ({
                  label: `T${t.tier}`,
                  value: t.available,
                  max: Math.max(...pb.tierBreakdown.map(tb => tb.total)),
                  color: t.tier === 1 ? '#00d26a' : t.tier === 2 ? '#0088ff' : t.tier === 3 ? '#ffaa00' : '#666',
                })),
                40
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="terminal-panel">
        <PanelHeader title="SCARCITY INDEX" />
        <div className="panel-content">
          {positionBreakdown.map(pb => (
            <div key={pb.position} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#fff', fontSize: '10px' }}>{pb.position}</span>
                <span style={{
                  color: pb.scarcityScore > 70 ? '#ff3333' : pb.scarcityScore > 40 ? '#ffaa00' : '#00d26a',
                  fontSize: '12px',
                  fontWeight: 700,
                }}>{pb.scarcityScore}%</span>
              </div>
              {renderMiniChart(pb.scarcityScore, 100, pb.scarcityScore > 70 ? '#ff3333' : pb.scarcityScore > 40 ? '#ffaa00' : '#00d26a', 16)}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ color: '#666', fontSize: '9px' }}>{pb.available} available</span>
                <span style={{ color: '#666', fontSize: '9px' }}>{pb.drafted} drafted</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="terminal-panel">
        <PanelHeader title="BUDGET ALLOCATION" />
        <div className="panel-content">
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>LEAGUE SPENDING BY POSITION</div>
            {renderVerticalBars(
              Object.entries(draftStats.positionSpending).map(([pos, value]) => ({
                label: pos,
                value,
                max: Math.max(...Object.values(draftStats.positionSpending)) || 1,
                color: pos === 'QB' ? '#ff3333' : pos === 'RB' ? '#00d26a' : pos === 'WR' ? '#0088ff' : '#ffaa00',
              })),
              80
            )}
          </div>
          <div style={{ padding: '8px', background: '#0a0a0a', border: '1px solid #333' }}>
            <DataRow label="Total Spent" value={`$${draftStats.totalSpent}`} color="#ff6600" />
            <DataRow label="Remaining" value={`$${draftStats.remainingBudget}`} color="#00d26a" />
            <DataRow label="Avg Cost" value={`$${draftStats.avgCost}`} color="#ffaa00" />
            <DataRow label="Burn Rate" value={`$${draftStats.burnRate}/pick`} color="#0088ff" />
          </div>
        </div>
      </div>
    </>
  );

  // Render the Alerts Panel (F4)
  const renderAlertsPanel = () => (
    <>
      <div className="terminal-panel" style={{ gridColumn: 'span 2' }}>
        <PanelHeader title="SYSTEM ALERTS" subtitle={`${alerts.length} EVENTS`} />
        <div className="panel-content" style={{ maxHeight: '400px', overflow: 'auto' }}>
          {alerts.length === 0 ? (
            <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: '20px' }}>No alerts yet. Start the draft to see activity.</div>
          ) : (
            alerts.map((alert, i) => (
              <div key={i} style={{
                padding: '6px 8px',
                borderBottom: '1px solid #1a1a1a',
                background: i === 0 ? 'rgba(255,102,0,0.1)' : 'transparent',
                borderLeft: i === 0 ? '3px solid #ff6600' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: alert.startsWith('EXEC') ? '#00d26a' : alert.startsWith('AUTO') ? '#ffaa00' : '#b0b0b0', fontSize: '10px' }}>{alert}</span>
                  <span style={{ color: '#666', fontSize: '9px' }}>#{alerts.length - i}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="terminal-panel">
        <PanelHeader title="SCARCITY ALERTS" />
        <div className="panel-content">
          {positionBreakdown.filter(pb => pb.scarcityScore > 50).map(pb => (
            <div key={pb.position} style={{
              padding: '8px',
              marginBottom: '8px',
              background: pb.scarcityScore > 70 ? 'rgba(255,51,51,0.1)' : 'rgba(255,170,0,0.1)',
              border: `1px solid ${pb.scarcityScore > 70 ? '#ff3333' : '#ffaa00'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: pb.scarcityScore > 70 ? '#ff3333' : '#ffaa00', fontSize: '11px', fontWeight: 700 }}>
                  ⚠ {pb.position} {pb.scarcityScore > 70 ? 'CRITICAL' : 'WARNING'}
                </span>
                <span style={{ color: '#fff', fontSize: '11px' }}>{pb.scarcityScore}%</span>
              </div>
              <div style={{ color: '#b0b0b0', fontSize: '10px' }}>
                Only {pb.available} players remaining • Tier 1: {pb.tierBreakdown[0].available} left
              </div>
            </div>
          ))}
          {positionBreakdown.filter(pb => pb.scarcityScore > 50).length === 0 && (
            <div style={{ color: '#00d26a', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
              ✓ No scarcity alerts - All positions well stocked
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>WATCHLIST ({watchlist.size})</div>
            {watchlist.size === 0 ? (
              <div style={{ color: '#666', fontSize: '10px' }}>Click WATCH on a player to add them here</div>
            ) : (
              Array.from(watchlist).slice(0, 5).map(id => {
                const player = players.find(p => p.id === id);
                if (!player || player.isDrafted) return null;
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{player.name}</span>
                    <span style={{ color: '#ffaa00', fontSize: '10px' }}>${player.estimatedValue}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );

  // Render the Teams Panel (F6)
  const renderTeamsPanel = () => {
    const selectedTeamData = teamAnalytics.find(t => t.id === selectedTeamView);

    return (
      <>
        <div className="terminal-panel">
          <PanelHeader title="TEAM SELECTOR" />
          <div className="panel-content">
            {teamAnalytics.map(team => (
              <div
                key={team.id}
                style={{
                  padding: '8px',
                  marginBottom: '4px',
                  background: selectedTeamView === team.id ? 'rgba(255,102,0,0.2)' : '#0a0a0a',
                  border: `1px solid ${selectedTeamView === team.id ? '#ff6600' : '#333'}`,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedTeamView(team.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>{team.name}</span>
                  <span style={{
                    color: team.grade === 'A' ? '#00d26a' : team.grade === 'B' ? '#0088ff' : team.grade === 'C' ? '#ffaa00' : '#ff3333',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}>{team.grade}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span style={{ color: '#666' }}>${team.remaining} left</span>
                  <span style={{ color: '#666' }}>{team.players.length} players</span>
                  <span style={{ color: '#ffaa00' }}>{team.totalProj} proj</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="terminal-panel" style={{ gridColumn: 'span 2' }}>
          <PanelHeader title={selectedTeamData ? `${selectedTeamData.name} - ROSTER ANALYSIS` : 'SELECT A TEAM'} />
          <div className="panel-content">
            {selectedTeamData ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>ROSTER</div>
                  {selectedTeamData.players.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '10px' }}>No players drafted yet</div>
                  ) : (
                    selectedTeamData.players.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                        <div>
                          <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px', marginRight: '4px' }}>{p.position}</span>
                          <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#ffaa00', fontSize: '10px' }}>${p.draftCost}</span>
                          <span style={{ color: '#666', fontSize: '10px' }}>{p.projectedPoints}pts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ overflow: 'auto', maxHeight: '500px' }}>
                  {/* Team Score Dashboard */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
                    <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                      <div style={{ color: '#666', fontSize: '8px' }}>STRENGTH</div>
                      <div style={{ color: selectedTeamData.strengthScore > 100 ? '#00d26a' : selectedTeamData.strengthScore > 50 ? '#ffaa00' : '#ff6666', fontSize: '16px', fontWeight: 700 }}>
                        {selectedTeamData.strengthScore}
                      </div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                      <div style={{ color: '#666', fontSize: '8px' }}>DEPTH</div>
                      <div style={{ color: selectedTeamData.depthScore > 70 ? '#00d26a' : selectedTeamData.depthScore > 40 ? '#ffaa00' : '#ff6666', fontSize: '16px', fontWeight: 700 }}>
                        {selectedTeamData.depthScore}
                      </div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                      <div style={{ color: '#666', fontSize: '8px' }}>INJ INS</div>
                      <div style={{ color: selectedTeamData.injuryInsurance > 70 ? '#00d26a' : selectedTeamData.injuryInsurance > 40 ? '#ffaa00' : '#ff6666', fontSize: '16px', fontWeight: 700 }}>
                        {selectedTeamData.injuryInsurance}
                      </div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                      <div style={{ color: '#666', fontSize: '8px' }}>RISK</div>
                      <div style={{ color: selectedTeamData.riskScore < 5 ? '#00d26a' : selectedTeamData.riskScore < 10 ? '#ffaa00' : '#ff6666', fontSize: '16px', fontWeight: 700 }}>
                        {selectedTeamData.riskScore}
                      </div>
                    </div>
                  </div>

                  <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>BUDGET & VALUE</div>
                  <DataRow label="Total Projected" value={`${selectedTeamData.totalProj} pts`} color="#00d26a" />
                  <DataRow label="Total Spent" value={`$${selectedTeamData.totalSpent}`} color="#ffaa00" />
                  <DataRow label="Remaining Budget" value={`$${selectedTeamData.remaining}`} color="#0088ff" />
                  <DataRow label="Value Efficiency" value={`${selectedTeamData.valueEfficiency}%`} color={selectedTeamData.valueEfficiency >= 100 ? '#00d26a' : '#ff3333'} />
                  <DataRow label="Pts per Dollar" value={selectedTeamData.projPerDollar} color="#ffaa00" />

                  <div style={{ marginTop: '12px', color: '#ff6600', fontSize: '10px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>FLOOR/CEILING ANALYSIS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                    <div style={{ background: '#0a0a0a', padding: '6px', textAlign: 'center', border: '1px solid #222' }}>
                      <div style={{ color: '#666', fontSize: '7px' }}>AVG FLOOR</div>
                      <div style={{ color: '#ff6666', fontSize: '12px', fontWeight: 700 }}>{selectedTeamData.avgFloor}</div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '6px', textAlign: 'center', border: '1px solid #222' }}>
                      <div style={{ color: '#666', fontSize: '7px' }}>AVG CEILING</div>
                      <div style={{ color: '#00d26a', fontSize: '12px', fontWeight: 700 }}>{selectedTeamData.avgCeiling}</div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '6px', textAlign: 'center', border: '1px solid #222' }}>
                      <div style={{ color: '#666', fontSize: '7px' }}>UPSIDE</div>
                      <div style={{ color: '#0088ff', fontSize: '12px', fontWeight: 700 }}>{selectedTeamData.upsideScore}</div>
                    </div>
                  </div>
                  <DataRow label="Consistency Score" value={`${selectedTeamData.consistencyScore}/100`} color={selectedTeamData.consistencyScore > 70 ? '#00d26a' : '#ffaa00'} />
                  <DataRow label="Avg Age" value={selectedTeamData.avgAge} />

                  <div style={{ marginTop: '12px', color: '#ff6600', fontSize: '10px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>BYE WEEK ANALYSIS</div>
                  {selectedTeamData.worstByeWeek ? (
                    <div style={{ marginBottom: '8px' }}>
                      <DataRow
                        label="Worst Bye Week"
                        value={`Week ${selectedTeamData.worstByeWeek.week} (${selectedTeamData.worstByeWeek.count} players)`}
                        color={selectedTeamData.worstByeWeek.count > 2 ? '#ff3333' : '#ffaa00'}
                      />
                      <DataRow
                        label="Max Conflict"
                        value={`${selectedTeamData.maxByeConflict} players`}
                        color={selectedTeamData.maxByeConflict > 3 ? '#ff3333' : selectedTeamData.maxByeConflict > 2 ? '#ffaa00' : '#00d26a'}
                      />
                    </div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '9px' }}>No bye week data</div>
                  )}

                  <div style={{ marginTop: '12px', color: '#ff6600', fontSize: '10px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>POSITION BREAKDOWN</div>
                  {['QB', 'RB', 'WR', 'TE'].map(pos => (
                    <div key={pos} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                      <span style={{ color: '#666', fontSize: '10px' }}>{pos}</span>
                      <span style={{
                        color: selectedTeamData.positionCounts[pos as keyof typeof selectedTeamData.positionCounts] === 0 ? '#ff3333' : '#fff',
                        fontSize: '10px'
                      }}>
                        {selectedTeamData.positionCounts[pos as keyof typeof selectedTeamData.positionCounts]} players
                      </span>
                      <span style={{ color: '#ffaa00', fontSize: '10px' }}>${selectedTeamData.positionSpend[pos as keyof typeof selectedTeamData.positionSpend]}</span>
                      <span style={{ color: '#0088ff', fontSize: '10px' }}>
                        {selectedTeamData.positionSpend[pos as keyof typeof selectedTeamData.positionSpend] > 0
                          ? `$${(selectedTeamData.positionSpend[pos as keyof typeof selectedTeamData.positionSpend] / Math.max(1, selectedTeamData.positionCounts[pos as keyof typeof selectedTeamData.positionCounts])).toFixed(0)}/player`
                          : '-'}
                      </span>
                    </div>
                  ))}

                  {selectedTeamData.needs.length > 0 && (
                    <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(255,51,51,0.1)', border: '1px solid #ff3333' }}>
                      <div style={{ color: '#ff3333', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>⚠ ROSTER NEEDS</div>
                      <div style={{ color: '#fff', fontSize: '11px' }}>{selectedTeamData.needs.join(', ')}</div>
                    </div>
                  )}

                  {/* Roster Composition Visualization */}
                  <div style={{ marginTop: '12px', color: '#ff6600', fontSize: '10px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>BUDGET ALLOCATION</div>
                  <div style={{ display: 'flex', height: '20px', marginBottom: '8px', border: '1px solid #333' }}>
                    {(['QB', 'RB', 'WR', 'TE'] as const).map(pos => {
                      const spend = selectedTeamData.positionSpend[pos];
                      const pct = selectedTeamData.totalSpent > 0 ? (spend / selectedTeamData.totalSpent) * 100 : 0;
                      const colors = { QB: '#ff6666', RB: '#00d26a', WR: '#0088ff', TE: '#ffaa00' };
                      return pct > 0 ? (
                        <div
                          key={pos}
                          style={{
                            width: `${pct}%`,
                            background: colors[pos],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            color: '#000',
                            fontWeight: 700,
                          }}
                          title={`${pos}: $${spend} (${pct.toFixed(0)}%)`}
                        >
                          {pct > 10 ? pos : ''}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '8px' }}>
                    <span style={{ color: '#ff6666' }}>■ QB</span>
                    <span style={{ color: '#00d26a' }}>■ RB</span>
                    <span style={{ color: '#0088ff' }}>■ WR</span>
                    <span style={{ color: '#ffaa00' }}>■ TE</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: '40px' }}>
                Select a team from the left panel to view detailed roster analysis
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // Render the Analytics Panel (F7)
  const renderAnalyticsPanel = () => {
    // Calculate market analytics
    const avgPlayerValue = filteredPlayers.reduce((sum, p) => sum + p.estimatedValue, 0) / filteredPlayers.length || 0;
    const tier1Players = filteredPlayers.filter(p => p.tier === 1);
    const tier2Players = filteredPlayers.filter(p => p.tier === 2);
    const risingStar = filteredPlayers.filter(p => p.recentTrends === 'RISING');
    const decliningPlayers = filteredPlayers.filter(p => p.recentTrends === 'DECLINING');
    const lockedStarters = filteredPlayers.filter(p => p.competitionLevel === 'LOCKED_STARTER');
    const newCoachPlayers = filteredPlayers.filter(p => p.coachingStability !== 'STABLE');
    const easyPlayoffSched = filteredPlayers.filter(p => p.playoffSchedule === 'EASY');

    return (
      <>
        {/* Market Overview */}
        <div className="terminal-panel">
          <PanelHeader title="MARKET OVERVIEW" />
          <div className="panel-content">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: '8px' }}>AVG VALUE</div>
                <div style={{ color: '#ffaa00', fontSize: '14px', fontWeight: 700 }}>${avgPlayerValue.toFixed(0)}</div>
              </div>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: '8px' }}>TIER 1 LEFT</div>
                <div style={{ color: tier1Players.length <= 3 ? '#ff6666' : '#00d26a', fontSize: '14px', fontWeight: 700 }}>{tier1Players.length}</div>
              </div>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: '8px' }}>TIER 2 LEFT</div>
                <div style={{ color: tier2Players.length <= 5 ? '#ffaa00' : '#00d26a', fontSize: '14px', fontWeight: 700 }}>{tier2Players.length}</div>
              </div>
            </div>
            <div style={{ color: '#ff6600', fontSize: '9px', marginBottom: '6px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>TREND ANALYSIS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
              <DataRow label="Rising Players" value={risingStar.length} color="#00d26a" />
              <DataRow label="Declining" value={decliningPlayers.length} color="#ff6666" />
              <DataRow label="Locked Starters" value={lockedStarters.length} color="#0088ff" />
              <DataRow label="New Coaches" value={newCoachPlayers.length} color="#ffaa00" />
            </div>
            <div style={{ color: '#ff6600', fontSize: '9px', marginBottom: '6px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>SCHEDULE EDGE</div>
            <DataRow label="Easy Playoff Sched" value={easyPlayoffSched.length} color="#00d26a" />
          </div>
        </div>

        {/* Draft Efficiency */}
        <div className="terminal-panel">
          <PanelHeader title="DRAFT EFFICIENCY" />
          <div className="panel-content">
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>LEAGUE VALUE EFFICIENCY</div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: draftStats.valueEfficiency >= 100 ? '#00d26a' : '#ff3333', textAlign: 'center' }}>
                {draftStats.valueEfficiency}%
              </div>
              <div style={{ color: '#666', fontSize: '10px', textAlign: 'center' }}>
                {draftStats.valueEfficiency >= 100 ? 'Above Market Value' : 'Below Market Value'}
              </div>
            </div>
            <DataRow label="Players Drafted" value={draftStats.drafted} />
            <DataRow label="Avg Cost" value={`$${draftStats.avgCost}`} color="#ffaa00" />
            <DataRow label="Burn Rate" value={`$${draftStats.burnRate}/pick`} color="#0088ff" />
            <DataRow label="Budget Used" value={`${Math.round((draftStats.totalSpent / draftStats.totalBudget) * 100)}%`} />
          </div>
        </div>

        {/* Value Opportunities */}
        <div className="terminal-panel">
          <PanelHeader title="VALUE OPPORTUNITIES" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>BEST VALUE AVAILABLE</div>
            {filteredPlayers
              .sort((a, b) => b.valueOverReplacement - a.valueOverReplacement)
              .slice(0, 6)
              .map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#0088ff', fontSize: '9px' }}>VORP:{p.valueOverReplacement}</span>
                    <span style={{ color: '#ffaa00', fontSize: '9px' }}>${p.estimatedValue}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Breakout Candidates */}
        <div className="terminal-panel">
          <PanelHeader title="BREAKOUT CANDIDATES" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>HIGH UPSIDE PLAYERS</div>
            {filteredPlayers
              .filter(p => p.upside - p.projectedPoints > 30)
              .sort((a, b) => (b.upside - b.projectedPoints) - (a.upside - a.projectedPoints))
              .slice(0, 6)
              .map(p => {
                const analytics = draftService.getPlayerAnalytics(p.id);
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                      <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ color: '#00d26a', fontSize: '9px' }}>+{p.upside - p.projectedPoints}</span>
                      <span style={{ color: '#ffaa00', fontSize: '9px' }}>{analytics?.breakoutPotential || 0}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Regression Risks */}
        <div className="terminal-panel">
          <PanelHeader title="REGRESSION RISKS" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>⚠ CAUTION LIST</div>
            {filteredPlayers
              .map(p => ({ ...p, analytics: draftService.getPlayerAnalytics(p.id) }))
              .filter(p => p.analytics && p.analytics.regressionRisk > 40)
              .sort((a, b) => (b.analytics?.regressionRisk || 0) - (a.analytics?.regressionRisk || 0))
              .slice(0, 6)
              .map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#ff6666', fontSize: '9px' }}>REG:{p.analytics?.regressionRisk}%</span>
                    <span style={{ color: '#666', fontSize: '9px' }}>${p.estimatedValue}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Situation Upgrades */}
        <div className="terminal-panel">
          <PanelHeader title="SITUATION UPGRADES" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>RISING + LOCKED STARTER</div>
            {filteredPlayers
              .filter(p => p.recentTrends === 'RISING' && p.competitionLevel === 'LOCKED_STARTER')
              .sort((a, b) => b.valueOverReplacement - a.valueOverReplacement)
              .slice(0, 6)
              .map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#00d26a', fontSize: '9px' }}>↗ RISING</span>
                    <span style={{ color: '#0088ff', fontSize: '9px' }}>LOCKED</span>
                  </div>
                </div>
              ))}
            {filteredPlayers.filter(p => p.recentTrends === 'RISING' && p.competitionLevel === 'LOCKED_STARTER').length === 0 && (
              <div style={{ color: '#666', fontSize: '9px' }}>No players match criteria</div>
            )}
          </div>
        </div>

        {/* Sleeper Picks */}
        <div className="terminal-panel">
          <PanelHeader title="SLEEPER PICKS" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>HIGH VALUE / LOW ADP</div>
            {filteredPlayers
              .filter(p => p.estimatedValue > 5 && p.adp > 80)
              .sort((a, b) => (b.valueOverReplacement / b.estimatedValue) - (a.valueOverReplacement / a.estimatedValue))
              .slice(0, 6)
              .map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#666', fontSize: '9px' }}>ADP:{p.adp}</span>
                    <span style={{ color: '#00d26a', fontSize: '9px' }}>${p.estimatedValue}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Elite Handcuffs */}
        <div className="terminal-panel">
          <PanelHeader title="ELITE HANDCUFFS" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>TOP BACKUP TARGETS</div>
            {filteredPlayers
              .filter(p => p.handcuffValue > 50)
              .sort((a, b) => b.handcuffValue - a.handcuffValue)
              .slice(0, 6)
              .map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#0088ff', fontSize: '9px' }}>HC:{p.handcuffValue}</span>
                    {p.primaryBackup && <span style={{ color: '#666', fontSize: '8px' }}>→{p.primaryBackup.split(' ')[1]}</span>}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Playoff Schedule Edge */}
        <div className="terminal-panel">
          <PanelHeader title="PLAYOFF SCHEDULE EDGE" />
          <div className="panel-content">
            <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '8px' }}>EASY PLAYOFF MATCHUPS</div>
            {filteredPlayers
              .filter(p => p.playoffSchedule === 'EASY')
              .sort((a, b) => b.projectedPoints - a.projectedPoints)
              .slice(0, 6)
              .map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`position-badge ${getPositionClass(p.position)}`} style={{ fontSize: '8px' }}>{p.position}</span>
                    <span style={{ color: '#fff', fontSize: '10px' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#00d26a', fontSize: '9px' }}>EASY</span>
                    <span style={{ color: '#ffaa00', fontSize: '9px' }}>{p.projectedPoints}pts</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </>
    );
  };

  // Render the Trade Panel (F8)
  const renderTradePanel = () => {
    const team1Data = teamAnalytics.find(t => t.id === tradeTeam1);
    const team2Data = teamAnalytics.find(t => t.id === tradeTeam2);

    return (
      <>
        <div className="terminal-panel">
          <PanelHeader title="TRADE CALCULATOR" />
          <div className="panel-content">
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '4px' }}>TEAM 1</div>
              <select
                value={tradeTeam1}
                onChange={(e) => setTradeTeam1(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '8px', fontFamily: 'var(--font-terminal)', fontSize: '11px' }}
              >
                <option value="">-- Select Team --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#ff6600', fontSize: '10px', marginBottom: '4px' }}>TEAM 2</div>
              <select
                value={tradeTeam2}
                onChange={(e) => setTradeTeam2(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '8px', fontFamily: 'var(--font-terminal)', fontSize: '11px' }}
              >
                <option value="">-- Select Team --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="terminal-panel" style={{ gridColumn: 'span 2' }}>
          <PanelHeader title="TRADE ANALYSIS" />
          <div className="panel-content">
            {team1Data && team2Data ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px' }}>
                <div>
                  <div style={{ color: '#ff6600', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>{team1Data.name}</div>
                  <DataRow label="Proj Points" value={team1Data.totalProj} color="#00d26a" />
                  <DataRow label="Remaining" value={`$${team1Data.remaining}`} color="#ffaa00" />
                  <DataRow label="Needs" value={team1Data.needs.join(', ') || 'None'} color="#0088ff" />
                  <div style={{ marginTop: '12px', color: '#666', fontSize: '10px' }}>ROSTER</div>
                  {team1Data.players.slice(0, 5).map(p => (
                    <div key={p.id} style={{ fontSize: '9px', color: '#b0b0b0', padding: '2px 0' }}>
                      {p.position} {p.name} - {p.projectedPoints}pts
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ color: '#ff6600', fontSize: '24px' }}>⇄</div>
                </div>
                <div>
                  <div style={{ color: '#ff6600', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>{team2Data.name}</div>
                  <DataRow label="Proj Points" value={team2Data.totalProj} color="#00d26a" />
                  <DataRow label="Remaining" value={`$${team2Data.remaining}`} color="#ffaa00" />
                  <DataRow label="Needs" value={team2Data.needs.join(', ') || 'None'} color="#0088ff" />
                  <div style={{ marginTop: '12px', color: '#666', fontSize: '10px' }}>ROSTER</div>
                  {team2Data.players.slice(0, 5).map(p => (
                    <div key={p.id} style={{ fontSize: '9px', color: '#b0b0b0', padding: '2px 0' }}>
                      {p.position} {p.name} - {p.projectedPoints}pts
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: '40px' }}>
                Select two teams to analyze potential trades
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // Main draft panel content
  const renderDraftPanel = () => (
    <>
      {/* Left Panel - Comprehensive Position Monitor */}
      <div className="terminal-panel">
        <PanelHeader title="POSITION MONITOR" subtitle={`${draftStats.remaining} AVAIL`} />
        <div className="panel-content">
          {/* Draft Progress */}
          <div style={{ marginBottom: '16px', padding: '8px', background: '#0a0a0a', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#ff6600', fontSize: '10px', textTransform: 'uppercase' }}>Draft Progress</span>
              <span style={{ color: '#ffaa00', fontSize: '14px', fontWeight: 700 }}>{draftStats.progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${draftStats.progress}%` }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '8px' }}>
              <DataRow label="Drafted" value={draftStats.drafted} />
              <DataRow label="Remaining" value={draftStats.remaining} />
              <DataRow label="Total Spent" value={`$${draftStats.totalSpent}`} color="#ffaa00" />
              <DataRow label="Avg Cost" value={`$${draftStats.avgCost}`} color="#0088ff" />
            </div>
          </div>

          {/* Position Breakdown */}
          {positionBreakdown.map(pb => (
            <div key={pb.position} style={{ marginBottom: '16px', padding: '8px', background: '#0a0a0a', border: `1px solid ${pb.scarcityScore > 70 ? '#ff3333' : pb.scarcityScore > 40 ? '#ffaa00' : '#333'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className={`position-badge ${getPositionClass(pb.position)}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{pb.position}</span>
                <span style={{
                  color: pb.scarcityScore > 70 ? '#ff3333' : pb.scarcityScore > 40 ? '#ffaa00' : '#00d26a',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>{pb.scarcityScore}% SCARCITY</span>
              </div>

              {/* Tier breakdown mini bars */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
                {pb.tierBreakdown.map(t => (
                  <div key={t.tier} style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', color: '#666', textAlign: 'center' }}>T{t.tier}</div>
                    <div style={{ height: '20px', background: '#000', border: '1px solid #333', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{
                        height: `${(t.available / (t.total || 1)) * 100}%`,
                        background: t.tier === 1 ? '#00d26a' : t.tier === 2 ? '#0088ff' : t.tier === 3 ? '#ffaa00' : '#666',
                        minHeight: t.available > 0 ? '2px' : 0,
                      }} />
                    </div>
                    <div style={{ fontSize: '8px', color: '#fff', textAlign: 'center' }}>{t.available}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9px' }}>
                <div><span style={{ color: '#666' }}>Available:</span> <span style={{ color: pb.available < 5 ? '#ff3333' : '#fff' }}>{pb.available}</span></div>
                <div><span style={{ color: '#666' }}>Avg Value:</span> <span style={{ color: '#ffaa00' }}>${pb.avgValue}</span></div>
                <div><span style={{ color: '#666' }}>Avg Proj:</span> <span style={{ color: '#00d26a' }}>{pb.avgProj}</span></div>
                <div><span style={{ color: '#666' }}>Trend:</span> <span style={{ color: pb.valueTrend === 'RISING' ? '#ff3333' : pb.valueTrend === 'FALLING' ? '#00d26a' : '#666' }}>{pb.valueTrend}</span></div>
              </div>

              {/* Top available */}
              {pb.topAvailable.length > 0 && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '4px' }}>
                  <div style={{ fontSize: '8px', color: '#ff6600', marginBottom: '2px' }}>TOP AVAILABLE</div>
                  {pb.topAvailable.slice(0, 2).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', cursor: 'pointer' }} onClick={() => handlePlayerSelect(p)}>
                      <span style={{ color: '#b0b0b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{p.name}</span>
                      <span style={{ color: '#ffaa00' }}>${p.estimatedValue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel - Player Data Grid */}
      <div className="terminal-panel">
        <PanelHeader
          title="AVAILABLE PLAYERS"
          subtitle={`${filteredPlayers.length} PLAYERS`}
          extra={
            compareMode && (
              <span style={{ color: '#ff6600', fontSize: '10px', background: '#ff660020', padding: '2px 8px' }}>
                COMPARE MODE ({comparePlayers.length}/4)
              </span>
            )
          }
        />

        {/* Command Bar */}
        <div className="command-bar">
          <span className="command-prompt">&gt;</span>
          <input
            type="text"
            className="command-input"
            placeholder="Search or command (POS QB, TIER 1, SIM, COMPARE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCommand(searchQuery)}
          />
          <span className="command-status">
            {positionFilter !== 'ALL' && `POS:${positionFilter} `}
            {tierFilter > 0 && `T:${tierFilter} `}
            {isSimulating && <span style={{ color: '#ffaa00' }}>●SIM</span>}
          </span>
        </div>

        {/* Filter Buttons */}
        <div style={{ padding: '4px 8px', display: 'flex', gap: '4px', borderBottom: '1px solid #333', flexWrap: 'wrap' }}>
          {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
            <button
              key={pos}
              className={`terminal-button ${positionFilter === pos ? 'primary' : ''}`}
              style={{ padding: '2px 8px', fontSize: '10px' }}
              onClick={() => setPositionFilter(pos)}
            >
              {pos}
            </button>
          ))}
          <div style={{ width: '1px', background: '#333', margin: '0 4px' }} />
          {[1, 2, 3, 4].map(tier => (
            <button
              key={tier}
              className={`terminal-button ${tierFilter === tier ? 'primary' : ''}`}
              style={{ padding: '2px 8px', fontSize: '10px' }}
              onClick={() => setTierFilter(tierFilter === tier ? 0 : tier)}
            >
              T{tier}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <button
              className={`terminal-button ${compareMode ? 'primary' : ''}`}
              style={{ padding: '2px 8px', fontSize: '10px' }}
              onClick={() => { setCompareMode(!compareMode); setComparePlayers([]); }}
            >
              CMP
            </button>
          </div>
        </div>

        {/* Compare View */}
        {compareMode && comparePlayers.length > 0 && (
          <div style={{ padding: '8px', background: '#0a0a0a', borderBottom: '1px solid #333' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparePlayers.length}, 1fr)`, gap: '8px' }}>
              {comparePlayers.map(p => (
                <div key={p.id} style={{ background: '#111', padding: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>{p.name}</span>
                    <button onClick={() => setComparePlayers(prev => prev.filter(cp => cp.id !== p.id))} style={{ background: 'none', border: 'none', color: '#ff3333', cursor: 'pointer', fontSize: '10px' }}>×</button>
                  </div>
                  <DataRow label="Value" value={`$${p.estimatedValue}`} color="#ffaa00" />
                  <DataRow label="Proj" value={p.projectedPoints} color="#00d26a" />
                  <DataRow label="VORP" value={p.valueOverReplacement} color="#0088ff" />
                  <DataRow label="Floor" value={p.floor} color="#ff6666" />
                  <DataRow label="Ceiling" value={p.upside} color="#66ff66" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Grid */}
        <div className="panel-content" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-grid" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '28px' }}>POS</th>
                <th style={{ width: '14px' }}>T</th>
                <th onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                  PLAYER {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th style={{ width: '32px' }}>TM</th>
                <th onClick={() => { setSortBy('adp'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer', width: '40px' }}>
                  ADP {sortBy === 'adp' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => { setSortBy('value'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer', width: '42px' }}>
                  VAL {sortBy === 'value' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => { setSortBy('proj'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer', width: '38px' }}>
                  PROJ {sortBy === 'proj' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => { setSortBy('vorp'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer', width: '38px' }}>
                  VORP {sortBy === 'vorp' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th style={{ width: '32px' }}>FLR</th>
                <th onClick={() => { setSortBy('upside'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer', width: '32px' }}>
                  CEIL {sortBy === 'upside' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th style={{ width: '28px' }}>BYE</th>
                <th style={{ width: '30px' }}>SOS</th>
                <th style={{ width: '32px' }}>TRG%</th>
                <th style={{ width: '30px' }}>RZ%</th>
                <th style={{ width: '32px' }}>SNAP</th>
                <th style={{ width: '22px' }}>INJ</th>
                <th style={{ width: '22px' }}>AGE</th>
                <th style={{ width: '32px' }}>TRND</th>
                <th style={{ width: '18px' }}>★</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.slice(0, 50).map((player) => (
                <tr
                  key={player.id}
                  onClick={() => handlePlayerSelect(player)}
                  style={{
                    cursor: 'pointer',
                    background: comparePlayers.find(p => p.id === player.id) ? 'rgba(255,102,0,0.2)' :
                      watchlist.has(player.id) ? 'rgba(0,136,255,0.1)' : 'transparent',
                  }}
                >
                  <td className={`cell-position ${getPositionClass(player.position)}`}>{player.position}</td>
                  <td><span className={`tier-indicator tier-${player.tier}`}>{player.tier}</span></td>
                  <td className="cell-player">{player.name}</td>
                  <td className="cell-team">{player.team}</td>
                  <td className="cell-number">{player.adp}</td>
                  <td className="cell-number cell-value">${player.estimatedValue}</td>
                  <td className="cell-number">{player.projectedPoints}</td>
                  <td className="cell-number" style={{ color: '#0088ff' }}>{player.valueOverReplacement}</td>
                  <td className="cell-number" style={{ color: '#ff6666' }}>{player.floor}</td>
                  <td className="cell-number" style={{ color: '#66ff66' }}>{player.upside}</td>
                  <td className="cell-number" style={{ color: '#ffaa00' }}>{player.byeWeek}</td>
                  <td className="cell-number" style={{ color: player.strengthOfSchedule <= 10 ? '#00d26a' : player.strengthOfSchedule >= 23 ? '#ff6666' : '#fff' }}>
                    {player.strengthOfSchedule}
                  </td>
                  <td className="cell-number" style={{ color: player.targetShare > 25 ? '#00d26a' : '#666' }}>
                    {player.targetShare}%
                  </td>
                  <td className="cell-number" style={{ color: player.redZoneShare > 30 ? '#ff6666' : '#666' }}>
                    {player.redZoneShare}%
                  </td>
                  <td className="cell-number" style={{ color: player.snapPercentage > 80 ? '#00d26a' : player.snapPercentage > 60 ? '#ffaa00' : '#666' }}>
                    {player.snapPercentage}%
                  </td>
                  <td style={{ color: getRiskColor(player.injuryRisk), fontSize: '9px' }}>{player.injuryRisk.charAt(0)}</td>
                  <td style={{ color: getRiskColor(player.ageRisk), fontSize: '9px' }}>{player.age}</td>
                  <td style={{
                    color: player.recentTrends === 'RISING' ? '#00d26a' : player.recentTrends === 'DECLINING' ? '#ff6666' : '#666',
                    fontSize: '9px',
                  }}>
                    {player.recentTrends === 'RISING' ? '↗' : player.recentTrends === 'DECLINING' ? '↘' : '→'}
                  </td>
                  <td
                    style={{ color: watchlist.has(player.id) ? '#ffaa00' : '#333', cursor: 'pointer', fontSize: '10px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWatchlist(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(player.id)) newSet.delete(player.id);
                        else newSet.add(player.id);
                        return newSet;
                      });
                    }}
                  >
                    {watchlist.has(player.id) ? '★' : '☆'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel - Draft Console */}
      <div className="terminal-panel">
        <PanelHeader title="DRAFT CONSOLE" />
        <div className="panel-content">
          {/* Simulation Controls */}
          <div style={{ marginBottom: '12px' }}>
            <button
              className={`terminal-button ${isSimulating ? 'danger' : 'success'}`}
              style={{ width: '100%', padding: '10px', fontSize: '11px' }}
              onClick={() => setIsSimulating(!isSimulating)}
            >
              {isSimulating ? '■ STOP SIMULATION' : '▶ START SIMULATION'}
            </button>
          </div>

          {/* Quick Stats */}
          <div style={{ padding: '8px', background: '#0a0a0a', border: '1px solid #333', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <DataRow label="Picks Made" value={draftStats.drafted} />
              <DataRow label="Remaining" value={draftStats.remaining} />
              <DataRow label="Efficiency" value={`${draftStats.valueEfficiency}%`} color={draftStats.valueEfficiency >= 100 ? '#00d26a' : '#ff3333'} />
              <DataRow label="Burn Rate" value={`$${draftStats.burnRate}`} color="#0088ff" />
            </div>
          </div>

          {/* Activity Feed */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Live Activity
            </div>
            <div style={{ maxHeight: '150px', overflow: 'auto' }}>
              {alerts.slice(0, 15).map((alert, i) => (
                <div key={i} style={{
                  fontSize: '9px',
                  color: alert.startsWith('EXEC') ? '#00d26a' : '#b0b0b0',
                  marginBottom: '3px',
                  padding: '3px 6px',
                  background: i === 0 ? 'rgba(255,102,0,0.1)' : 'transparent',
                  borderLeft: i === 0 ? '2px solid #ff6600' : '2px solid transparent',
                }}>
                  {alert}
                </div>
              ))}
            </div>
          </div>

          {/* Team Budgets */}
          <div>
            <div style={{ color: '#ff6600', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Team Budgets
            </div>
            {teamAnalytics.slice(0, 8).map(team => (
              <div key={team.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                gap: '8px',
                fontSize: '9px',
                marginBottom: '4px',
                padding: '4px 6px',
                background: '#0a0a0a',
                alignItems: 'center',
              }}>
                <span style={{ color: '#b0b0b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                <span style={{ color: '#666' }}>{team.players.length}P</span>
                <span style={{
                  color: team.grade === 'A' ? '#00d26a' : team.grade === 'B' ? '#0088ff' : team.grade === 'C' ? '#ffaa00' : '#ff3333',
                  fontWeight: 600,
                }}>{team.grade}</span>
                <span style={{ color: team.remaining < 50 ? '#ff3333' : team.remaining < 100 ? '#ffaa00' : '#00d26a', fontWeight: 600 }}>
                  ${team.remaining}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // Render the player detail modal
  const renderPlayerModal = () => {
    if (!showPlayerModal || !selectedPlayer) return null;

    return (
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: '#0a0a0a', border: '2px solid #ff6600', zIndex: 1000,
        width: '950px', maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Modal Header */}
        <div style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)', padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={`position-badge ${getPositionClass(selectedPlayer.position)}`} style={{ fontSize: '14px', padding: '4px 12px' }}>{selectedPlayer.position}</span>
            <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{selectedPlayer.name}</span>
            <span style={{ color: '#666', fontSize: '12px' }}>{selectedPlayer.team}</span>
            <span className={`tier-indicator tier-${selectedPlayer.tier}`} style={{ marginLeft: '8px' }}>{selectedPlayer.tier}</span>
            {watchlist.has(selectedPlayer.id) && <span style={{ color: '#0088ff', fontSize: '10px' }}>★ WATCHING</span>}
          </div>
          <button onClick={() => setShowPlayerModal(false)} style={{ background: 'none', border: '1px solid #ff6600', color: '#ff6600', padding: '4px 12px', cursor: 'pointer', fontFamily: 'var(--font-terminal)' }}>CLOSE [X]</button>
        </div>

        {/* Modal Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '2px', padding: '2px' }}>
          {/* Left Column - Core Stats */}
          <div style={{ background: '#111', padding: '12px' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>Core Metrics</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333' }}>
                <div style={{ color: '#666', fontSize: '9px' }}>PROJ POINTS</div>
                <div style={{ color: '#00d26a', fontSize: '24px', fontWeight: 700 }}>{selectedPlayer.projectedPoints}</div>
              </div>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333' }}>
                <div style={{ color: '#666', fontSize: '9px' }}>EST VALUE</div>
                <div style={{ color: '#ffaa00', fontSize: '24px', fontWeight: 700 }}>${selectedPlayer.estimatedValue}</div>
              </div>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333' }}>
                <div style={{ color: '#666', fontSize: '9px' }}>ADP</div>
                <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{selectedPlayer.adp}</div>
              </div>
              <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333' }}>
                <div style={{ color: '#666', fontSize: '9px' }}>VORP</div>
                <div style={{ color: '#0088ff', fontSize: '18px', fontWeight: 700 }}>{selectedPlayer.valueOverReplacement}</div>
              </div>
            </div>

            {/* Floor/Ceiling */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#ff6600', fontSize: '9px', textTransform: 'uppercase', marginBottom: '8px' }}>Projection Range</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: '#ff6666', fontSize: '10px', width: '50px' }}>FLOOR</span>
                <div style={{ flex: 1, height: '16px', background: '#000', border: '1px solid #333', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${(selectedPlayer.floor / 400) * 100}%`,
                    right: `${100 - (selectedPlayer.upside / 400) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ff6666, #00d26a, #66ff66)',
                    opacity: 0.5,
                  }} />
                  <div style={{ position: 'absolute', left: `${(selectedPlayer.projectedPoints / 400) * 100}%`, width: '2px', height: '100%', background: '#fff' }} />
                </div>
                <span style={{ color: '#66ff66', fontSize: '10px', width: '50px', textAlign: 'right' }}>CEILING</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#ff6666' }}>{selectedPlayer.floor}</span>
                <span style={{ color: '#fff' }}>{selectedPlayer.projectedPoints} (proj)</span>
                <span style={{ color: '#66ff66' }}>{selectedPlayer.upside}</span>
              </div>
            </div>

            {/* Performance Metrics */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#666', fontSize: '10px' }}>CONSISTENCY</span>
                <span style={{ color: '#ffaa00', fontSize: '11px' }}>{selectedPlayer.consistency}/10</span>
              </div>
              {renderMiniChart(selectedPlayer.consistency, 10, '#ffaa00')}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#666', fontSize: '10px' }}>TARGET SHARE</span>
                <span style={{ color: '#0088ff', fontSize: '11px' }}>{selectedPlayer.targetShare}%</span>
              </div>
              {renderMiniChart(selectedPlayer.targetShare, 35, '#0088ff')}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#666', fontSize: '10px' }}>RED ZONE SHARE</span>
                <span style={{ color: '#ff6666', fontSize: '11px' }}>{selectedPlayer.redZoneShare}%</span>
              </div>
              {renderMiniChart(selectedPlayer.redZoneShare, 50, '#ff6666')}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#666', fontSize: '10px' }}>SNAP %</span>
                <span style={{ color: '#00d26a', fontSize: '11px' }}>{selectedPlayer.snapPercentage}%</span>
              </div>
              {renderMiniChart(selectedPlayer.snapPercentage, 100, '#00d26a')}
            </div>
          </div>

          {/* Middle Column - Risk & Situation */}
          <div style={{ background: '#111', padding: '12px', overflow: 'auto', maxHeight: '600px' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>Risk & Situation Analysis</div>

            {/* Risk Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#0a0a0a', padding: '8px', border: `1px solid ${getRiskColor(selectedPlayer.injuryRisk)}40` }}>
                <div style={{ color: '#666', fontSize: '9px' }}>INJURY RISK</div>
                <div style={{ color: getRiskColor(selectedPlayer.injuryRisk), fontSize: '14px', fontWeight: 700 }}>{selectedPlayer.injuryRisk}</div>
              </div>
              <div style={{ background: '#0a0a0a', padding: '8px', border: `1px solid ${getRiskColor(selectedPlayer.ageRisk)}40` }}>
                <div style={{ color: '#666', fontSize: '9px' }}>AGE RISK</div>
                <div style={{ color: getRiskColor(selectedPlayer.ageRisk), fontSize: '14px', fontWeight: 700 }}>{selectedPlayer.ageRisk}</div>
              </div>
            </div>

            {/* Player Bio */}
            <div style={{ fontSize: '10px', marginBottom: '12px' }}>
              <DataRow label="AGE" value={selectedPlayer.age} />
              <DataRow label="EXPERIENCE" value={`${selectedPlayer.experience} YRS`} />
              <DataRow label="GAMES (LAST SZN)" value={selectedPlayer.lastSeasonGames} />
              <DataRow label="CAREER GAMES" value={selectedPlayer.careerGames} />
              <DataRow label="BYE WEEK" value={selectedPlayer.byeWeek} color="#ffaa00" />
            </div>

            {/* Team Environment */}
            <div style={{ color: '#ff6600', fontSize: '9px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>Team Environment</div>
            <div style={{ fontSize: '10px', marginBottom: '12px' }}>
              <DataRow
                label="CONTRACT"
                value={selectedPlayer.contractStatus}
                color={selectedPlayer.contractStatus === 'SECURE' ? '#00d26a' : selectedPlayer.contractStatus === 'FRANCHISE_TAG' ? '#0088ff' : '#ffaa00'}
              />
              <DataRow
                label="COACHING"
                value={selectedPlayer.coachingStability}
                color={selectedPlayer.coachingStability === 'STABLE' ? '#00d26a' : '#ffaa00'}
              />
              <DataRow
                label="COMPETITION"
                value={selectedPlayer.competitionLevel.replace(/_/g, ' ')}
                color={selectedPlayer.competitionLevel === 'LOCKED_STARTER' ? '#00d26a' : selectedPlayer.competitionLevel === 'MINOR_COMPETITION' ? '#ffaa00' : '#ff3333'}
              />
              <DataRow
                label="O-LINE RANK"
                value={`#${selectedPlayer.offensiveLineRank}`}
                color={selectedPlayer.offensiveLineRank <= 10 ? '#00d26a' : selectedPlayer.offensiveLineRank <= 20 ? '#ffaa00' : '#ff3333'}
              />
              <DataRow
                label="TEAM PACE RANK"
                value={`#${selectedPlayer.teamPaceRank}`}
                color={selectedPlayer.teamPaceRank <= 10 ? '#00d26a' : selectedPlayer.teamPaceRank <= 20 ? '#ffaa00' : '#ff3333'}
              />
              <DataRow
                label="WEATHER"
                value={selectedPlayer.weatherConcerns ? 'OUTDOOR' : 'DOME/WARM'}
                color={selectedPlayer.weatherConcerns ? '#ffaa00' : '#00d26a'}
              />
            </div>

            {/* Schedule & Matchups */}
            <div style={{ color: '#ff6600', fontSize: '9px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>Schedule & Matchups</div>
            <div style={{ fontSize: '10px', marginBottom: '12px' }}>
              <DataRow
                label="PLAYOFF SCHED"
                value={selectedPlayer.playoffSchedule}
                color={selectedPlayer.playoffSchedule === 'EASY' ? '#00d26a' : selectedPlayer.playoffSchedule === 'MODERATE' ? '#ffaa00' : '#ff3333'}
              />
              <DataRow
                label="SOS RANK"
                value={`#${selectedPlayer.strengthOfSchedule}`}
                color={selectedPlayer.strengthOfSchedule <= 10 ? '#00d26a' : selectedPlayer.strengthOfSchedule <= 20 ? '#ffaa00' : '#ff3333'}
              />
              <DataRow
                label="DEF VS POS"
                value={selectedPlayer.defensiveStrengthVsPosition}
                color={selectedPlayer.defensiveStrengthVsPosition <= 10 ? '#00d26a' : '#ffaa00'}
              />
              <DataRow
                label="TREND"
                value={selectedPlayer.recentTrends}
                color={selectedPlayer.recentTrends === 'RISING' ? '#00d26a' : selectedPlayer.recentTrends === 'DECLINING' ? '#ff3333' : '#ffaa00'}
              />
            </div>

            {/* Usage Metrics */}
            <div style={{ color: '#ff6600', fontSize: '9px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>Usage & Opportunity</div>
            <div style={{ fontSize: '10px', marginBottom: '12px' }}>
              <DataRow label="RZ TOUCHES (LAST)" value={selectedPlayer.redZoneTouchesLastSeason} color="#ff6666" />
              <DataRow label="FANTASY REL WEEKS" value={`${selectedPlayer.fantasyRelevantWeeks}/17`} color="#00d26a" />
              <DataRow label="FLOOR WEEKS" value={selectedPlayer.floorWeeks} color="#ff6666" />
              <DataRow label="CEILING WEEKS" value={selectedPlayer.ceilingWeeks} color="#66ff66" />
            </div>

            {/* Handcuff Info */}
            {selectedPlayer.handcuffValue > 0 && (
              <div style={{ padding: '8px', background: 'rgba(0,136,255,0.05)', border: '1px solid #0088ff40', marginBottom: '12px' }}>
                <div style={{ color: '#0088ff', fontSize: '9px', textTransform: 'uppercase', marginBottom: '4px' }}>Handcuff Analysis</div>
                <DataRow label="HANDCUFF VALUE" value={`${selectedPlayer.handcuffValue}/100`} color="#0088ff" />
                {selectedPlayer.primaryBackup && (
                  <DataRow label="PRIMARY BACKUP" value={selectedPlayer.primaryBackup} color="#fff" />
                )}
              </div>
            )}

            {/* Injury History */}
            {selectedPlayer.injuryHistory.length > 0 && (
              <div style={{ padding: '8px', background: 'rgba(255,51,51,0.05)', border: '1px solid #ff333340' }}>
                <div style={{ color: '#ff6666', fontSize: '9px', textTransform: 'uppercase', marginBottom: '4px' }}>Injury History</div>
                {selectedPlayer.injuryHistory.map((injury, i) => (
                  <div key={i} style={{ fontSize: '9px', color: '#b0b0b0', marginBottom: '2px' }}>• {injury}</div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Draft Actions */}
          <div style={{ background: '#111', padding: '12px' }}>
            <div style={{ color: '#ff6600', fontSize: '10px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>Draft Action</div>

            {/* Analytics Summary */}
            {playerAnalytics && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '12px' }}>
                  <div style={{ background: '#0a0a0a', padding: '6px', border: '1px solid #333', textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: '8px' }}>OPEN BID</div>
                    <div style={{ color: '#ffaa00', fontSize: '14px', fontWeight: 700 }}>${playerAnalytics.openingBid}</div>
                  </div>
                  <div style={{ background: '#0a0a0a', padding: '6px', border: '1px solid #333', textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: '8px' }}>TARGET</div>
                    <div style={{ color: '#00d26a', fontSize: '14px', fontWeight: 700 }}>${playerAnalytics.targetBid}</div>
                  </div>
                  <div style={{ background: '#0a0a0a', padding: '6px', border: '1px solid #333', textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: '8px' }}>MAX BID</div>
                    <div style={{ color: '#ff6666', fontSize: '14px', fontWeight: 700 }}>${playerAnalytics.maxBid}</div>
                  </div>
                  <div style={{ background: '#0a0a0a', padding: '6px', border: '1px solid #333', textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: '8px' }}>WALK AWAY</div>
                    <div style={{ color: '#666', fontSize: '14px', fontWeight: 700 }}>${playerAnalytics.walkAwayPoint}</div>
                  </div>
                </div>

                <div style={{ fontSize: '9px', marginBottom: '8px' }}>
                  <DataRow label="SCARCITY" value={`${(playerAnalytics.scarcityFactor * 100).toFixed(0)}%`} color="#ffaa00" />
                  <DataRow label="BREAKOUT" value={`${playerAnalytics.breakoutPotential}%`} color="#00d26a" />
                  <DataRow label="REGRESSION" value={`${playerAnalytics.regressionRisk}%`} color="#ff6666" />
                  <DataRow label="CONFIDENCE" value={`${playerAnalytics.confidenceLevel}%`} color="#0088ff" />
                  <DataRow label="NEED MULT" value={`${playerAnalytics.needMultiplier.toFixed(2)}x`} color="#ffaa00" />
                </div>

                {/* Optimal Bid Range */}
                <div style={{ background: '#0a0a0a', padding: '8px', border: '1px solid #333', marginBottom: '8px' }}>
                  <div style={{ color: '#ff6600', fontSize: '8px', marginBottom: '4px' }}>OPTIMAL BID RANGE</div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#00d26a', fontSize: '14px', fontWeight: 700 }}>${playerAnalytics.optimalBidRange?.[0] || playerAnalytics.openingBid}</span>
                    <span style={{ color: '#666' }}>→</span>
                    <span style={{ color: '#ffaa00', fontSize: '14px', fontWeight: 700 }}>${playerAnalytics.optimalBidRange?.[1] || playerAnalytics.targetBid}</span>
                  </div>
                </div>

                {/* Value Metrics */}
                <div style={{ color: '#ff6600', fontSize: '8px', marginBottom: '6px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>VALUE METRICS</div>
                <div style={{ fontSize: '9px', marginBottom: '8px' }}>
                  <DataRow
                    label="MKT INFLATION"
                    value={`${(playerAnalytics.marketInflation * 100).toFixed(1)}%`}
                    color={playerAnalytics.marketInflation > 1.1 ? '#ff6666' : playerAnalytics.marketInflation < 0.9 ? '#00d26a' : '#ffaa00'}
                  />
                  <DataRow
                    label="VAL/BASELINE"
                    value={`${playerAnalytics.valueOverBaseline?.toFixed(1) || '0.0'}`}
                    color={playerAnalytics.valueOverBaseline > 0 ? '#00d26a' : '#ff6666'}
                  />
                  <DataRow
                    label="RISK-ADJ VAL"
                    value={`$${playerAnalytics.riskAdjustedValue?.toFixed(0) || playerAnalytics.adjustedValue}`}
                    color="#0088ff"
                  />
                  <DataRow
                    label="POS SCARCITY"
                    value={`${playerAnalytics.positionScarcity}%`}
                    color={playerAnalytics.positionScarcity > 60 ? '#ff6666' : playerAnalytics.positionScarcity > 30 ? '#ffaa00' : '#00d26a'}
                  />
                </div>

                {/* Risk Adjustments */}
                <div style={{ color: '#ff6600', fontSize: '8px', marginBottom: '6px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>RISK ADJUSTMENTS</div>
                <div style={{ fontSize: '9px', marginBottom: '8px' }}>
                  <DataRow
                    label="INJURY ADJ"
                    value={`${(playerAnalytics.injuryAdjustment * 100).toFixed(0)}%`}
                    color={playerAnalytics.injuryAdjustment < 1 ? '#ff6666' : '#00d26a'}
                  />
                  <DataRow
                    label="AGE ADJ"
                    value={`${(playerAnalytics.ageAdjustment * 100).toFixed(0)}%`}
                    color={playerAnalytics.ageAdjustment < 1 ? '#ff6666' : '#00d26a'}
                  />
                  <DataRow
                    label="COMP RISK"
                    value={`${playerAnalytics.competitionRisk}%`}
                    color={playerAnalytics.competitionRisk > 50 ? '#ff6666' : playerAnalytics.competitionRisk > 25 ? '#ffaa00' : '#00d26a'}
                  />
                </div>

                {/* Environment Scores */}
                <div style={{ color: '#ff6600', fontSize: '8px', marginBottom: '6px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>ENVIRONMENT SCORES</div>
                <div style={{ fontSize: '9px', marginBottom: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '4px' }}>
                    <div style={{ background: '#0a0a0a', padding: '4px', textAlign: 'center', border: '1px solid #222' }}>
                      <div style={{ color: '#666', fontSize: '7px' }}>CONTRACT</div>
                      <div style={{ color: playerAnalytics.contractSecurityScore > 70 ? '#00d26a' : playerAnalytics.contractSecurityScore > 40 ? '#ffaa00' : '#ff6666', fontSize: '11px', fontWeight: 700 }}>
                        {playerAnalytics.contractSecurityScore}
                      </div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '4px', textAlign: 'center', border: '1px solid #222' }}>
                      <div style={{ color: '#666', fontSize: '7px' }}>COACHING</div>
                      <div style={{ color: playerAnalytics.coachingStabilityScore > 70 ? '#00d26a' : playerAnalytics.coachingStabilityScore > 40 ? '#ffaa00' : '#ff6666', fontSize: '11px', fontWeight: 700 }}>
                        {playerAnalytics.coachingStabilityScore}
                      </div>
                    </div>
                    <div style={{ background: '#0a0a0a', padding: '4px', textAlign: 'center', border: '1px solid #222' }}>
                      <div style={{ color: '#666', fontSize: '7px' }}>TEAM ENV</div>
                      <div style={{ color: playerAnalytics.teamEnvironmentScore > 70 ? '#00d26a' : playerAnalytics.teamEnvironmentScore > 40 ? '#ffaa00' : '#ff6666', fontSize: '11px', fontWeight: 700 }}>
                        {playerAnalytics.teamEnvironmentScore}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Draft Strategy */}
                <div style={{ color: '#ff6600', fontSize: '8px', marginBottom: '6px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>DRAFT STRATEGY</div>
                <div style={{ fontSize: '9px', marginBottom: '8px' }}>
                  <DataRow label="IDEAL PICK" value={playerAnalytics.idealDraftPosition || 'N/A'} color="#0088ff" />
                  {playerAnalytics.handcuffRecommendation && (
                    <div style={{ marginTop: '4px', padding: '4px', background: '#0088ff10', border: '1px solid #0088ff40' }}>
                      <div style={{ color: '#0088ff', fontSize: '7px', marginBottom: '2px' }}>HANDCUFF REC</div>
                      <div style={{ color: '#fff', fontSize: '9px' }}>{playerAnalytics.handcuffRecommendation}</div>
                    </div>
                  )}
                  {playerAnalytics.backupTargets && playerAnalytics.backupTargets.length > 0 && (
                    <div style={{ marginTop: '4px', padding: '4px', background: '#00d26a10', border: '1px solid #00d26a40' }}>
                      <div style={{ color: '#00d26a', fontSize: '7px', marginBottom: '2px' }}>BACKUP TARGETS</div>
                      <div style={{ color: '#fff', fontSize: '9px' }}>{playerAnalytics.backupTargets.join(', ')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Draft Form */}
            <div>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ color: '#ff6600', fontSize: '9px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Drafting Team
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{
                    width: '100%', background: '#000', border: '1px solid #333',
                    color: '#fff', padding: '8px', fontFamily: 'var(--font-terminal)', fontSize: '11px',
                  }}
                >
                  <option value="">-- Select Team --</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} (${team.remaining})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: '#ff6600', fontSize: '9px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Bid Amount
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    style={{
                      flex: 1, background: '#000', border: '1px solid #333',
                      color: '#ffaa00', padding: '8px', fontFamily: 'var(--font-terminal)',
                      fontSize: '18px', fontWeight: 700, textAlign: 'center',
                    }}
                  />
                  <button className="terminal-button" style={{ padding: '4px 12px', fontSize: '14px' }} onClick={() => setBidAmount((Math.max(1, parseInt(bidAmount) - 1)).toString())}>-</button>
                  <button className="terminal-button" style={{ padding: '4px 12px', fontSize: '14px' }} onClick={() => setBidAmount((parseInt(bidAmount) + 1).toString())}>+</button>
                </div>
              </div>

              <button
                className="terminal-button primary"
                style={{ width: '100%', padding: '12px', fontSize: '12px', marginBottom: '8px' }}
                onClick={handleDraft}
                disabled={!selectedTeam || !bidAmount}
              >
                ▶ EXECUTE DRAFT
              </button>

              {/* Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <button
                  className="terminal-button"
                  style={{ fontSize: '9px', padding: '6px' }}
                  onClick={() => {
                    setWatchlist(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(selectedPlayer.id)) {
                        newSet.delete(selectedPlayer.id);
                      } else {
                        newSet.add(selectedPlayer.id);
                      }
                      return newSet;
                    });
                  }}
                >
                  {watchlist.has(selectedPlayer.id) ? '★ UNWATCH' : '☆ WATCH'}
                </button>
                <button
                  className="terminal-button"
                  style={{ fontSize: '9px', padding: '6px' }}
                  onClick={() => {
                    setComparePlayers(prev => [...prev.slice(0, 3), selectedPlayer]);
                    setCompareMode(true);
                    setShowPlayerModal(false);
                  }}
                >
                  + COMPARE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render recent picks bar
  const renderRecentPicks = () => (
    <div className="terminal-panel" style={{ gridColumn: 'span 3' }}>
      <PanelHeader title="RECENT PICKS" subtitle={`${draftedPlayers.length} TOTAL`} />
      <div className="panel-content" style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '8px' }}>
        {draftedPlayers.slice(-20).reverse().map((player) => {
          const team = teams.find(t => t.id === player.draftedBy);
          const valueDiff = player.estimatedValue - (player.draftCost || 0);
          return (
            <div
              key={player.id}
              style={{
                flex: '0 0 130px',
                background: '#0a0a0a',
                border: `1px solid ${valueDiff >= 0 ? '#00d26a40' : '#ff333340'}`,
                padding: '8px',
                fontSize: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#ff6600', fontWeight: 700 }}>#{player.pickNumber}</span>
                <span className={`position-badge ${getPositionClass(player.position)}`} style={{ fontSize: '8px' }}>{player.position}</span>
              </div>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {player.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: '#ffaa00', fontWeight: 700 }}>${player.draftCost}</span>
                <span style={{ color: valueDiff >= 0 ? '#00d26a' : '#ff3333', fontSize: '9px' }}>
                  {valueDiff >= 0 ? '+' : ''}{valueDiff}
                </span>
              </div>
              <div style={{ color: '#666', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {team?.name}
              </div>
            </div>
          );
        })}
        {draftedPlayers.length === 0 && (
          <div style={{ color: '#666', fontSize: '11px', padding: '20px', width: '100%', textAlign: 'center' }}>
            No picks yet. Start the simulation or draft a player to see picks here.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bloomberg-terminal">
      {/* Terminal Header */}
      <header className="terminal-header">
        <div className="terminal-logo">DRAFT VAULT TERMINAL</div>
        <div className="function-keys">
          {FUNCTION_KEYS.map(fk => (
            <button
              key={fk.key}
              className={`function-key ${activePanel === fk.action ? 'active' : ''}`}
              style={activePanel === fk.action ? { background: '#ff6600', color: '#000' } : {}}
              onClick={() => setActivePanel(fk.action)}
            >
              {fk.key}<span className="function-key-label">{fk.label}</span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: '#ffaa00', fontSize: '11px', fontFamily: 'var(--font-terminal)' }}>
            {currentTime.toLocaleTimeString()}
          </div>
          <div className={`status-indicator ${isSimulating ? 'warning' : ''}`} />
          <span style={{ color: isSimulating ? '#ffaa00' : '#00d26a', fontSize: '10px' }}>
            {isSimulating ? 'SIMULATING' : 'READY'}
          </span>
        </div>
      </header>

      {/* Ticker Bar */}
      <div className="ticker-bar">
        <div className="ticker-content">
          {[...tickerData, ...tickerData].map((item, i) => (
            <div key={i} className="ticker-item">
              <span style={{ color: item.color, fontSize: '10px' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Player Modal */}
      {renderPlayerModal()}

      {/* Main Grid - Conditional based on active panel */}
      <div className="terminal-grid grid-main">
        {activePanel === 'help' && renderHelpPanel()}
        {activePanel === 'news' && renderNewsPanel()}
        {activePanel === 'chart' && renderChartsPanel()}
        {activePanel === 'alerts' && renderAlertsPanel()}
        {activePanel === 'draft' && renderDraftPanel()}
        {activePanel === 'teams' && renderTeamsPanel()}
        {activePanel === 'analytics' && renderAnalyticsPanel()}
        {activePanel === 'trade' && renderTradePanel()}
      </div>

      {/* Recent Picks - Always visible */}
      {activePanel === 'draft' && (
        <div className="terminal-grid" style={{ gridTemplateColumns: '1fr' }}>
          {renderRecentPicks()}
        </div>
      )}

      {/* Status Bar */}
      <footer className="status-bar">
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="status-item">
            <span className="status-label">PLAYERS:</span>
            <span className="status-value">{draftStats.remaining}/{draftStats.totalPlayers}</span>
          </div>
          <div className="status-item">
            <span className="status-label">DRAFTED:</span>
            <span className="status-value">{draftStats.drafted}</span>
          </div>
          <div className="status-item">
            <span className="status-label">AVG COST:</span>
            <span className="status-value">${draftStats.avgCost}</span>
          </div>
          <div className="status-item">
            <span className="status-label">EFFICIENCY:</span>
            <span className="status-value" style={{ color: draftStats.valueEfficiency >= 100 ? '#00d26a' : '#ff3333' }}>{draftStats.valueEfficiency}%</span>
          </div>
          <div className="status-item">
            <span className="status-label">BUDGET:</span>
            <span className="status-value">${draftStats.remainingBudget}/${draftStats.totalBudget}</span>
          </div>
          <div className="status-item">
            <span className="status-label">PROGRESS:</span>
            <span className="status-value">{draftStats.progress}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="status-item">
            <span className="status-indicator" />
            <span style={{ color: '#b0b0b0' }}>CONNECTED</span>
          </div>
          <div className="status-item">
            <span style={{ color: '#666' }}>PANEL:</span>
            <span style={{ color: '#ff6600' }}>{activePanel.toUpperCase()}</span>
          </div>
          <div className="status-item">
            <span className="status-label">DRAFT VAULT TERMINAL v2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BloombergDraftInterface;
