import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { tokenizePassage } from '@/lib/passage-text';
import type {
  Passage,
  PracticeError,
  PracticeSession,
  PracticeStatus,
  ResultWord,
  SessionResult,
} from '@/types/session';

/**
 * Deterministic fake session: "reads" the passage at targetWpm ± jitter so the
 * UI can be built and visually verified without the native speech stack (works
 * in Expo Go). Swapped for the real engine in hooks/use-practice-session.ts.
 */

const TICK_MS = 100;

function buildMockResult(passage: Passage, durationMs: number): SessionResult {
  const { words } = tokenizePassage(passage.text);
  const resultWords: ResultWord[] = words.map((word, i) => {
    if (i > 0 && i % 29 === 0) return { word, status: 'omitted' };
    if (i > 0 && i % 13 === 0) return { word, status: 'mispronounced', score: 48 + (i % 20) };
    return { word, status: 'good', score: 90 + (i % 10) };
  });

  // Seeded pseudo-random waveform buckets (stable across renders).
  const waveform = Array.from({ length: 30 }, (_, i) => {
    const v = Math.abs(Math.sin(i * 2.7 + 1.3) * Math.sin(i * 0.9));
    return 0.2 + v * 0.8;
  });

  return {
    overallScore: 88,
    accuracy: 92,
    fluency: 85,
    completeness: 98,
    intonation: 80,
    paceWpm: 189,
    targetWpm: passage.targetWpm,
    fillerCount: 3,
    words: resultWords,
    audioUri: null,
    durationMs,
    waveform,
    // The mock stands in for a successful Azure-scored session; 'live'
    // de-emphasis styling is reserved for the real fallback path.
    source: 'azure',
  };
}

export function usePracticeSession(passage: Passage): PracticeSession {
  const tokenized = useMemo(() => tokenizePassage(passage.text), [passage.text]);

  const [status, setStatus] = useState<PracticeStatus>('idle');
  const [error] = useState<PracticeError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const meterLevel = useSharedValue(0);
  const currentWordFraction = useSharedValue(0);

  const stateRef = useRef({
    status: 'idle' as PracticeStatus,
    elapsedMs: 0,
    wordIndex: 0,
    fraction: 0,
    charsSpoken: 0,
  });
  stateRef.current.status = status;

  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (s.status !== 'listening') {
        meterLevel.value = Math.max(0.03, meterLevel.value * 0.8);
        return;
      }

      s.elapsedMs += TICK_MS;
      const t = s.elapsedMs / 1000;

      // Chars/sec for targetWpm assuming ~5 chars per word, with slow jitter.
      const jitter = 1 + 0.18 * Math.sin(t * 0.7);
      const charsPerSecond = ((passage.targetWpm * 5) / 60) * jitter;
      s.charsSpoken += (charsPerSecond * TICK_MS) / 1000;

      // Advance the frontier through the display words.
      let advanced = false;
      let remaining = s.charsSpoken;
      let idx = 0;
      while (idx < tokenized.words.length && remaining > tokenized.words[idx].length + 1) {
        remaining -= tokenized.words[idx].length + 1;
        idx++;
      }
      if (idx !== s.wordIndex) {
        s.wordIndex = idx;
        advanced = true;
      }
      const wordLen = tokenized.words[idx]?.length ?? 1;
      s.fraction = Math.min(1, remaining / (wordLen + 1));

      meterLevel.value = 0.15 + 0.6 * Math.abs(Math.sin(t * 7) * Math.sin(t * 1.3));

      setElapsedMs(s.elapsedMs);
      currentWordFraction.value = withTiming(s.fraction, {
        duration: TICK_MS,
        easing: Easing.linear,
      });
      if (advanced) setCurrentWordIndex(s.wordIndex);
      if (s.elapsedMs % 1000 < TICK_MS) {
        const minutes = s.elapsedMs / 60000;
        const wpm = minutes > 0.08 ? Math.round((s.wordIndex / minutes) * (1 + 0.04 * Math.sin(t))) : 0;
        setLiveWpm(wpm);
        // A filler "slips out" occasionally.
        if (s.elapsedMs > 8000 && Math.floor(t) % 11 === 0) {
          setFillerCount((c) => Math.min(c + 1, 3));
        }
      }
      if (s.wordIndex >= tokenized.words.length) {
        setStatus('done');
      }
    }, TICK_MS);
    return () => clearInterval(interval);
    // meterLevel is a stable shared value; tokenized/passage identity gate the sim.
  }, [tokenized, passage.targetWpm, meterLevel, currentWordFraction]);

  const api = useMemo(() => {
    const reset = () => {
      const s = stateRef.current;
      s.elapsedMs = 0;
      s.wordIndex = 0;
      s.fraction = 0;
      s.charsSpoken = 0;
      setElapsedMs(0);
      setLiveWpm(0);
      setFillerCount(0);
      setCurrentWordIndex(0);
      cancelAnimation(currentWordFraction);
      currentWordFraction.value = 0;
      setResult(null);
    };

    return {
      async start() {
        reset();
        setStatus('listening');
      },
      pause() {
        setStatus('paused');
      },
      resume() {
        setStatus('listening');
      },
      restart() {
        reset();
        setStatus('listening');
      },
      cancel() {
        setStatus('idle');
      },
      async stop(): Promise<SessionResult> {
        setStatus('processing');
        const durationMs = stateRef.current.elapsedMs;
        await new Promise((r) => setTimeout(r, 1200));
        const mockResult = buildMockResult(passage, durationMs);
        setResult(mockResult);
        setStatus('done');
        return mockResult;
      },
    };
  }, [passage, currentWordFraction]);

  return {
    status,
    error,
    elapsedMs,
    liveWpm,
    fillerCount,
    words: tokenized.words,
    currentWordIndex,
    currentWordFraction,
    meterLevel,
    result,
    ...api,
  };
}
