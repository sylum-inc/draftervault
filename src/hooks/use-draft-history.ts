import { useState, useCallback, useRef } from 'react';

export interface DraftAction {
  id: string;
  type: 'DRAFT_PLAYER' | 'UNDO_DRAFT' | 'UPDATE_BID' | 'TRADE' | 'SETTINGS_CHANGE';
  timestamp: number;
  data: Record<string, unknown>;
  description: string;
}

interface DraftHistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseDraftHistoryOptions<T> {
  initialState: T;
  maxHistory?: number;
}

export function useDraftHistory<T>({ initialState, maxHistory = 50 }: UseDraftHistoryOptions<T>) {
  const [state, setState] = useState<DraftHistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const actionsRef = useRef<DraftAction[]>([]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const logAction = useCallback((action: Omit<DraftAction, 'id' | 'timestamp'>) => {
    const fullAction: DraftAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    actionsRef.current = [...actionsRef.current, fullAction].slice(-maxHistory);
    return fullAction;
  }, [maxHistory]);

  const pushState = useCallback((newState: T, action?: Omit<DraftAction, 'id' | 'timestamp'>) => {
    if (action) {
      logAction(action);
    }

    setState((prev) => ({
      past: [...prev.past, prev.present].slice(-maxHistory),
      present: newState,
      future: [],
    }));
  }, [logAction, maxHistory]);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      const previousState = newPast.pop()!;

      logAction({
        type: 'UNDO_DRAFT',
        data: { undoneState: prev.present },
        description: 'Undo last action',
      });

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future].slice(0, maxHistory),
      };
    });
  }, [logAction, maxHistory]);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;

      const newFuture = [...prev.future];
      const nextState = newFuture.shift()!;

      return {
        past: [...prev.past, prev.present].slice(-maxHistory),
        present: nextState,
        future: newFuture,
      };
    });
  }, [maxHistory]);

  const reset = useCallback((newState?: T) => {
    setState({
      past: [],
      present: newState ?? initialState,
      future: [],
    });
    actionsRef.current = [];
  }, [initialState]);

  const goToState = useCallback((index: number) => {
    setState((prev) => {
      const allStates = [...prev.past, prev.present, ...prev.future];
      if (index < 0 || index >= allStates.length) return prev;

      return {
        past: allStates.slice(0, index),
        present: allStates[index],
        future: allStates.slice(index + 1),
      };
    });
  }, []);

  return {
    state: state.present,
    history: {
      past: state.past,
      future: state.future,
      actions: actionsRef.current,
      currentIndex: state.past.length,
      totalStates: state.past.length + 1 + state.future.length,
    },
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    reset,
    goToState,
  };
}

// Draft Timeline Component Data
export interface TimelineEvent {
  id: string;
  type: DraftAction['type'];
  playerName?: string;
  teamName?: string;
  price?: number;
  timestamp: number;
  description: string;
}

export function formatTimelineEvent(action: DraftAction): TimelineEvent {
  return {
    id: action.id,
    type: action.type,
    playerName: action.data.playerName as string | undefined,
    teamName: action.data.teamName as string | undefined,
    price: action.data.price as number | undefined,
    timestamp: action.timestamp,
    description: action.description,
  };
}

export default useDraftHistory;
