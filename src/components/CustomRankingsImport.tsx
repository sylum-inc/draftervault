import { useState, useCallback } from 'react';
import { Upload, FileText, Download, AlertCircle, Check, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Player } from '@/services/auctionDraftService';

interface CustomRanking {
  playerId: string;
  playerName: string;
  position: string;
  customRank: number;
  customValue?: number;
  notes?: string;
  tier?: number;
}

interface CustomRankingsImportProps {
  players: Player[];
  onImport: (rankings: CustomRanking[]) => void;
  existingRankings?: CustomRanking[];
}

interface ParsedRow {
  name: string;
  position?: string;
  rank: number;
  value?: number;
  tier?: number;
  notes?: string;
  matched?: Player;
  error?: string;
}

export const CustomRankingsImport = ({
  players,
  onImport,
  existingRankings = [],
}: CustomRankingsImportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [manualEntry, setManualEntry] = useState('');
  const [importSource, setImportSource] = useState<string>('');

  const downloadTemplate = () => {
    const headers = 'Name,Position,Rank,Value,Tier,Notes';
    const exampleRows = [
      'Patrick Mahomes,QB,1,65,1,Elite QB1',
      'Travis Kelce,TE,2,55,1,Top TE',
      'Tyreek Hill,WR,3,52,1,',
      'Christian McCaffrey,RB,4,60,1,Injury risk',
    ];
    const csv = [headers, ...exampleRows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'draft-vault-rankings-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const findMatchingPlayer = useCallback((name: string, position?: string): Player | undefined => {
    const normalizedName = name.toLowerCase().trim();

    // Exact match first
    let match = players.find(p =>
      p.name.toLowerCase() === normalizedName &&
      (!position || p.position === position)
    );

    if (match) return match;

    // Partial match (last name)
    const lastName = normalizedName.split(' ').pop() || '';
    match = players.find(p =>
      p.name.toLowerCase().includes(lastName) &&
      (!position || p.position === position)
    );

    if (match) return match;

    // Fuzzy match - check if names are similar
    match = players.find(p => {
      const playerNameLower = p.name.toLowerCase();
      const similarity = calculateSimilarity(normalizedName, playerNameLower);
      return similarity > 0.8 && (!position || p.position === position);
    });

    return match;
  }, [players]);

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  };

  const parseCSV = (content: string): ParsedRow[] => {
    const lines = content.trim().split('\n');
    const errors: string[] = [];
    const results: ParsedRow[] = [];

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes('name') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim());

      if (parts.length < 2) {
        errors.push(`Line ${i + 1}: Invalid format`);
        continue;
      }

      const [name, position, rankStr, valueStr, tierStr, notes] = parts;

      const rank = parseInt(rankStr) || i - startIndex + 1;
      const value = valueStr ? parseInt(valueStr) : undefined;
      const tier = tierStr ? parseInt(tierStr) : undefined;

      const matched = findMatchingPlayer(name, position);

      const row: ParsedRow = {
        name,
        position,
        rank,
        value,
        tier,
        notes,
        matched,
        error: matched ? undefined : `Player "${name}" not found`,
      };

      if (!matched) {
        errors.push(`Line ${i + 1}: Player "${name}" not found in database`);
      }

      results.push(row);
    }

    setParseErrors(errors);
    return results;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportSource(file.name);

    const content = await file.text();
    const parsed = parseCSV(content);
    setParsedData(parsed);
  };

  const handleManualParse = () => {
    if (!manualEntry.trim()) return;

    setImportSource('Manual Entry');
    const parsed = parseCSV(manualEntry);
    setParsedData(parsed);
  };

  const handleImport = () => {
    const rankings: CustomRanking[] = parsedData
      .filter(row => row.matched)
      .map(row => ({
        playerId: row.matched!.id,
        playerName: row.matched!.name,
        position: row.matched!.position,
        customRank: row.rank,
        customValue: row.value,
        notes: row.notes,
        tier: row.tier,
      }));

    onImport(rankings);
    setIsOpen(false);
    setParsedData([]);
    setManualEntry('');
    setImportSource('');
  };

  const removeRow = (index: number) => {
    setParsedData(prev => prev.filter((_, i) => i !== index));
  };

  const matchedCount = parsedData.filter(r => r.matched).length;
  const unmatchedCount = parsedData.filter(r => !r.matched).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Import Rankings
        </Button>
      </DialogTrigger>
      <DialogContent className="modal-content max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="gradient-text text-2xl flex items-center gap-2">
            <Upload className="w-6 h-6" />
            Import Custom Rankings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 tab-nav">
            <TabsTrigger value="upload" className="tab-item data-[state=active]:active">
              <FileText className="w-4 h-4 mr-2" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="paste" className="tab-item data-[state=active]:active">
              <FileText className="w-4 h-4 mr-2" />
              Paste Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
              <div>
                <h4 className="font-bold">Upload CSV File</h4>
                <p className="text-sm text-muted-foreground">
                  Supported formats: CSV with Name, Position, Rank columns
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
            </div>

            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV files only</p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div>
              <Label>Paste your rankings (CSV format)</Label>
              <Textarea
                placeholder="Name,Position,Rank,Value,Tier,Notes
Patrick Mahomes,QB,1,65,1,Elite
Travis Kelce,TE,2,55,1,..."
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                className="h-40 mt-2 font-mono text-sm"
              />
            </div>
            <Button onClick={handleManualParse} className="w-full">
              Parse Rankings
            </Button>
          </TabsContent>
        </Tabs>

        {/* Preview Section */}
        {parsedData.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold">
                Preview ({parsedData.length} players)
              </h4>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-green-400 border-green-400/50">
                  <Check className="w-3 h-3 mr-1" />
                  {matchedCount} matched
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {unmatchedCount} unmatched
                  </Badge>
                )}
              </div>
            </div>

            {parseErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
                  <AlertCircle className="w-4 h-4" />
                  Some players couldn't be matched
                </div>
                <ul className="text-xs text-yellow-400/80 space-y-1">
                  {parseErrors.slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {parseErrors.length > 5 && (
                    <li>...and {parseErrors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <ScrollArea className="h-[200px] rounded-xl border border-border">
              <div className="divide-y divide-border">
                {parsedData.map((row, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 ${
                      row.matched ? '' : 'bg-yellow-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center font-bold text-sm">
                        {row.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {row.matched ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-400" />
                          )}
                          <span className="font-medium">
                            {row.matched?.name || row.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {row.position || row.matched?.position}
                          </Badge>
                        </div>
                        {row.value && (
                          <span className="text-xs text-muted-foreground">
                            Value: ${row.value}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.tier && (
                        <Badge variant="outline">Tier {row.tier}</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                className="flex-1 btn-premium"
                disabled={matchedCount === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                Import {matchedCount} Players
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setParsedData([]);
                  setManualEntry('');
                  setParseErrors([]);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Existing Rankings */}
        {existingRankings.length > 0 && parsedData.length === 0 && (
          <div className="mt-6">
            <h4 className="font-bold mb-3">Current Custom Rankings</h4>
            <ScrollArea className="h-[150px] rounded-xl border border-border">
              <div className="divide-y divide-border">
                {existingRankings.slice(0, 10).map((ranking, index) => (
                  <div key={index} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-sm">
                        {ranking.customRank}
                      </div>
                      <span className="font-medium">{ranking.playerName}</span>
                      <Badge variant="outline">{ranking.position}</Badge>
                    </div>
                    {ranking.customValue && (
                      <span className="text-sm text-muted-foreground">
                        ${ranking.customValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomRankingsImport;
