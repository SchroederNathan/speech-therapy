/** Persisted practice-history types: the slim per-session record everything
 * (Home stats, Practice recommendations, future Analytics) derives from. */

export type SkillKey = 'accuracy' | 'fluency' | 'intonation' | 'pace' | 'fillers';

export type SessionMode = 'passage' | 'drill' | 'freestyle';

export type WordCounts = {
  good: number;
  mispronounced: number;
  omitted: number;
  inserted: number;
};

/** One completed practice attempt. Deliberately scalar-only: per-word arrays,
 * audio URIs (cache files that get purged), and waveforms are dropped —
 * `wordCounts` + `challengingWords` are all downstream consumers need. */
export type SessionRecord = {
  id: string;
  /** Epoch ms; day math uses the device's local calendar. */
  completedAt: number;
  mode: SessionMode;
  /** Set for passage & drill modes. */
  passageId?: string;
  /** Set for freestyle mode. */
  topicId?: string;
  /** Active speaking time, pauses excluded (matches SessionResult.durationMs). */
  durationMs: number;
  overallScore: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  intonation: number;
  paceWpm: number;
  targetWpm: number;
  fillerCount: number;
  /** 'live' scores are derived proxies; intonation is a placeholder there. */
  source: 'azure' | 'live';
  wordCounts: WordCounts;
  /** Top ≤5 trouble words, hardest first. */
  challengingWords: string[];
};

/** EWMA skill estimate; `samples` gates whether the skill is "known". */
export type SkillEstimate = {
  value: number;
  samples: number;
};

export type SkillProfile = Record<SkillKey, SkillEstimate>;
