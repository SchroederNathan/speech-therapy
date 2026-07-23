import type { SharedValue } from 'react-native-reanimated';

/** A practice passage: home-card metadata plus the reading content. */
export type Passage = {
  id: string;
  title: string;
  /** Display duration for cards, e.g. "~2 mins". */
  duration: string;
  artwork: {
    base: [string, string];
    blob: [string, string];
  };
  /** Full reference text. Paragraphs separated by "\n\n". */
  text: string;
  targetWpm: number;
};

export type PracticeStatus =
  | 'idle'
  | 'listening'
  | 'paused'
  | 'processing'
  | 'done'
  | 'error';

export type PracticeErrorCode =
  | 'permission-denied'
  | 'recognition-unavailable'
  | 'no-speech'
  | 'unknown';

export type PracticeError = {
  code: PracticeErrorCode;
  message: string;
};

export type WordVerdict = 'good' | 'mispronounced' | 'omitted' | 'inserted';

export type ResultWord = {
  word: string;
  status: WordVerdict;
  /** Azure per-word AccuracyScore 0–100; absent for inserted words and live-fallback results. */
  score?: number;
};

export type SessionResult = {
  /** 0–100 blended score (pronunciation + pace + fillers). */
  overallScore: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  intonation: number;
  paceWpm: number;
  targetWpm: number;
  fillerCount: number;
  words: ResultWord[];
  /** Playable WAV (segments concatenated across pauses); null when unavailable. */
  audioUri: string | null;
  /** Active speaking time, pauses excluded. */
  durationMs: number;
  /** ~30 normalized 0..1 amplitude buckets for the playback pill. */
  waveform: number[];
  /** 'live' when Azure was unavailable/failed and scores are derived from live data. */
  source: 'azure' | 'live';
};

export type PracticeSession = {
  status: PracticeStatus;
  /** Non-null exactly when status === 'error'. */
  error: PracticeError | null;
  /** Active time excluding pauses; ticks ~every 250ms. */
  elapsedMs: number;
  /** Rolling-window WPM; 0 until enough signal (~5s). Updates ~1Hz. */
  liveWpm: number;
  /** Live filler-word count. */
  fillerCount: number;
  /** Display tokens from tokenizePassage — the single source of truth for word indices. */
  words: string[];
  /** Frontier: index of the first word not yet fully spoken. */
  currentWordIndex: number;
  /** 0..1 progress through the current word. High-frequency (~10Hz); consume only in a small leaf component. */
  currentWordFraction: number;
  /** 0..1 smoothed mic level, written on the UI-thread-safe path for the waveform. */
  meterLevel: SharedValue<number>;
  /** Populated when status === 'done' (same value stop() resolves with). */
  result: SessionResult | null;
  /** Requests permissions and begins listening. NOT called automatically on mount. */
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  /** Abort and reset to a fresh listening session. */
  restart(): void;
  /** Abandon the session entirely (dismiss): stop everything, discard recordings. */
  cancel(): void;
  /** Ends the session: → 'processing' → 'done'. Resolves with the final result. */
  stop(): Promise<SessionResult>;
};

export type LiveWordState = 'spoken' | 'current' | 'upcoming';

/** Derive a word's live render state from the frontier index. */
export function getWordState(index: number, currentWordIndex: number): LiveWordState {
  if (index < currentWordIndex) return 'spoken';
  if (index === currentWordIndex) return 'current';
  return 'upcoming';
}

export type ResultPlayback = {
  isPlaying: boolean;
  /** Playback position; updates ~4Hz while playing. */
  positionMs: number;
  toggle(): void;
};
