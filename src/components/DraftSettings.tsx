import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, Settings2, Trophy, DollarSign, Clock, Target } from 'lucide-react';
import { AuctionDraftService, Team } from '@/services/auctionDraftService';
import { toast } from 'sonner';

interface DraftSettingsProps {
  draftService: AuctionDraftService;
  onSettingsChange: () => void;
  userTeamId?: string;
  onUserTeamChange?: (teamId: string) => void;
}

interface DraftConfig {
  draftType: 'auction' | 'snake' | 'keeper';
  scoringSystem: 'ppr' | 'half-ppr' | 'standard';
  budget: number;
  minBid: number;
  bidTimer: number;
  rosterPositions: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number;
    DEF: number;
    K: number;
    BENCH: number;
  };
  tradingEnabled: boolean;
  waiverPriority: 'faab' | 'rolling' | 'inverse';
  playoffWeeks: number;
  regularSeasonWeeks: number;
}

export const DraftSettings: React.FC<DraftSettingsProps> = ({ 
  draftService, 
  onSettingsChange, 
  userTeamId,
  onUserTeamChange 
}) => {
  const [teams, setTeams] = useState<Team[]>(draftService.getTeams());
  const [config, setConfig] = useState<DraftConfig>({
    draftType: 'auction',
    scoringSystem: 'ppr',
    budget: 200,
    minBid: 1,
    bidTimer: 30,
    rosterPositions: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 2,
      DEF: 1,
      K: 1,
      BENCH: 6
    },
    tradingEnabled: true,
    waiverPriority: 'faab',
    playoffWeeks: 4,
    regularSeasonWeeks: 14
  });
  
  const [selectedUserTeam, setSelectedUserTeam] = useState<string>(userTeamId || teams[0]?.id || '');

  const addTeam = () => {
    if (teams.length >= 16) {
      toast.error('Maximum 16 teams allowed');
      return;
    }

    const newTeam: Team = {
      id: `team-${teams.length + 1}`,
      name: `Team ${teams.length + 1}`,
      budget: config.budget,
      spent: 0,
      remaining: config.budget,
      roster: { QB: 0, RB: 0, WR: 0, TE: 0 },
      projectedTotal: 0,
      strengthScore: 0,
      riskScore: 0,
      depthScore: 0,
      injuryInsurance: 0
    };

    const updatedTeams = [...teams, newTeam];
    setTeams(updatedTeams);
    updateDraftService(updatedTeams);
    toast.success('Team added successfully');
  };

  const removeTeam = (teamId: string) => {
    if (teams.length <= 2) {
      toast.error('Minimum 2 teams required');
      return;
    }

    const updatedTeams = teams.filter(team => team.id !== teamId);
    setTeams(updatedTeams);
    updateDraftService(updatedTeams);
    toast.success('Team removed successfully');
  };

  const updateTeamName = (teamId: string, newName: string) => {
    const updatedTeams = teams.map(team => 
      team.id === teamId ? { ...team, name: newName } : team
    );
    setTeams(updatedTeams);
    updateDraftService(updatedTeams);
  };

  const updateTeamBudget = (teamId: string, newBudget: number) => {
    const updatedTeams = teams.map(team => 
      team.id === teamId ? { 
        ...team, 
        budget: newBudget,
        remaining: newBudget - team.spent
      } : team
    );
    setTeams(updatedTeams);
    updateDraftService(updatedTeams);
  };

  const updateDraftService = (updatedTeams: Team[]) => {
    // Update the draft service with new teams
    // This would require adding a method to AuctionDraftService
    onSettingsChange();
  };

  const resetDraft = () => {
    draftService.resetDraft();
    toast.success('Draft reset successfully');
    onSettingsChange();
  };

  const applySettings = () => {
    // Apply all configuration changes
    teams.forEach(team => {
      draftService.updateTeamBudget(team.id, team.budget);
    });
    
    toast.success('Settings applied successfully');
    onSettingsChange();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Draft Settings</h2>
          <p className="text-muted-foreground">Configure your draft parameters and league settings</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={resetDraft} variant="outline">
            Reset Draft
          </Button>
          <Button onClick={applySettings}>
            Apply Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="teams" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="teams" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Teams</span>
          </TabsTrigger>
          <TabsTrigger value="draft" className="flex items-center space-x-2">
            <Settings2 className="w-4 h-4" />
            <span>Draft</span>
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center space-x-2">
            <Trophy className="w-4 h-4" />
            <span>Scoring</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>Advanced</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Team Management</span>
              </CardTitle>
              <CardDescription>
                Add, remove, and configure teams for your draft
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{teams.length} Teams</Badge>
                  <span className="text-sm text-muted-foreground">
                    (Min: 2, Max: 16)
                  </span>
                </div>
                <Button onClick={addTeam} size="sm" className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Add Team</span>
                </Button>
              </div>

              <Separator />

              <div className="grid gap-4">
                {teams.map((team, index) => (
                  <div key={team.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`team-name-${team.id}`}>Team Name</Label>
                        <Input
                          id={`team-name-${team.id}`}
                          value={team.name}
                          onChange={(e) => updateTeamName(team.id, e.target.value)}
                          placeholder="Enter team name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`team-budget-${team.id}`}>Budget</Label>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <Input
                            id={`team-budget-${team.id}`}
                            type="number"
                            value={team.budget}
                            onChange={(e) => updateTeamBudget(team.id, parseInt(e.target.value) || 0)}
                            min="100"
                            max="500"
                          />
                        </div>
                      </div>
                       <div className="flex items-center space-x-4">
                         <div>
                           <Label>Status</Label>
                           <div className="flex items-center space-x-2 mt-1">
                             <Badge variant="outline">
                               Remaining: ${team.remaining}
                             </Badge>
                             {selectedUserTeam === team.id && (
                               <Badge className="bg-primary text-primary-foreground">
                                 Your Team
                               </Badge>
                             )}
                           </div>
                         </div>
                         <div>
                           <Button
                             onClick={() => {
                               setSelectedUserTeam(team.id);
                               onUserTeamChange?.(team.id);
                             }}
                             variant={selectedUserTeam === team.id ? "default" : "outline"}
                             size="sm"
                           >
                             {selectedUserTeam === team.id ? "Selected" : "Select"}
                           </Button>
                         </div>
                        {teams.length > 2 && (
                          <Button
                            onClick={() => removeTeam(team.id)}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Draft Type</CardTitle>
                <CardDescription>Choose your draft format</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Draft Format</Label>
                  <Select value={config.draftType} onValueChange={(value) => setConfig({...config, draftType: value as any})}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select draft type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="auction">Auction Draft</SelectItem>
                      <SelectItem value="snake">Snake Draft</SelectItem>
                      <SelectItem value="keeper">Keeper League</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget">Default Budget</Label>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="budget"
                      type="number"
                      value={config.budget}
                      onChange={(e) => setConfig({...config, budget: parseInt(e.target.value) || 200})}
                      min="100"
                      max="500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="minBid">Minimum Bid</Label>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="minBid"
                      type="number"
                      value={config.minBid}
                      onChange={(e) => setConfig({...config, minBid: parseInt(e.target.value) || 1})}
                      min="1"
                      max="10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="bidTimer">Bid Timer (seconds)</Label>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="bidTimer"
                      type="number"
                      value={config.bidTimer}
                      onChange={(e) => setConfig({...config, bidTimer: parseInt(e.target.value) || 30})}
                      min="10"
                      max="120"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Season Settings</CardTitle>
                <CardDescription>Configure season structure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="regularWeeks">Regular Season Weeks</Label>
                  <Input
                    id="regularWeeks"
                    type="number"
                    value={config.regularSeasonWeeks}
                    onChange={(e) => setConfig({...config, regularSeasonWeeks: parseInt(e.target.value) || 14})}
                    min="10"
                    max="17"
                  />
                </div>

                <div>
                  <Label htmlFor="playoffWeeks">Playoff Weeks</Label>
                  <Input
                    id="playoffWeeks"
                    type="number"
                    value={config.playoffWeeks}
                    onChange={(e) => setConfig({...config, playoffWeeks: parseInt(e.target.value) || 4})}
                    min="1"
                    max="6"
                  />
                </div>

                <div>
                  <Label>Waiver Priority</Label>
                  <Select value={config.waiverPriority} onValueChange={(value) => setConfig({...config, waiverPriority: value as any})}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="faab">FAAB (Free Agent Auction Budget)</SelectItem>
                      <SelectItem value="rolling">Rolling Waivers</SelectItem>
                      <SelectItem value="inverse">Inverse Standings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="trading">Trading Enabled</Label>
                  <Switch
                    id="trading"
                    checked={config.tradingEnabled}
                    onCheckedChange={(checked) => setConfig({...config, tradingEnabled: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scoring" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scoring System</CardTitle>
                <CardDescription>Configure point values</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Scoring Format</Label>
                  <Select value={config.scoringSystem} onValueChange={(value) => setConfig({...config, scoringSystem: value as any})}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="ppr">PPR (Point Per Reception)</SelectItem>
                      <SelectItem value="half-ppr">Half PPR (0.5 Per Reception)</SelectItem>
                      <SelectItem value="standard">Standard (No PPR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-semibold">Standard Scoring</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span>Passing TD:</span><span>4 pts</span>
                    <span>Passing Yard:</span><span>0.04 pts</span>
                    <span>Rushing TD:</span><span>6 pts</span>
                    <span>Rushing Yard:</span><span>0.1 pts</span>
                    <span>Receiving TD:</span><span>6 pts</span>
                    <span>Receiving Yard:</span><span>0.1 pts</span>
                    <span>Reception:</span><span>{config.scoringSystem === 'ppr' ? '1 pt' : config.scoringSystem === 'half-ppr' ? '0.5 pts' : '0 pts'}</span>
                    <span>Interception:</span><span>-2 pts</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Roster Positions</CardTitle>
                <CardDescription>Set starting lineup requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="qb-pos">Quarterback (QB)</Label>
                    <Input
                      id="qb-pos"
                      type="number"
                      value={config.rosterPositions.QB}
                      onChange={(e) => setConfig({
                        ...config, 
                        rosterPositions: {...config.rosterPositions, QB: parseInt(e.target.value) || 1}
                      })}
                      min="0"
                      max="3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rb-pos">Running Back (RB)</Label>
                    <Input
                      id="rb-pos"
                      type="number"
                      value={config.rosterPositions.RB}
                      onChange={(e) => setConfig({
                        ...config, 
                        rosterPositions: {...config.rosterPositions, RB: parseInt(e.target.value) || 2}
                      })}
                      min="0"
                      max="4"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wr-pos">Wide Receiver (WR)</Label>
                    <Input
                      id="wr-pos"
                      type="number"
                      value={config.rosterPositions.WR}
                      onChange={(e) => setConfig({
                        ...config, 
                        rosterPositions: {...config.rosterPositions, WR: parseInt(e.target.value) || 2}
                      })}
                      min="0"
                      max="4"
                    />
                  </div>
                  <div>
                    <Label htmlFor="te-pos">Tight End (TE)</Label>
                    <Input
                      id="te-pos"
                      type="number"
                      value={config.rosterPositions.TE}
                      onChange={(e) => setConfig({
                        ...config, 
                        rosterPositions: {...config.rosterPositions, TE: parseInt(e.target.value) || 1}
                      })}
                      min="0"
                      max="3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="flex-pos">Flex (RB/WR/TE)</Label>
                    <Input
                      id="flex-pos"
                      type="number"
                      value={config.rosterPositions.FLEX}
                      onChange={(e) => setConfig({
                        ...config, 
                        rosterPositions: {...config.rosterPositions, FLEX: parseInt(e.target.value) || 2}
                      })}
                      min="0"
                      max="4"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bench-pos">Bench</Label>
                    <Input
                      id="bench-pos"
                      type="number"
                      value={config.rosterPositions.BENCH}
                      onChange={(e) => setConfig({
                        ...config, 
                        rosterPositions: {...config.rosterPositions, BENCH: parseInt(e.target.value) || 6}
                      })}
                      min="4"
                      max="10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Additional configuration options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold">Draft Preferences</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Auto-draft for inactive managers</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Allow draft pausing</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Show player recommendations</Label>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">League Preferences</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Commissioner approval for trades</Label>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Waiver claims processed daily</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Allow add/drops during games</Label>
                      <Switch />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-4">Import/Export</h4>
                <div className="flex space-x-2">
                  <Button variant="outline">Export Settings</Button>
                  <Button variant="outline">Import Settings</Button>
                  <Button variant="outline">Export Player Rankings</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};