import { useState, useEffect, useCallback, useRef } from 'react';
import { Player, Team } from '@/services/auctionDraftService';

interface DraftState {
  picks: DraftPick[];
  teams: Team[];
  currentPick: number;
  activeBidder: string | null;
  currentBid: number | null;
  playerOnBlock: Player | null;
  timestamp: number;
}

interface DraftPick {
  playerId: string;
  playerName: string;
  teamId: string;
  cost: number;
  pickNumber: number;
  timestamp: number;
}

interface SyncMessage {
  type: 'state_update' | 'bid' | 'pick' | 'undo' | 'pause' | 'resume' | 'ping' | 'pong';
  payload: unknown;
  senderId: string;
  timestamp: number;
}

interface SyncOptions {
  roomId: string;
  userId: string;
  userName: string;
  isHost: boolean;
  onStateUpdate?: (state: DraftState) => void;
  onBid?: (bid: { userId: string; amount: number }) => void;
  onPick?: (pick: DraftPick) => void;
  onUserJoined?: (user: { id: string; name: string }) => void;
  onUserLeft?: (userId: string) => void;
  onError?: (error: Error) => void;
}

interface ConnectedUser {
  id: string;
  name: string;
  isHost: boolean;
  lastSeen: number;
}

export const useDraftSync = (options: SyncOptions) => {
  const {
    roomId,
    userId,
    userName,
    isHost,
    onStateUpdate,
    onBid,
    onPick,
    onUserJoined,
    onUserLeft,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Generate WebSocket URL (placeholder - would be configured for actual server)
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.REACT_APP_WS_HOST || window.location.host;
    return `${protocol}//${host}/ws/draft/${roomId}`;
  }, [roomId]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);

    try {
      const ws = new WebSocket(getWebSocketUrl());

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;

        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          payload: { userId, userName, isHost },
          senderId: userId,
          timestamp: Date.now(),
        }));

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingTime = Date.now();
            ws.send(JSON.stringify({
              type: 'ping',
              payload: { time: pingTime },
              senderId: userId,
              timestamp: pingTime,
            }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: SyncMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch {
          console.error('[Sync] Failed to parse message');
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        cleanup();

        // Attempt reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          onError?.(new Error('Failed to connect after multiple attempts'));
        }
      };

      ws.onerror = () => {
        onError?.(new Error('WebSocket connection error'));
      };

      wsRef.current = ws;
    } catch {
      setIsConnecting(false);
      onError?.(new Error('Failed to create WebSocket connection'));
    }
  }, [getWebSocketUrl, userId, userName, isHost, onError]);

  // Handle incoming messages
  const handleMessage = useCallback((message: SyncMessage) => {
    const { type, payload, senderId, timestamp } = message;

    switch (type) {
      case 'state_update':
        onStateUpdate?.(payload as DraftState);
        setLastSync(new Date(timestamp));
        break;

      case 'bid':
        if (senderId !== userId) {
          onBid?.(payload as { userId: string; amount: number });
        }
        break;

      case 'pick':
        if (senderId !== userId) {
          onPick?.(payload as DraftPick);
        }
        break;

      case 'user_joined':
        const joinedUser = payload as { id: string; name: string };
        setConnectedUsers(prev => {
          if (prev.find(u => u.id === joinedUser.id)) return prev;
          return [...prev, { ...joinedUser, isHost: false, lastSeen: Date.now() }];
        });
        onUserJoined?.(joinedUser);
        break;

      case 'user_left':
        const leftUserId = payload as string;
        setConnectedUsers(prev => prev.filter(u => u.id !== leftUserId));
        onUserLeft?.(leftUserId);
        break;

      case 'users_list':
        setConnectedUsers(payload as ConnectedUser[]);
        break;

      case 'pong':
        const pingTime = (payload as { time: number }).time;
        setLatency(Date.now() - pingTime);
        break;
    }
  }, [userId, onStateUpdate, onBid, onPick, onUserJoined, onUserLeft]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectedUsers([]);
  }, [cleanup]);

  // Send message
  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[Sync] Cannot send message - not connected');
      return false;
    }

    const message: SyncMessage = {
      type: type as SyncMessage['type'],
      payload,
      senderId: userId,
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(message));
    return true;
  }, [userId]);

  // Broadcast state update (host only)
  const broadcastState = useCallback((state: DraftState) => {
    if (!isHost) {
      console.warn('[Sync] Only host can broadcast state');
      return;
    }
    sendMessage('state_update', state);
  }, [isHost, sendMessage]);

  // Send bid
  const sendBid = useCallback((amount: number) => {
    sendMessage('bid', { userId, amount });
  }, [userId, sendMessage]);

  // Send pick
  const sendPick = useCallback((pick: DraftPick) => {
    sendMessage('pick', pick);
  }, [sendMessage]);

  // Request current state from host
  const requestState = useCallback(() => {
    sendMessage('request_state', {});
  }, [sendMessage]);

  // Effect: Auto-connect on mount
  useEffect(() => {
    // Don't auto-connect - let user initiate
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    isConnected,
    isConnecting,
    connectedUsers,
    latency,
    lastSync,

    // Actions
    connect,
    disconnect,
    broadcastState,
    sendBid,
    sendPick,
    requestState,
  };
};

// Room code generator
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Validate room code format
export const isValidRoomCode = (code: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
};

export default useDraftSync;
