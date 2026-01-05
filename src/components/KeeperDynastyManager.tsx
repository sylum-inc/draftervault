import { useState } from 'react';
import { Crown, Star, Lock, Unlock, Plus, Trash2, Search, Save, Download, Upload, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Player, Team } from '@/services/auctionDraftService';

interface KeeperPlayer {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  keeperCost: number;
  originalCost: number;
  yearsKept: number;
  maxYears: number;
  roundPenalty?: number;
  teamId: string;
}

interface DynastySettings {
  enabled: boolean;
  rookieDraft: boolean;
  rookieRounds: number;
  taxiSquadSize: number;
  irSpots: number;
  contractYears: boolean;
  salaryCapEnabled: boolean;
  salaryCap: number;
}

interface KeeperDynastyManagerProps {
  teams: Team[];
  players: Player[];
  keepers: KeeperPlayer[];
  onKeepersUpdate: (keepers: KeeperPlayer[]) => void;
  dynastySettings: DynastySettings;
  onDynastySettingsUpdate: (settings: DynastySettings) => void;
}

const DEFAULT_DYNASTY_SETTINGS: DynastySettings = {
  enabled: false,
  rookieDraft: false,
  rookieRounds: 3,
  taxiSquadSize: 3,
  irSpots: 2,
  contractYears: false,
  salaryCapEnabled: false,
  salaryCap: 200,
};

