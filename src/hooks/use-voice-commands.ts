import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceCommand {
  phrases: string[];
  action: (transcript: string) => void;
  description: string;
}

interface UseVoiceCommandsOptions {
  commands: VoiceCommand[];
  enabled?: boolean;
  language?: string;
  continuous?: boolean;
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoiceCommands({
  commands,
  enabled = true,
  language = 'en-US',
  continuous = true,
  onTranscript,
  onError,
}: UseVoiceCommandsOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const commandsRef = useRef(commands);

  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = language;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results;
        const latestResult = results[results.length - 1];

        if (latestResult.isFinal) {
          const finalTranscript = latestResult[0].transcript.toLowerCase().trim();
          setTranscript(finalTranscript);
          onTranscript?.(finalTranscript);

          // Check for matching commands
          for (const command of commandsRef.current) {
            const matched = command.phrases.some((phrase) =>
              finalTranscript.includes(phrase.toLowerCase())
            );

            if (matched) {
              setLastCommand(command.description);
              command.action(finalTranscript);
              break;
            }
          }
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'no-speech') {
          onError?.(event.error);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening && continuous) {
          // Restart if continuous mode
          try {
            recognitionRef.current?.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, continuous, onTranscript, onError, isListening]);

  const startListening = useCallback(() => {
    if (!isSupported || !enabled || !recognitionRef.current) return;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      // Already started or error
    }
  }, [isSupported, enabled]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    transcript,
    lastCommand,
    startListening,
    stopListening,
    toggleListening,
  };
}

// Text-to-speech helper
export function speak(text: string, options?: SpeechSynthesisUtterance) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    if (options) {
      Object.assign(utterance, options);
    }
    utterance.rate = 1.1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
}

// Common voice commands for draft
export const draftVoiceCommands = {
  draft: (playerName: string) => ({
    phrases: [`draft ${playerName}`, `select ${playerName}`, `pick ${playerName}`],
    description: `Draft ${playerName}`,
  }),
  bid: (amount: number) => ({
    phrases: [`bid ${amount}`, `${amount} dollars`, `raise to ${amount}`],
    description: `Bid $${amount}`,
  }),
  search: (query: string) => ({
    phrases: [`search ${query}`, `find ${query}`, `look for ${query}`],
    description: `Search for ${query}`,
  }),
  pass: {
    phrases: ['pass', 'skip', 'next player'],
    description: 'Pass on current player',
  },
  undo: {
    phrases: ['undo', 'take back', 'reverse'],
    description: 'Undo last action',
  },
  showPlayer: (name: string) => ({
    phrases: [`show ${name}`, `details ${name}`, `info ${name}`],
    description: `Show ${name} details`,
  }),
};

export default useVoiceCommands;
