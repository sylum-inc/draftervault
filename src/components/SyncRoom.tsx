import { useState } from 'react';
import { Wifi, WifiOff, Users, Copy, Check, RefreshCw, LogOut, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDraftSync, generateRoomCode, isValidRoomCode } from '@/hooks/use-draft-sync';

interface SyncRoomProps {
  userId: string;
  userName: string;
  onStateUpdate?: (state: unknown) => void;
}

export const SyncRoom = ({ userId, userName, onStateUpdate }: SyncRoomProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    isConnected,
    isConnecting,
    connectedUsers,
    latency,
    lastSync,
    connect,
    disconnect,
  } = useDraftSync({
    roomId: roomCode,
    userId,
    userName,
    isHost,
    onStateUpdate: (state) => {
      onStateUpdate?.(state);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);
    setError(null);
    connect();
  };

  const handleJoinRoom = () => {
    if (!isValidRoomCode(joinCode)) {
      setError('Invalid room code format');
      return;
    }
    setRoomCode(joinCode.toUpperCase());
    setIsHost(false);
    setError(null);
    connect();
  };

  const handleLeaveRoom = () => {
    disconnect();
    setRoomCode('');
    setJoinCode('');
    setIsHost(false);
  };

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="hidden sm:inline">Synced</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="hidden sm:inline">Sync</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="modal-content max-w-md">
        <DialogHeader>
          <DialogTitle className="gradient-text text-2xl flex items-center gap-2">
            <Users className="w-6 h-6" />
            Draft Room Sync
          </DialogTitle>
        </DialogHeader>

        {!isConnected ? (
          <Tabs defaultValue="create" className="mt-4">
            <TabsList className="grid w-full grid-cols-2 tab-nav">
              <TabsTrigger value="create" className="tab-item data-[state=active]:active">
                Create Room
              </TabsTrigger>
              <TabsTrigger value="join" className="tab-item data-[state=active]:active">
                Join Room
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Create a room and share the code with your league mates to sync the draft in real-time.
              </p>

              <Button
                className="w-full btn-premium"
                onClick={handleCreateRoom}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Create Draft Room
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Enter the room code shared by your commissioner to join the draft.
              </p>

              <div>
                <Label>Room Code</Label>
                <Input
                  placeholder="ABCD12"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="mt-1 text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button
                className="w-full btn-premium"
                onClick={handleJoinRoom}
                disabled={isConnecting || joinCode.length !== 6}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Room'
                )}
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Room Info */}
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Room Code</p>
                    <p className="text-2xl font-mono font-bold tracking-widest">{roomCode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHost && (
                      <Badge className="bg-primary/20 text-primary">
                        <Crown className="w-3 h-3 mr-1" />
                        Host
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={copyRoomCode}>
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-green-400">Connected</span>
              </div>
              {latency && (
                <span className="text-xs text-muted-foreground">
                  {latency}ms latency
                </span>
              )}
            </div>

            {/* Connected Users */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Connected Users</h4>
                <Badge variant="outline">{connectedUsers.length}</Badge>
              </div>
              <ScrollArea className="h-[150px] rounded-xl border border-border">
                <div className="divide-y divide-border">
                  {connectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{user.name}</span>
                        {user.id === userId && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      {user.isHost && (
                        <Crown className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  ))}
                  {connectedUsers.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Waiting for others to join...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Last Sync */}
            {lastSync && (
              <p className="text-xs text-muted-foreground text-center">
                Last synced: {lastSync.toLocaleTimeString()}
              </p>
            )}

            {/* Leave Room */}
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleLeaveRoom}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Room
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SyncRoom;
