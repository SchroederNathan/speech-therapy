import type { TokenizedPassage } from '@/lib/passage-text';
import {
  PassageAligner,
  type AlignerEvent,
  type TranscriptSegmentTiming,
} from '@/services/alignment';

export type LiveRecognitionHypothesis = {
  transcript: string;
  confidence: number;
  segments?: TranscriptSegmentTiming[];
};

/**
 * Bias the generic platform recognizer toward the known passage. Both Apple
 * and Android expect short phrases, so prioritize upcoming words and bigrams
 * instead of sending the passage as one long string.
 */
export function buildContextualStrings(
  tokenized: TokenizedPassage,
  fromDisplayIndex: number,
  limit = 100,
): string[] {
  const start = Math.max(0, Math.min(fromDisplayIndex, tokenized.words.length));
  const candidates: string[] = [];

  for (let i = start; i < tokenized.words.length; i++) {
    const word = tokenized.norms[i];
    if (word.length >= 2) candidates.push(word);
  }
  for (let i = start; i + 1 < tokenized.words.length; i++) {
    const first = tokenized.norms[i];
    const second = tokenized.norms[i + 1];
    if (first && second) candidates.push(`${first} ${second}`);
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    unique.push(candidate);
    if (unique.length >= limit) break;
  }
  return unique;
}

/**
 * Rerank all native hypotheses against the known passage. Native confidence
 * is only a tie-breaker because confidence is absent/zero on many interims.
 */
export function selectBestHypothesis(
  hypotheses: LiveRecognitionHypothesis[],
  aligner: PassageAligner,
  isFinal: boolean,
  atActiveMs: number,
): LiveRecognitionHypothesis | null {
  let best: LiveRecognitionHypothesis | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const hypothesis of hypotheses) {
    const event: AlignerEvent = {
      transcript: hypothesis.transcript,
      isFinal,
      atActiveMs,
      segments: hypothesis.segments,
    };
    const score = aligner.scoreEvent(event, hypothesis.confidence);
    if (score > bestScore) {
      best = hypothesis;
      bestScore = score;
    }
  }
  return best;
}
