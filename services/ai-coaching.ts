import { parsePartialJson } from 'ai';

// NOTE: uses the global fetch (Expo's WinterCG fetch on SDK 57+), which both
// streams response bodies and resolves relative URLs against the dev server.
// `expo/fetch` resolves relative URLs against file:/// and would 404 here.
import type {
  AiCoachingBreakdown,
  PartialAiCoachingBreakdown,
  SpeechCoachStats,
} from '@/types/ai-coaching';
import type { ResultWord, SessionResult } from '@/types/session';

const MAX_CHALLENGING_WORDS = 5;

function challengePriority(word: ResultWord): number {
  if (word.status === 'mispronounced') return word.score ?? 0;
  if (word.status === 'omitted') return 101;
  if (word.status === 'inserted') return 102;
  return 200;
}

/** Per-verdict counts plus the ≤5 hardest words — the summary both the AI
 * coach payload and the persisted SessionRecord keep instead of `words[]`. */
export function summarizeWords(words: readonly ResultWord[]): {
  wordCounts: SpeechCoachStats['wordCounts'];
  challengingWords: string[];
} {
  const wordCounts: SpeechCoachStats['wordCounts'] = {
    good: 0,
    mispronounced: 0,
    omitted: 0,
    inserted: 0,
  };

  for (const word of words) wordCounts[word.status] += 1;

  const challengingWords = words
    .filter((word) => word.status !== 'good')
    .sort((a, b) => challengePriority(a) - challengePriority(b))
    .map((word) => word.word.trim().slice(0, 40))
    .filter((word, index, list) => word.length > 0 && list.indexOf(word) === index)
    .slice(0, MAX_CHALLENGING_WORDS);

  return { wordCounts, challengingWords };
}

const MAX_TRANSCRIPT_EXCERPT = 1_200;

export function buildSpeechCoachStats(result: SessionResult): SpeechCoachStats {
  const { wordCounts, challengingWords } = summarizeWords(result.words);
  const mode = result.mode ?? 'passage';
  const transcriptExcerpt =
    mode === 'freestyle' && result.transcript
      ? result.transcript.slice(0, MAX_TRANSCRIPT_EXCERPT)
      : undefined;

  return {
    mode,
    ...(transcriptExcerpt != null ? { transcriptExcerpt } : {}),
    overallScore: result.overallScore,
    accuracy: result.accuracy,
    fluency: result.fluency,
    completeness: result.completeness,
    intonation: result.intonation,
    paceWpm: result.paceWpm,
    targetWpm: result.targetWpm,
    fillerCount: result.fillerCount,
    durationSeconds: Math.round(result.durationMs / 1000),
    assessmentSource: result.source,
    wordCounts,
    challengingWords,
  };
}

function isCoachingBreakdown(value: unknown): value is AiCoachingBreakdown {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AiCoachingBreakdown>;
  return (
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.tips) &&
    candidate.tips.length === 3 &&
    candidate.tips.every(
      (tip) =>
        !!tip &&
        typeof tip.title === 'string' &&
        typeof tip.guidance === 'string' &&
        typeof tip.evidence === 'string',
    )
  );
}

function toPartialBreakdown(value: unknown): PartialAiCoachingBreakdown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const partial: PartialAiCoachingBreakdown = {};

  if (typeof candidate.summary === 'string') partial.summary = candidate.summary;
  if (Array.isArray(candidate.tips)) {
    partial.tips = candidate.tips.map((tip) => {
      if (!tip || typeof tip !== 'object') return undefined;
      const t = tip as Record<string, unknown>;
      return {
        title: typeof t.title === 'string' ? t.title : undefined,
        guidance: typeof t.guidance === 'string' ? t.guidance : undefined,
        evidence: typeof t.evidence === 'string' ? t.evidence : undefined,
      };
    });
  }

  return partial.summary !== undefined || partial.tips !== undefined ? partial : null;
}

export async function requestAiCoaching(
  result: SessionResult,
  signal?: AbortSignal,
  onPartial?: (partial: PartialAiCoachingBreakdown) => void,
): Promise<AiCoachingBreakdown> {
  const response = await fetch('/api/speech-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats: buildSpeechCoachStats(result) }),
    signal,
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'AI coaching is unavailable right now.';
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('AI coaching is unavailable right now.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });

      if (onPartial) {
        const { value: parsed } = await parsePartialJson(accumulated);
        const partial = toPartialBreakdown(parsed);
        if (partial) onPartial(partial);
      }
    }
  } finally {
    reader.releaseLock();
  }

  accumulated += decoder.decode();

  const payload: unknown = await parsePartialJson(accumulated).then(
    ({ value, state }) =>
      state === 'successful-parse' || state === 'repaired-parse' ? value : null,
  );

  if (!isCoachingBreakdown(payload)) {
    throw new Error('The coaching response was incomplete.');
  }

  return payload;
}
