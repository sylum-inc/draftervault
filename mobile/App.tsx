import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useState } from 'react';

// Mock player data
const players = [
  { id: 1, name: "Ja'Marr Chase", team: 'CIN', position: 'WR', adp: 3, trend: '+2' },
  { id: 2, name: 'CeeDee Lamb', team: 'DAL', position: 'WR', adp: 4, trend: '+1' },
  { id: 3, name: 'Bijan Robinson', team: 'ATL', position: 'RB', adp: 5, trend: '-1' },
  { id: 4, name: 'Breece Hall', team: 'NYJ', position: 'RB', adp: 6, trend: '0' },
  { id: 5, name: 'Tyreek Hill', team: 'MIA', position: 'WR', adp: 7, trend: '+3' },
  { id: 6, name: 'A.J. Brown', team: 'PHI', position: 'WR', adp: 8, trend: '-2' },
  { id: 7, name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR', adp: 9, trend: '+1' },
  { id: 8, name: 'Garrett Wilson', team: 'NYJ', position: 'WR', adp: 10, trend: '0' },
  { id: 9, name: 'Saquon Barkley', team: 'PHI', position: 'RB', adp: 11, trend: '+4' },
  { id: 10, name: 'Travis Kelce', team: 'KC', position: 'TE', adp: 12, trend: '-1' },
];

const positionColors: Record<string, string> = {
  QB: '#ff6b6b',
  RB: '#4ecdc4',
  WR: '#45b7d1',
  TE: '#f9ca24',
  K: '#6c5ce7',
  DEF: '#a29bfe',
};

function PlayerCard({ player }: { player: (typeof players)[0] }) {
  const trendColor = player.trend.startsWith('+')
    ? '#00ff88'
    : player.trend.startsWith('-')
      ? '#ff4757'
      : '#888';

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <View style={[styles.positionBadge, { backgroundColor: positionColors[player.position] }]}>
          <Text style={styles.positionText}>{player.position}</Text>
        </View>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.playerTeam}>{player.team}</Text>
        </View>
      </View>
      <View style={styles.playerStats}>
        <Text style={styles.adpLabel}>ADP</Text>
        <Text style={styles.adpValue}>{player.adp}</Text>
        <Text style={[styles.trend, { color: trendColor }]}>{player.trend}</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('rankings');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>DRAFT VAULT</Text>
        <Text style={styles.subtitle}>Fantasy Football Intelligence</Text>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>247</Text>
          <Text style={styles.statLabel}>Players</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>32</Text>
          <Text style={styles.statLabel}>Teams</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>~500</Text>
          <Text style={styles.statLabel}>Rookies</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNav}>
        {['rankings', 'rookies', 'analysis'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Player List */}
      <ScrollView style={styles.playerList}>
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </ScrollView>

      {/* AI Assistant Button */}
      <TouchableOpacity style={styles.aiButton}>
        <Text style={styles.aiButtonText}>AI</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00ff88',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    letterSpacing: 2,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    letterSpacing: 1,
    marginTop: 2,
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00ff88',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    letterSpacing: 1,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#00ff88',
  },
  playerList: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#12121f',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  playerDetails: {
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  playerTeam: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  playerStats: {
    alignItems: 'flex-end',
  },
  adpLabel: {
    fontSize: 10,
    color: '#666',
    letterSpacing: 1,
  },
  adpValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  trend: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  aiButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  aiButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
