import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSoundEffects } from '@/hooks/use-sound-effects';

// Mock AudioContext more completely
const mockOscillator = {
  connect: vi.fn(),
  type: 'sine',
  frequency: {
    setValueAtTime: vi.fn(),
  },
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGainNode = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
};

const mockAudioContext = {
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGainNode),
  destination: {},
  currentTime: 0,
  close: vi.fn(),
};

describe('useSoundEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the global AudioContext
    global.AudioContext = vi.fn(() => mockAudioContext) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns sound playing functions', () => {
    const { result } = renderHook(() => useSoundEffects());

    expect(result.current.playSound).toBeDefined();
    expect(result.current.playDraft).toBeDefined();
    expect(result.current.playBid).toBeDefined();
    expect(result.current.playWin).toBeDefined();
    expect(result.current.playSuccess).toBeDefined();
    expect(result.current.playError).toBeDefined();
    expect(result.current.playNotification).toBeDefined();
    expect(result.current.playClick).toBeDefined();
    expect(result.current.playHover).toBeDefined();
    expect(result.current.playCountdown).toBeDefined();
    expect(result.current.playComplete).toBeDefined();
  });

  it('creates AudioContext when playing sounds', () => {
    const { result } = renderHook(() => useSoundEffects());

    act(() => {
      result.current.playSound('click');
    });

    expect(global.AudioContext).toHaveBeenCalled();
  });

  it('plays sound when enabled (default)', () => {
    const { result } = renderHook(() => useSoundEffects());

    act(() => {
      result.current.playClick();
    });

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('does not play sound when disabled', () => {
    const { result } = renderHook(() => useSoundEffects({ enabled: false }));

    act(() => {
      result.current.playClick();
    });

    // Should not create audio elements when disabled
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  it('respects volume option', () => {
    const { result } = renderHook(() => useSoundEffects({ volume: 0.5 }));

    act(() => {
      result.current.playClick();
    });

    expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('helper functions call playSound with correct type', () => {
    const { result } = renderHook(() => useSoundEffects());

    const soundTypes = [
      { fn: 'playDraft', type: 'draft' },
      { fn: 'playBid', type: 'bid' },
      { fn: 'playWin', type: 'win' },
      { fn: 'playSuccess', type: 'success' },
      { fn: 'playError', type: 'error' },
      { fn: 'playNotification', type: 'notification' },
      { fn: 'playClick', type: 'click' },
    ] as const;

    soundTypes.forEach(({ fn }) => {
      vi.clearAllMocks();
      act(() => {
        (result.current[fn] as () => void)();
      });
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
  });

  it('does not throw when calling sound functions', () => {
    const { result } = renderHook(() => useSoundEffects());

    expect(() => {
      act(() => {
        result.current.playClick();
        result.current.playSuccess();
        result.current.playError();
        result.current.playNotification();
      });
    }).not.toThrow();
  });
});
