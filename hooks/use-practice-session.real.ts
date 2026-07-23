import { useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { File, Paths } from 'expo-file-system';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { tokenizePassage } from '@/lib/passage-text';
import { PassageAligner } from '@/services/alignment';
import { assessSession } from '@/services/azure-pronunciation';
import { buildAzureResult, buildChunks, buildLiveFallbackResult } from '@/services/scoring';
import { concatWavs, downsampleWaveform, sliceWav, wavDurationMs } from '@/services/wav';
import type {
  Passage,
  PracticeError,
  PracticeErrorCode,
  PracticeSession,
  PracticeStatus,
  SessionResult,
} from '@/types/session';

/**
 * The real practice-session engine: expo-speech-recognition for the live
 * layer (frontier, WPM, fillers, mic level, persisted 16kHz WAV segments),
 * Azure Pronunciation Assessment at stop() for the scoring layer, and a
 * live-derived fallback so the session NEVER dead-ends without a result.
 *
 * Lifecycle notes (see plan):
 * - There is no native pause API: pause = stop the recognizer (finishing the
 *   current recording segment), resume = a fresh recognizer session writing a
 *   new segment. The aligner persists across segments.
 * - On-device recognition is tried first; if starting fails (simulators often
 *   lack on-device model assets) the engine retries once network-based.
 * - Unexpected session ends (iOS silence timeouts, transient errors) while
 *   listening auto-restart into a new segment, capped to avoid loops.
 */

const TICK_MS = 100;
const ELAPSED_EVERY_TICKS = 2; // ~200ms, contract says ~250ms
const WPM_EVERY_TICKS = 10; // 1Hz
const MAX_CONSECUTIVE_AUTO_RESTARTS = 5;
const AUDIO_END_TIMEOUT_MS = 3_000;
const METER_HISTORY_CAP = 4_096;

type RecognitionMode = 'on-device' | 'network';

type Machine = {
  status: PracticeStatus;
  aligner: PassageAligner;
  sessionId: string;
  mode: RecognitionMode;
  retriedNetwork: boolean;
  /** We initiated the current stop/abort — don't treat its `end` as unexpected. */
  expectEnd: boolean;
  stopping: boolean;
  /** Recognition sessions started/ended — auto-restart only when they balance. */
  startedCount: number;
  endedCount: number;
  /** Current recording segment index (one per recognizer session). */
  recSession: number;
  segmentUris: (string | null)[];
  segmentActiveStartMs: number[];
  /** Segment indices whose audiostart fired but audioend hasn't. */
  audioPending: number[];
  accumulatedActiveMs: number;
  listeningSinceWall: number | null;
  frontierIndex: number;
  frontierChangedWall: number;
  autoRestarts: number;
  lastTransientError: { code: string; message: string } | null;
  meterEma: number;
  meterHistory: number[];
  result: SessionResult | null;
};

/** Only one engine may drive the native recognizer at a time. */
let engineOwner: symbol | null = null;

function makeSessionId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(16)}`;
}

export function usePracticeSession(passage: Passage): PracticeSession {
  const tokenized = useMemo(() => tokenizePassage(passage.text), [passage.text]);

  const [status, setStatus] = useState<PracticeStatus>('idle');
  const [error, setError] = useState<PracticeError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentWordFraction, setCurrentWordFraction] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const meterLevel = useSharedValue(0);

  const instanceId = useRef(Symbol('practice-session')).current;
  const mounted = useRef(true);

  const machineRef = useRef<Machine | null>(null);
  if (machineRef.current === null) {
    machineRef.current = {
      status: 'idle',
      aligner: new PassageAligner(tokenized),
      sessionId: makeSessionId(),
      mode: 'on-device',
      retriedNetwork: false,
      expectEnd: false,
      stopping: false,
      startedCount: 0,
      endedCount: 0,
      recSession: -1,
      segmentUris: [],
      segmentActiveStartMs: [],
      audioPending: [],
      accumulatedActiveMs: 0,
      listeningSinceWall: null,
      frontierIndex: 0,
      frontierChangedWall: Date.now(),
      autoRestarts: 0,
      lastTransientError: null,
      meterEma: 0,
      meterHistory: [],
      result: null,
    };
  }
  const activeMs = () => {
    const m = machineRef.current!;
    return (
      m.accumulatedActiveMs + (m.listeningSinceWall != null ? Date.now() - m.listeningSinceWall : 0)
    );
  };

  const setStatusSafe = (next: PracticeStatus) => {
    machineRef.current!.status = next;
    if (mounted.current) setStatus(next);
  };

  const fail = (code: PracticeErrorCode, message: string) => {
    const m = machineRef.current!;
    if (m.status === 'done') return;
    m.expectEnd = true;
    m.listeningSinceWall = null;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // recognizer may already be inactive
    }
    if (mounted.current) setError({ code, message });
    setStatusSafe('error');
  };

  const startRecognition = (mode: RecognitionMode) => {
    const m = machineRef.current!;
    m.recSession += 1;
    m.segmentUris[m.recSession] = null;
    m.segmentActiveStartMs[m.recSession] = activeMs();
    m.aligner.beginSegment(m.recSession);
    m.expectEnd = false;
    m.startedCount += 1;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: mode === 'on-device',
      addsPunctuation: false,
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      recordingOptions: {
        persist: true,
        outputDirectory: Paths.cache.uri,
        outputFileName: `practice-${m.sessionId}-seg${m.recSession}.wav`,
        outputSampleRate: 16000,
        outputEncoding: 'pcmFormatInt16',
      },
    });
  };

  const deleteSegmentFiles = (m: Machine) => {
    for (const uri of m.segmentUris) {
      if (!uri) continue;
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // best effort
      }
    }
    m.segmentUris = [];
  };

  const resetMachine = (m: Machine) => {
    m.aligner.reset();
    m.sessionId = makeSessionId();
    m.retriedNetwork = false;
    m.stopping = false;
    m.recSession = -1;
    m.segmentUris = [];
    m.segmentActiveStartMs = [];
    m.audioPending = [];
    m.accumulatedActiveMs = 0;
    m.listeningSinceWall = null;
    m.frontierIndex = 0;
    m.frontierChangedWall = Date.now();
    m.autoRestarts = 0;
    m.lastTransientError = null;
    m.meterHistory = [];
    m.result = null;
    if (mounted.current) {
      setElapsedMs(0);
      setLiveWpm(0);
      setFillerCount(0);
      setCurrentWordIndex(0);
      setCurrentWordFraction(0);
      setResult(null);
      setError(null);
    }
  };

  // ---- native events ------------------------------------------------------

  useSpeechRecognitionEvent('result', (event) => {
    const m = machineRef.current!;
    if (m.status !== 'listening' && m.status !== 'processing' && m.status !== 'paused') return;
    const first = event.results?.[0];
    if (!first) return;
    m.autoRestarts = 0; // real progress — reset the restart budget
    m.lastTransientError = null;
    m.aligner.handleEvent({
      transcript: first.transcript ?? '',
      isFinal: event.isFinal,
      atActiveMs: activeMs(),
      segments: first.segments,
    });
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    const m = machineRef.current!;
    if (m.status !== 'listening') return;
    const level = Math.max(0, Math.min(1, (event.value + 2) / 12));
    m.meterEma = m.meterEma * 0.6 + level * 0.4;
    meterLevel.value = m.meterEma;
    if (m.meterHistory.length < METER_HISTORY_CAP) m.meterHistory.push(m.meterEma);
  });

  useSpeechRecognitionEvent('audiostart', (event) => {
    const m = machineRef.current!;
    m.segmentUris[m.recSession] = event.uri ?? null;
    m.audioPending.push(m.recSession);
  });

  useSpeechRecognitionEvent('audioend', (event) => {
    const m = machineRef.current!;
    const segment = m.audioPending.shift();
    if (segment != null && event.uri) m.segmentUris[segment] = event.uri;
  });

  useSpeechRecognitionEvent('error', (event) => {
    const m = machineRef.current!;
    if (event.error === 'aborted') return; // always self-inflicted
    if (m.stopping) return; // keep whatever we have; processing continues

    if (event.error === 'not-allowed') {
      fail('permission-denied', event.message || 'Microphone or speech recognition permission was denied.');
      return;
    }

    if (event.error === 'language-not-supported' || event.error === 'service-not-allowed') {
      if (m.mode === 'on-device' && !m.retriedNetwork) {
        // Simulators often lack on-device model assets — retry network-based.
        m.retriedNetwork = true;
        m.mode = 'network';
        return; // the trailing `end` event performs the restart
      }
      fail('recognition-unavailable', event.message || 'Speech recognition is unavailable on this device.');
      return;
    }

    // Everything else (no-speech, speech-timeout, network, audio-capture,
    // interrupted, busy, client, unknown) is transient while listening: the
    // recognizer session will end and the `end` handler restarts it (with a
    // budget so persistent failure surfaces as an error instead of a loop).
    if (m.status === 'listening') {
      m.lastTransientError = { code: event.error, message: event.message };
    }
  });

  useSpeechRecognitionEvent('end', () => {
    const m = machineRef.current!;
    m.endedCount += 1;
    if (m.status !== 'listening' || m.expectEnd) return;
    // Only restart when no session is pending (guards a stale `end` arriving
    // after we already started a fresh session).
    if (m.endedCount < m.startedCount) return;
    // An on-device session that dies with an error before producing anything
    // (e.g. simulators without local assets fail with kLSRErrorDomain 300,
    // surfaced as 'audio-capture') gets one free retry as network-based
    // recognition — the explicit service-not-allowed path never fires there.
    if (m.mode === 'on-device' && !m.retriedNetwork && m.lastTransientError) {
      m.retriedNetwork = true;
      m.mode = 'network';
      m.lastTransientError = null;
      startRecognition(m.mode);
      return;
    }
    m.autoRestarts += 1;
    if (m.autoRestarts > MAX_CONSECUTIVE_AUTO_RESTARTS) {
      const transient = m.lastTransientError;
      fail(
        transient?.code === 'no-speech' || transient?.code === 'speech-timeout'
          ? 'no-speech'
          : 'recognition-unavailable',
        transient?.message || 'Speech recognition kept stopping unexpectedly.',
      );
      return;
    }
    startRecognition(m.mode);
  });

  // ---- tick loop (throttled state flushes, ~10Hz) --------------------------

  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      const m = machineRef.current!;
      tick += 1;
      if (m.status !== 'listening') {
        meterLevel.value = Math.max(0, meterLevel.value * 0.85 - 0.004);
        return;
      }
      const now = Date.now();
      const active = activeMs();

      if (tick % ELAPSED_EVERY_TICKS === 0) setElapsedMs(active);

      const frontier = m.aligner.currentWordIndex;
      if (frontier !== m.frontierIndex) {
        m.frontierIndex = frontier;
        m.frontierChangedWall = now;
        setCurrentWordIndex(frontier);
        setCurrentWordFraction(0);
      } else {
        const wpmNow = m.aligner.getLiveWpm(active);
        const wordsPerMinute = Math.min(300, Math.max(60, wpmNow > 0 ? wpmNow : passage.targetWpm));
        const wordMs = 60_000 / wordsPerMinute;
        setCurrentWordFraction(Math.min(0.95, (now - m.frontierChangedWall) / wordMs));
      }

      if (tick % WPM_EVERY_TICKS === 0) {
        m.aligner.recordWpmSample(active);
        setLiveWpm(m.aligner.getLiveWpm(active));
        setFillerCount(m.aligner.fillerCount);
      }
    }, TICK_MS);
    return () => clearInterval(interval);
    // meterLevel is a stable shared value; targetWpm gates the fraction pace.
  }, [meterLevel, passage.targetWpm]);

  // ---- unmount cleanup ------------------------------------------------------

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const m = machineRef.current!;
      if (engineOwner === instanceId) engineOwner = null;
      if (m.status === 'listening' || m.status === 'paused') {
        m.expectEnd = true;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // already inactive
        }
        deleteSegmentFiles(m);
      }
    };
  }, [instanceId]);

  // ---- processing (stop) ----------------------------------------------------

  const waitForAudioQuiet = async (timeoutMs: number) => {
    const m = machineRef.current!;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (m.audioPending.length === 0 && m.endedCount >= m.startedCount) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  const waveformFromMeterHistory = (history: number[]): number[] => {
    if (history.length === 0) return Array.from({ length: 30 }, () => 0.15);
    const buckets = Array.from({ length: 30 }, (_, b) => {
      const start = Math.floor((b * history.length) / 30);
      const end = Math.max(start + 1, Math.floor(((b + 1) * history.length) / 30));
      let sum = 0;
      for (let i = start; i < end; i++) sum += history[i];
      return sum / (end - start);
    });
    const peak = Math.max(...buckets, 1e-6);
    return buckets.map((v) => Math.min(1, Math.max(0.08, v / peak)));
  };

  const finishProcessing = async (): Promise<SessionResult> => {
    const m = machineRef.current!;
    const durationMs = Math.max(1, Math.round(m.accumulatedActiveMs));
    const aligner = m.aligner;
    const statuses = aligner.refWordStatuses();
    const paceWpm =
      aligner.matchedCount > 0 && durationMs >= 1_000
        ? Math.round(aligner.matchedCount / (durationMs / 60_000))
        : 0;

    let audioUri: string | null = null;
    let waveform: number[] | null = null;
    const segmentBytes: (Uint8Array | null)[] = [];
    const segmentDurations: number[] = [];

    try {
      for (const uri of m.segmentUris) {
        let bytes: Uint8Array | null = null;
        if (uri) {
          try {
            const file = new File(uri);
            if (file.exists) bytes = await file.bytes();
          } catch {
            bytes = null;
          }
        }
        segmentBytes.push(bytes);
        let duration = 0;
        if (bytes) {
          try {
            duration = wavDurationMs(bytes);
          } catch {
            segmentBytes[segmentBytes.length - 1] = null;
          }
        }
        segmentDurations.push(duration);
      }

      const playable = segmentBytes.filter((b): b is Uint8Array => b != null);
      if (playable.length > 0) {
        const full = playable.length === 1 ? playable[0] : concatWavs(playable);
        const out = new File(Paths.cache, `practice-${m.sessionId}-full.wav`);
        try {
          if (out.exists) out.delete();
        } catch {
          // ignore
        }
        out.write(full);
        audioUri = out.uri;
        waveform = downsampleWaveform(full, 30);
      }
    } catch (e) {
      if (__DEV__) console.warn('[practice] audio processing failed:', e);
      audioUri = null;
      waveform = null;
    }

    const base = {
      tokenized,
      statuses,
      insertions: aligner.committedInsertions,
      paceWpm,
      targetWpm: passage.targetWpm,
      fillerCount: aligner.fillerCount,
      durationMs,
      audioUri,
      waveform: waveform ?? waveformFromMeterHistory(m.meterHistory),
    };

    const key = process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY;
    const region = process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION;
    if (key && region) {
      try {
        const chunks = buildChunks(
          tokenized,
          aligner.timeline,
          segmentDurations,
          m.segmentActiveStartMs,
        ).filter((c) => segmentBytes[c.segmentIndex] != null);
        if (chunks.length > 0) {
          const wavChunks = chunks.map((c) => ({
            wavBytes: sliceWav(segmentBytes[c.segmentIndex]!, c.startMs, c.endMs),
            referenceText: c.referenceText,
          }));
          const assessments = await assessSession(wavChunks, { key, region });
          const azure = buildAzureResult({ ...base, chunks, assessments });
          if (azure) return azure;
        }
      } catch (e) {
        if (__DEV__) console.warn('[practice] Azure assessment failed:', e);
      }
    }

    return buildLiveFallbackResult(base);
  };

  // ---- public API -----------------------------------------------------------

  const api = useMemo(() => {
    const accumulate = () => {
      const m = machineRef.current!;
      if (m.listeningSinceWall != null) {
        m.accumulatedActiveMs += Date.now() - m.listeningSinceWall;
        m.listeningSinceWall = null;
      }
    };

    return {
      async start() {
        const m = machineRef.current!;
        if (m.status === 'listening' || m.status === 'processing') return;
        if (engineOwner != null && engineOwner !== instanceId) {
          try {
            ExpoSpeechRecognitionModule.abort();
          } catch {
            // stale owner
          }
        }
        engineOwner = instanceId;
        resetMachine(m);
        // Bail out immediately where SFSpeechRecognizer doesn't exist at all
        // (e.g. iOS simulators) instead of burning the auto-restart budget.
        if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
          fail(
            'recognition-unavailable',
            'Speech recognition is not available on this device (simulators usually lack it — try a physical device).',
          );
          return;
        }
        try {
          const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!permission.granted) {
            fail('permission-denied', 'Microphone and speech recognition access are required to practice.');
            return;
          }
        } catch (e) {
          fail('unknown', e instanceof Error ? e.message : 'Failed to request permissions.');
          return;
        }
        m.listeningSinceWall = Date.now();
        setStatusSafe('listening');
        try {
          startRecognition(m.mode);
        } catch (e) {
          fail('recognition-unavailable', e instanceof Error ? e.message : 'Could not start speech recognition.');
        }
      },

      pause() {
        const m = machineRef.current!;
        if (m.status !== 'listening') return;
        m.expectEnd = true;
        accumulate();
        setStatusSafe('paused');
        try {
          ExpoSpeechRecognitionModule.stop(); // graceful: final result + audioend
        } catch {
          // already stopped
        }
      },

      resume() {
        const m = machineRef.current!;
        if (m.status !== 'paused') return;
        m.listeningSinceWall = Date.now();
        setStatusSafe('listening');
        startRecognition(m.mode);
      },

      restart() {
        const m = machineRef.current!;
        m.expectEnd = true;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // already inactive
        }
        deleteSegmentFiles(m);
        resetMachine(m);
        m.listeningSinceWall = Date.now();
        setStatusSafe('listening');
        // Give the native recognizer a beat to tear down before restarting.
        setTimeout(() => {
          const current = machineRef.current!;
          if (current.status === 'listening' && current.recSession === -1) {
            startRecognition(current.mode);
          }
        }, 300);
      },

      cancel() {
        const m = machineRef.current!;
        m.expectEnd = true;
        accumulate();
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // already inactive
        }
        deleteSegmentFiles(m);
        if (engineOwner === instanceId) engineOwner = null;
        setStatusSafe('idle');
      },

      async stop(): Promise<SessionResult> {
        const m = machineRef.current!;
        if (m.status === 'done' && m.result) return m.result;
        m.expectEnd = true;
        m.stopping = true;
        accumulate();
        setStatusSafe('processing');
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // already stopped
        }
        await waitForAudioQuiet(AUDIO_END_TIMEOUT_MS);

        let finalResult: SessionResult;
        try {
          finalResult = await finishProcessing();
        } catch (e) {
          // Absolute last resort — never dead-end.
          if (__DEV__) console.warn('[practice] processing failed entirely:', e);
          finalResult = buildLiveFallbackResult({
            tokenized,
            statuses: m.aligner.refWordStatuses(),
            insertions: m.aligner.committedInsertions,
            paceWpm: 0,
            targetWpm: passage.targetWpm,
            fillerCount: m.aligner.fillerCount,
            durationMs: Math.max(1, Math.round(m.accumulatedActiveMs)),
            audioUri: null,
            waveform: waveformFromMeterHistory(m.meterHistory),
          });
        }

        m.result = finalResult;
        if (mounted.current) setResult(finalResult);
        setStatusSafe('done');
        if (engineOwner === instanceId) engineOwner = null;
        // Segment files are merged into the full WAV — clean them up.
        deleteSegmentFiles(m);
        return finalResult;
      },
    };
    // machineRef/tokenized/passage are stable for the life of a session screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, tokenized, instanceId]);

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