export const KeeperDynastyManager = ({
  teams,
  players,
  keepers,
  onKeepersUpdate,
  dynastySettings = DEFAULT_DYNASTY_SETTINGS,
  onDynastySettingsUpdate,
}: KeeperDynastyManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [editingKeeper, setEditingKeeper] = useState<KeeperPlayer | null>(null);

  const calculateKeeperCost = (originalCost: number, yearsKept: number, roundPenalty: number = 5): number => {
    // Common keeper cost calculation: original cost + $5 per year kept
    return originalCost + (yearsKept * roundPenalty);
  };

  const addKeeper = (player: Player, teamId: string, originalCost: number) => {
    const keeperCost = calculateKeeperCost(originalCost, 1);

    const newKeeper: KeeperPlayer = {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      keeperCost,
      originalCost,
      yearsKept: 1,
      maxYears: 3,
      teamId,
    };

    onKeepersUpdate([...keepers, newKeeper]);
  };

  const removeKeeper = (playerId: string) => {
    onKeepersUpdate(keepers.filter(k => k.playerId !== playerId));
  };

  const updateKeeper = (updatedKeeper: KeeperPlayer) => {
    onKeepersUpdate(keepers.map(k =>
      k.playerId === updatedKeeper.playerId ? updatedKeeper : k
    ));
    setEditingKeeper(null);
  };

  const getTeamKeepers = (teamId: string) => {
    return keepers.filter(k => k.teamId === teamId);
  };

  const getTotalKeeperCost = (teamId: string) => {
    return getTeamKeepers(teamId).reduce((sum, k) => sum + k.keeperCost, 0);
  };

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const notKept = !keepers.find(k => k.playerId === p.id);
    return matchesSearch && notKept;
  });

  const exportKeepers = () => {
    const data = {
      keepers,
      dynastySettings,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'draft-vault-keepers.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importKeepers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      if (data.keepers) {
        onKeepersUpdate(data.keepers);
      }
      if (data.dynastySettings) {
        onDynastySettingsUpdate(data.dynastySettings);
      }
    } catch (error) {
      console.error('Failed to import keepers:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Crown className="w-4 h-4" />
          Keepers & Dynasty
        </Button>
      </DialogTrigger>
      <DialogContent className="modal-content max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="gradient-text text-2xl flex items-center gap-2">
            <Crown className="w-6 h-6" />
            Keeper & Dynasty League Manager
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="keepers" className="mt-4">
          <TabsList className="grid w-full grid-cols-3 tab-nav">
            <TabsTrigger value="keepers" className="tab-item data-[state=active]:active">
              <Lock className="w-4 h-4 mr-2" />
              Keepers
            </TabsTrigger>
            <TabsTrigger value="dynasty" className="tab-item data-[state=active]:active">
              <Star className="w-4 h-4 mr-2" />
              Dynasty
            </TabsTrigger>
            <TabsTrigger value="settings" className="tab-item data-[state=active]:active">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Keepers Tab */}
          <TabsContent value="keepers" className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players to add as keepers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Keeper Search Results */}
            {searchQuery && (
              <Card className="glass-card">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Add Keeper</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[150px]">
                    <div className="divide-y divide-border">
                      {filteredPlayers.slice(0, 10).map(player => (
                        <div key={player.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{player.position}</Badge>
                            <span className="font-medium">{player.name}</span>
                            <span className="text-sm text-muted-foreground">({player.team})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select onValueChange={(teamId) => addKeeper(player, teamId, 10)}>
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue placeholder="Add to team" />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map(team => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Team Keepers */}
            <div className="grid grid-cols-2 gap-4">
              {teams.map(team => {
                const teamKeepers = getTeamKeepers(team.id);
                const totalCost = getTotalKeeperCost(team.id);

                return (
                  <Card key={team.id} className="glass-card">
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{team.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          ${totalCost} in keepers
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-2">
                      {teamKeepers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No keepers set
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {teamKeepers.map(keeper => (
                            <div
                              key={keeper.playerId}
                              className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                            >
                              <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-primary" />
                                <div>
                                  <span className="text-sm font-medium">{keeper.playerName}</span>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="text-[10px] px-1">
                                      {keeper.position}
                                    </Badge>
                                    <span>Year {keeper.yearsKept}/{keeper.maxYears}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">${keeper.keeperCost}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setEditingKeeper(keeper)}
                                >
                                  <Settings className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-400"
                                  onClick={() => removeKeeper(keeper.playerId)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Import/Export */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportKeepers}>
                <Download className="w-4 h-4 mr-2" />
                Export Keepers
              </Button>
              <Button variant="outline" asChild>
                <label>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Keepers
                  <input
                    type="file"
                    className="hidden"
                    accept=".json"
                    onChange={importKeepers}
                  />
                </label>
              </Button>
            </div>
          </TabsContent>

          {/* Dynasty Tab */}
          <TabsContent value="dynasty" className="space-y-4 mt-4">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Dynasty Mode</CardTitle>
                  <Switch
                    checked={dynastySettings.enabled}
                    onCheckedChange={(enabled) =>
                      onDynastySettingsUpdate({ ...dynastySettings, enabled })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {dynastySettings.enabled && (
                  <>
                    {/* Rookie Draft */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Rookie Draft</Label>
                          <p className="text-xs text-muted-foreground">
                            Enable separate rookie-only draft
                          </p>
                        </div>
                        <Switch
                          checked={dynastySettings.rookieDraft}
                          onCheckedChange={(rookieDraft) =>
                            onDynastySettingsUpdate({ ...dynastySettings, rookieDraft })
                          }
                        />
                      </div>

                      {dynastySettings.rookieDraft && (
                        <div className="pl-4 border-l-2 border-primary/30">
                          <Label>Rookie Draft Rounds</Label>
                          <Select
                            value={dynastySettings.rookieRounds.toString()}
                            onValueChange={(value) =>
                              onDynastySettingsUpdate({
                                ...dynastySettings,
                                rookieRounds: parseInt(value),
                              })
                            }
                          >
                            <SelectTrigger className="w-24 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Taxi Squad */}
                    <div className="space-y-3">
                      <Label>Taxi Squad Size</Label>
                      <p className="text-xs text-muted-foreground">
                        Developmental spots for rookies
                      </p>
                      <Select
                        value={dynastySettings.taxiSquadSize.toString()}
                        onValueChange={(value) =>
                          onDynastySettingsUpdate({
                            ...dynastySettings,
                            taxiSquadSize: parseInt(value),
                          })
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={n.toString()}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* IR Spots */}
                    <div className="space-y-3">
                      <Label>IR Spots</Label>
                      <p className="text-xs text-muted-foreground">
                        Injured reserve slots
                      </p>
                      <Select
                        value={dynastySettings.irSpots.toString()}
                        onValueChange={(value) =>
                          onDynastySettingsUpdate({
                            ...dynastySettings,
                            irSpots: parseInt(value),
                          })
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={n.toString()}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Contract Years */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Contract Years</Label>
                        <p className="text-xs text-muted-foreground">
                          Track multi-year contracts
                        </p>
                      </div>
                      <Switch
                        checked={dynastySettings.contractYears}
                        onCheckedChange={(contractYears) =>
                          onDynastySettingsUpdate({ ...dynastySettings, contractYears })
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Keeper Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Max Keepers Per Team</Label>
                    <Select defaultValue="3">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 'Unlimited'].map(n => (
                          <SelectItem key={n.toString()} value={n.toString()}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Max Years to Keep</Label>
                    <Select defaultValue="3">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 'Forever'].map(n => (
                          <SelectItem key={n.toString()} value={n.toString()}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Cost Increase Per Year</Label>
                    <Select defaultValue="5">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 5, 10, 15, 20, '10%'].map(n => (
                          <SelectItem key={n.toString()} value={n.toString()}>
                            ${n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Minimum Keeper Cost</Label>
                    <Select defaultValue="1">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 5, 10].map(n => (
                          <SelectItem key={n.toString()} value={n.toString()}>
                            ${n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Salary Cap Settings */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label>Salary Cap</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable budget restrictions
                      </p>
                    </div>
                    <Switch
                      checked={dynastySettings.salaryCapEnabled}
                      onCheckedChange={(salaryCapEnabled) =>
                        onDynastySettingsUpdate({ ...dynastySettings, salaryCapEnabled })
                      }
                    />
                  </div>

                  {dynastySettings.salaryCapEnabled && (
                    <div>
                      <Label>Cap Amount</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={dynastySettings.salaryCap}
                          onChange={(e) =>
                            onDynastySettingsUpdate({
                              ...dynastySettings,
                              salaryCap: parseInt(e.target.value) || 200,
                            })
                          }
                          className="w-24"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button className="w-full btn-premium">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </TabsContent>
        </Tabs>

        {/* Edit Keeper Modal */}
        {editingKeeper && (
          <Dialog open={!!editingKeeper} onOpenChange={() => setEditingKeeper(null)}>
            <DialogContent className="modal-content max-w-sm">
              <DialogHeader>
                <DialogTitle>Edit Keeper</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Player</Label>
                  <p className="font-medium">{editingKeeper.playerName}</p>
                </div>

                <div>
                  <Label>Original Cost</Label>
                  <Input
                    type="number"
                    value={editingKeeper.originalCost}
                    onChange={(e) =>
                      setEditingKeeper({
                        ...editingKeeper,
                        originalCost: parseInt(e.target.value) || 0,
                        keeperCost: calculateKeeperCost(
                          parseInt(e.target.value) || 0,
                          editingKeeper.yearsKept
                        ),
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Years Kept</Label>
                  <Select
                    value={editingKeeper.yearsKept.toString()}
                    onValueChange={(value) => {
                      const years = parseInt(value);
                      setEditingKeeper({
                        ...editingKeeper,
                        yearsKept: years,
                        keeperCost: calculateKeeperCost(editingKeeper.originalCost, years),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} year{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Keeper Cost</Label>
                  <p className="text-2xl font-bold text-primary">
                    ${editingKeeper.keeperCost}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 btn-premium"
                    onClick={() => updateKeeper(editingKeeper)}
                  >
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingKeeper(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KeeperDynastyManager;
