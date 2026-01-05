import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftHistory } from '@/hooks/use-draft-history';

interface TestState {
  value: number;
  name: string;
}

describe('useDraftHistory', () => {
  const initialState: TestState = { value: 0, name: 'initial' };

  it('initializes with the provided initial state', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    expect(result.current.state).toEqual(initialState);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushes new state to history', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
    });

    expect(result.current.state).toEqual({ value: 1, name: 'first' });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undoes to previous state', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
      result.current.pushState({ value: 2, name: 'second' });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1, name: 'first' });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes to next state', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
      result.current.pushState({ value: 2, name: 'second' });
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ value: 2, name: 'second' });
    expect(result.current.canRedo).toBe(false);
  });

  it('clears redo stack when new state is pushed', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
      result.current.pushState({ value: 2, name: 'second' });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.pushState({ value: 3, name: 'third' });
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toEqual({ value: 3, name: 'third' });
  });

  it('resets to initial state', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
      result.current.pushState({ value: 2, name: 'second' });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual(initialState);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('resets to a new state when provided', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
    });

    const newState = { value: 100, name: 'reset' };
    act(() => {
      result.current.reset(newState);
    });

    expect(result.current.state).toEqual(newState);
  });

  it('respects maximum history size', () => {
    const { result } = renderHook(() =>
      useDraftHistory<TestState>({ initialState, maxHistory: 2 })
    );

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
      result.current.pushState({ value: 2, name: 'second' });
      result.current.pushState({ value: 3, name: 'third' });
    });

    // History should only keep maxHistory items in past
    expect(result.current.history.past.length).toBeLessThanOrEqual(2);
  });

  it('tracks history length correctly', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    expect(result.current.history.totalStates).toBe(1);

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
    });

    expect(result.current.history.totalStates).toBe(2);

    act(() => {
      result.current.pushState({ value: 2, name: 'second' });
    });

    expect(result.current.history.totalStates).toBe(3);
  });

  it('navigates to specific state with goToState', () => {
    const { result } = renderHook(() => useDraftHistory<TestState>({ initialState }));

    act(() => {
      result.current.pushState({ value: 1, name: 'first' });
      result.current.pushState({ value: 2, name: 'second' });
      result.current.pushState({ value: 3, name: 'third' });
    });

    act(() => {
      result.current.goToState(1);
    });

    expect(result.current.state).toEqual({ value: 1, name: 'first' });
    expect(result.current.history.currentIndex).toBe(1);
  });
});
