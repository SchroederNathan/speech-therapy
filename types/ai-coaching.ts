export type SpeechCoachStats = {
  /** 'passage' | 'drill' read against a reference text; 'freestyle' impromptu. */
  mode: 'passage' | 'drill' | 'freestyle';
  /** Freestyle only: the recognized transcript, capped for the prompt. */
  transcriptExcerpt?: string;
  overallScore: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  intonation: number;
  paceWpm: number;
  targetWpm: number;
  fillerCount: number;
  durationSeconds: number;
  assessmentSource: 'azure' | 'live';
  wordCounts: {
    good: number;
    mispronounced: number;
    omitted: number;
    inserted: number;
  };
  challengingWords: string[];
};

export type AiCoachingTip = {
  title: string;
  guidance: string;
  evidence: string;
};

export type AiCoachingBreakdown = {
  summary: string;
  tips: AiCoachingTip[];
};

/** In-flight snapshot of the breakdown while the response streams in. */
export type PartialAiCoachingBreakdown = {
  summary?: string;
  tips?: (Partial<AiCoachingTip> | undefined)[];
};
