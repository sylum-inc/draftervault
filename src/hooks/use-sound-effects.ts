import { useCallback, useRef, useEffect, useState } from 'react';

type SoundType =
  | 'draft'        // Player drafted
  | 'bid'          // New bid placed
  | 'win'          // Won auction
  | 'success'      // General success
  | 'error'        // Error occurred
  | 'notification' // Alert/notification
  | 'click'        // Button click
  | 'hover'        // Hover effect
  | 'countdown'    // Timer tick
  | 'complete';    // Draft complete

interface SoundConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  attack?: number;
  decay?: number;
}

const soundConfigs: Record<SoundType, SoundConfig | SoundConfig[]> = {
  draft: [
    { frequency: 523.25, duration: 0.1, type: 'sine', volume: 0.3 },
    { frequency: 659.25, duration: 0.1, type: 'sine', volume: 0.3 },
    { frequency: 783.99, duration: 0.2, type: 'sine', volume: 0.3 },
  ],
  bid: { frequency: 440, duration: 0.08, type: 'sine', volume: 0.2 },
  win: [
    { frequency: 523.25, duration: 0.15, type: 'sine', volume: 0.4 },
    { frequency: 659.25, duration: 0.15, type: 'sine', volume: 0.4 },
    { frequency: 783.99, duration: 0.15, type: 'sine', volume: 0.4 },
    { frequency: 1046.50, duration: 0.3, type: 'sine', volume: 0.4 },
  ],
  success: [
    { frequency: 440, duration: 0.1, type: 'sine', volume: 0.25 },
    { frequency: 554.37, duration: 0.15, type: 'sine', volume: 0.25 },
  ],
  error: [
    { frequency: 200, duration: 0.15, type: 'sawtooth', volume: 0.2 },
    { frequency: 180, duration: 0.2, type: 'sawtooth', volume: 0.2 },
  ],
  notification: { frequency: 880, duration: 0.1, type: 'sine', volume: 0.15 },
  click: { frequency: 1000, duration: 0.03, type: 'sine', volume: 0.1 },
  hover: { frequency: 1200, duration: 0.02, type: 'sine', volume: 0.05 },
  countdown: { frequency: 600, duration: 0.08, type: 'sine', volume: 0.15 },
  complete: [
    { frequency: 523.25, duration: 0.2, type: 'sine', volume: 0.3 },
    { frequency: 659.25, duration: 0.2, type: 'sine', volume: 0.3 },
    { frequency: 783.99, duration: 0.2, type: 'sine', volume: 0.3 },
    { frequency: 1046.50, duration: 0.2, type: 'sine', volume: 0.3 },
    { frequency: 1318.51, duration: 0.4, type: 'sine', volume: 0.3 },
  ],
};

interface UseSoundEffectsOptions {
  enabled?: boolean;
  volume?: number;
}

export function useSoundEffects(options: UseSoundEffectsOptions = {}) {
  const { enabled = true, volume = 1.0 } = options;
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('draft-vault-muted') === 'true';
    }
    return false;
  });

  const isSupported = typeof window !== 'undefined' &&
    (typeof AudioContext !== 'undefined' || typeof (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== 'undefined');

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      localStorage.setItem('draft-vault-muted', String(newValue));
      return newValue;
    });
  }, []);

  useEffect(() => {
    enabledRef.current = enabled && !isMuted;
    volumeRef.current = volume;
  }, [enabled, volume, isMuted]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((config: SoundConfig, delay: number = 0) => {
    if (!enabledRef.current) return;

    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime + delay);

    const adjustedVolume = config.volume * volumeRef.current;
    const startTime = audioContext.currentTime + delay;
    const endTime = startTime + config.duration;

    // Attack
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(adjustedVolume, startTime + (config.attack || 0.01));

    // Decay
    gainNode.gain.linearRampToValueAtTime(0, endTime);

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.1);
  }, [getAudioContext]);

  const playSound = useCallback((type: SoundType) => {
    if (!enabledRef.current) return;

    const config = soundConfigs[type];

    if (Array.isArray(config)) {
      let delay = 0;
      config.forEach((c) => {
        playTone(c, delay);
        delay += c.duration;
      });
    } else {
      playTone(config);
    }
  }, [playTone]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    playSound,
    isMuted,
    toggleMute,
    isSupported,
    playDraft: useCallback(() => playSound('draft'), [playSound]),
    playBid: useCallback(() => playSound('bid'), [playSound]),
    playWin: useCallback(() => playSound('win'), [playSound]),
    playSuccess: useCallback(() => playSound('success'), [playSound]),
    playError: useCallback(() => playSound('error'), [playSound]),
    playNotification: useCallback(() => playSound('notification'), [playSound]),
    playClick: useCallback(() => playSound('click'), [playSound]),
    playHover: useCallback(() => playSound('hover'), [playSound]),
    playCountdown: useCallback(() => playSound('countdown'), [playSound]),
    playComplete: useCallback(() => playSound('complete'), [playSound]),
  };
}

export default useSoundEffects;
