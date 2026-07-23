/**
 * Session scoring: sentence-based audio chunking for Azure's 30s cap,
 * word-count-weighted aggregation of chunk assessments, per-word verdict
 * mapping back onto the passage's display tokens, and the live-fallback
 * result builder used when Azure is unavailable or fails.
 *
 * PURE module (type-only import from azure-pronunciation): runs under bun
 * for the self-test scripts.
 */

import type { TokenizedPassage } from '@/lib/passage-text';
import type { ResultWord, SessionResult, WordVerdict } from '@/types/session';
import type { CommittedInsertion, RefWordStatus, WordCommit } from './alignment';
import type { ChunkAssessment } from './azure-pronunciation';

/** Azure short-audio caps assessment audio at 30s — pack chunks to 28s. */
export const MAX_CHUNK_MS = 28_000;
const CHUNK_LEAD_MS = 150;
const CHUNK_TAIL_MS = 350;

export type SentenceChunk = {
  /** Recording segment (pause/resume cycle) the audio lives in. */
  segmentIndex: number;
  /** Audio span within that segment. */
  startMs: number;
  endMs: number;
  /** Display-token range covered ([start, end)). */
  displayStart: number;
  displayEnd: number;
  /** Matchable-word range covered ([start, end)). */
  matchableStart: number;
  matchableEnd: number;
  referenceText: string;
  /** Matchable word count (aggregation weight). */
  matchableCount: number;
};

/**
 * Build <=28s assessment chunks by greedy-packing read sentences, using the
 * aligner's commit timestamps. Chunks never span recording-segment
 * boundaries; trailing sentences with no matched words are excluded (their
 * words stay 'omitted' locally).
 *
 * @param segmentDurationsMs Audio duration per recording segment (0 = unknown).
 * @param segmentActiveStartMs Active-session ms at each segment's start, used
 *   to convert wall-clock commit times into within-segment offsets when the
 *   recognizer gave no timings.
 */
export function buildChunks(
  tokenized: TokenizedPassage,
  timeline: (WordCommit | null)[],
  segmentDurationsMs: number[],
  segmentActiveStartMs: number[],
): SentenceChunk[] {
  const displayToMatchable = new Map<number, number>();
  tokenized.matchableIndices.forEach((displayIdx, matchableIdx) => {
    displayToMatchable.set(displayIdx, matchableIdx);
  });

  const resolveEndMs = (commit: WordCommit): number => {
    if (commit.endMsInSegment != null) return commit.endMsInSegment;
    const segStart = segmentActiveStartMs[commit.segmentIndex] ?? 0;
    return Math.max(0, commit.atActiveMs - segStart);
  };

  type SentenceInfo = {
    displayStart: number;
    displayEnd: number;
    matchableStart: number;
    matchableEnd: number;
    segmentIndex: number;
    startMs: number;
    endMs: number;
    hasCommits: boolean;
  };

  const sentences: SentenceInfo[] = [];
  let lastReadIndex = -1;
  let carrySegment = 0;
  let carryEndMs = 0;

  tokenized.sentences.forEach((sentence) => {
    let matchableStart = Number.MAX_SAFE_INTEGER;
    let matchableEnd = -1;
    const commits: WordCommit[] = [];
    for (let d = sentence.start; d < sentence.end; d++) {
      const m = displayToMatchable.get(d);
      if (m == null) continue;
      matchableStart = Math.min(matchableStart, m);
      matchableEnd = Math.max(matchableEnd, m + 1);
      const commit = timeline[m];
      if (commit) commits.push(commit);
    }
    if (matchableEnd < 0) {
      // Punctuation-only sentence — fold into nothing.
      matchableStart = 0;
      matchableEnd = 0;
    }

    let segmentIndex = carrySegment;
    let endMs = carryEndMs;
    let startMs = carryEndMs;
    if (commits.length > 0) {
      // A sentence's audio lives in the segment of its last commit.
      const lastCommit = commits[commits.length - 1];
      segmentIndex = lastCommit.segmentIndex;
      const sameSegment = commits.filter((c) => c.segmentIndex === segmentIndex);
      endMs = Math.max(...sameSegment.map(resolveEndMs));
      startMs = segmentIndex === carrySegment ? carryEndMs : 0;
      carrySegment = segmentIndex;
      carryEndMs = endMs;
      lastReadIndex = sentences.length;
    } else {
      startMs = carryEndMs;
      endMs = carryEndMs; // zero-length span; folded into a neighbor chunk
    }

    sentences.push({
      displayStart: sentence.start,
      displayEnd: sentence.end,
      matchableStart,
      matchableEnd,
      segmentIndex,
      startMs,
      endMs,
      hasCommits: commits.length > 0,
    });
  });

  if (lastReadIndex < 0) return [];

  const chunks: SentenceChunk[] = [];
  let current: SentenceInfo[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const seg = current[0].segmentIndex;
    const segDuration = segmentDurationsMs[seg] ?? 0;
    const rawStart = Math.max(0, current[0].startMs - CHUNK_LEAD_MS);
    let rawEnd = current[current.length - 1].endMs + CHUNK_TAIL_MS;
    if (segDuration > 0) rawEnd = Math.min(rawEnd, segDuration);
    rawEnd = Math.min(rawEnd, rawStart + MAX_CHUNK_MS); // hard cap
    const displayStart = current[0].displayStart;
    const displayEnd = current[current.length - 1].displayEnd;
    const matchableStart = Math.min(
      ...current.filter((s) => s.matchableEnd > s.matchableStart).map((s) => s.matchableStart),
    );
    const matchableEnd = Math.max(
      ...current.filter((s) => s.matchableEnd > s.matchableStart).map((s) => s.matchableEnd),
    );
    if (!Number.isFinite(matchableStart) || matchableEnd <= matchableStart) {
      current = [];
      return;
    }
    if (rawEnd > rawStart) {
      chunks.push({
        segmentIndex: seg,
        startMs: rawStart,
        endMs: rawEnd,
        displayStart,
        displayEnd,
        matchableStart,
        matchableEnd,
        referenceText: tokenized.words.slice(displayStart, displayEnd).join(' '),
        matchableCount: matchableEnd - matchableStart,
      });
    }
    current = [];
  };

  for (let i = 0; i <= lastReadIndex; i++) {
    const s = sentences[i];
    if (current.length > 0) {
      const sameSegment = current[0].segmentIndex === s.segmentIndex;
      const spanMs =
        s.endMs + CHUNK_TAIL_MS - Math.max(0, current[0].startMs - CHUNK_LEAD_MS);
      if (!sameSegment || spanMs > MAX_CHUNK_MS) flush();
    }
    current.push(s);
  }
  flush();

  return chunks;
}

/** 100 within ±10% of target, linear to 50 at 0.6x/1.5x, floor 30. */
export function paceScore(paceWpm: number, targetWpm: number): number {
  if (paceWpm <= 0 || targetWpm <= 0) return 30;
  const ratio = paceWpm / targetWpm;
  let score: number;
  if (ratio >= 0.9 && ratio <= 1.1) score = 100;
  else if (ratio < 0.9) score = 100 - ((0.9 - ratio) / 0.3) * 50;
  else score = 100 - ((ratio - 1.1) / 0.4) * 50;
  return Math.round(Math.max(30, Math.min(100, score)));
}

export function fillerScore(fillerCount: number, durationMs: number): number {
  const minutes = Math.max(durationMs / 60_000, 1 / 6); // floor 10s so a short take isn't crushed
  const perMinute = fillerCount / minutes;
  return Math.round(Math.max(30, 100 - 12 * perMinute));
}

export function overallScore(pron: number, pace: number, filler: number): number {
  return Math.round(0.65 * pron + 0.2 * pace + 0.15 * filler);
}

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Base per-display-token verdicts from live alignment. Punctuation-only
 * tokens inherit their preceding word's verdict so omitted runs render
 * contiguously.
 */
function baseVerdicts(
  tokenized: TokenizedPassage,
  statuses: RefWordStatus[],
): { verdict: WordVerdict; score?: number }[] {
  const displayToMatchable = new Map<number, number>();
  tokenized.matchableIndices.forEach((displayIdx, matchableIdx) => {
    displayToMatchable.set(displayIdx, matchableIdx);
  });
  const out: { verdict: WordVerdict; score?: number }[] = [];
  let previous: WordVerdict = 'good';
  for (let d = 0; d < tokenized.words.length; d++) {
    const m = displayToMatchable.get(d);
    if (m == null) {
      out.push({ verdict: previous });
      continue;
    }
    const verdict: WordVerdict = statuses[m] === 'matched' ? 'good' : 'omitted';
    out.push({ verdict });
    previous = verdict;
  }
  return out;
}

/** Assemble ResultWord[] from per-display verdicts plus spliced insertions. */
function assembleWords(
  tokenized: TokenizedPassage,
  verdicts: { verdict: WordVerdict; score?: number }[],
  insertionsAfterDisplay: Map<number, ResultWord[]>,
): ResultWord[] {
  const out: ResultWord[] = [];
  const leading = insertionsAfterDisplay.get(-1);
  if (leading) out.push(...leading);
  tokenized.words.forEach((word, d) => {
    const v = verdicts[d];
    out.push(v.score != null ? { word, status: v.verdict, score: v.score } : { word, status: v.verdict });
    const after = insertionsAfterDisplay.get(d);
    if (after) out.push(...after);
  });
  return out;
}

function insertionSpliceMap(
  tokenized: TokenizedPassage,
  insertions: CommittedInsertion[],
  filter: (i: CommittedInsertion) => boolean,
): Map<number, ResultWord[]> {
  const map = new Map<number, ResultWord[]>();
  for (const ins of insertions) {
    if (!filter(ins)) continue;
    const displayIdx =
      ins.afterMatchableIndex >= 0 ? tokenized.matchableIndices[ins.afterMatchableIndex] : -1;
    const list = map.get(displayIdx) ?? [];
    list.push({ word: ins.raw, status: 'inserted' });
    map.set(displayIdx, list);
  }
  return map;
}

export type ResultBuildParams = {
  tokenized: TokenizedPassage;
  statuses: RefWordStatus[];
  insertions: CommittedInsertion[];
  paceWpm: number;
  targetWpm: number;
  fillerCount: number;
  durationMs: number;
  audioUri: string | null;
  waveform: number[];
};

/**
 * Aggregate Azure chunk assessments into a SessionResult. Returns null when
 * every chunk failed (caller then uses the live fallback). Chunks that
 * individually failed keep their live verdicts.
 */
export function buildAzureResult(
  params: ResultBuildParams & {
    chunks: SentenceChunk[];
    assessments: (ChunkAssessment | null)[];
  },
): SessionResult | null {
  const { tokenized, chunks, assessments, statuses } = params;

  const succeeded = chunks
    .map((chunk, i) => ({ chunk, assessment: assessments[i] }))
    .filter((c): c is { chunk: SentenceChunk; assessment: ChunkAssessment } => c.assessment != null);
  if (succeeded.length === 0) return null;

  const verdicts = baseVerdicts(tokenized, statuses);
  const azureInsertions = new Map<number, ResultWord[]>();

  // Per-word verdict mapping: non-Insertion Azure words consume reference
  // words in order within the chunk's display range.
  for (const { chunk, assessment } of succeeded) {
    const refDisplayIndices: number[] = [];
    for (let d = chunk.displayStart; d < chunk.displayEnd; d++) {
      if (tokenized.norms[d] !== '') refDisplayIndices.push(d);
    }
    let refPtr = 0;
    let lastConsumed = chunk.displayStart - 1;
    for (const w of assessment.words) {
      if (w.errorType === 'Insertion') {
        const list = azureInsertions.get(lastConsumed) ?? [];
        list.push({ word: w.word, status: 'inserted' });
        azureInsertions.set(lastConsumed, list);
        continue;
      }
      if (refPtr >= refDisplayIndices.length) break; // defensive: count mismatch
      const d = refDisplayIndices[refPtr++];
      lastConsumed = d;
      const verdict: WordVerdict =
        w.errorType === 'Omission'
          ? 'omitted'
          : w.errorType === 'Mispronunciation'
            ? 'mispronounced'
            : 'good';
      verdicts[d] =
        verdict === 'omitted' || w.accuracyScore == null
          ? { verdict }
          : { verdict, score: clampScore(w.accuracyScore) };
    }
  }

  // Re-run punctuation inheritance now that Azure adjusted verdicts.
  let previous: WordVerdict = 'good';
  for (let d = 0; d < tokenized.words.length; d++) {
    if (tokenized.norms[d] === '') verdicts[d] = { ...verdicts[d], verdict: previous };
    else previous = verdicts[d].verdict;
  }

  const words = assembleWords(tokenized, verdicts, azureInsertions);

  // Word-count-weighted aggregation.
  const totalWeight = succeeded.reduce((sum, c) => sum + c.chunk.matchableCount, 0);
  const weighted = (pick: (a: ChunkAssessment) => number) =>
    succeeded.reduce((sum, c) => sum + pick(c.assessment) * c.chunk.matchableCount, 0) /
    totalWeight;

  const accuracy = clampScore(weighted((a) => a.accuracyScore));
  const fluency = clampScore(weighted((a) => a.fluencyScore));
  const pron = clampScore(weighted((a) => a.pronScore));

  const prosodyChunks = succeeded.filter((c) => c.assessment.prosodyScore != null);
  const prosodyWeight = prosodyChunks.reduce((sum, c) => sum + c.chunk.matchableCount, 0);
  const intonation =
    prosodyWeight > 0
      ? clampScore(
          prosodyChunks.reduce(
            (sum, c) => sum + c.assessment.prosodyScore! * c.chunk.matchableCount,
            0,
          ) / prosodyWeight,
        )
      : fluency;

  // Completeness: Azure judged only the chunks it saw; cap by how much of the
  // whole passage was actually spoken (good or mispronounced = attempted).
  const azureCompleteness = weighted((a) => a.completenessScore);
  const totalRefWords = tokenized.matchableIndices.length;
  const attempted = tokenized.matchableIndices.filter(
    (d) => verdicts[d].verdict === 'good' || verdicts[d].verdict === 'mispronounced',
  ).length;
  const completeness = clampScore(
    Math.min(azureCompleteness, (100 * attempted) / Math.max(1, totalRefWords)),
  );

  const pace = paceScore(params.paceWpm, params.targetWpm);
  const filler = fillerScore(params.fillerCount, params.durationMs);

  return {
    overallScore: overallScore(pron, pace, filler),
    accuracy,
    fluency,
    completeness,
    intonation,
    paceWpm: params.paceWpm,
    targetWpm: params.targetWpm,
    fillerCount: params.fillerCount,
    words,
    audioUri: params.audioUri,
    durationMs: params.durationMs,
    waveform: params.waveform,
    source: 'azure',
  };
}

/**
 * Live-derived fallback result (no Azure key / all chunks failed). Verdicts
 * come from alignment (matched = good, everything else = omitted, filler
 * insertions spliced); the numeric scores are documented proxies.
 */
export function buildLiveFallbackResult(params: ResultBuildParams): SessionResult {
  const { tokenized, statuses } = params;
  const verdicts = baseVerdicts(tokenized, statuses);
  // Splice only filler insertions in live mode — raw recognition noise would
  // clutter the breakdown without Azure's judgment to back it.
  const insertions = insertionSpliceMap(tokenized, params.insertions, (i) => i.filler);
  const words = assembleWords(tokenized, verdicts, insertions);

  const totalRefWords = Math.max(1, tokenized.matchableIndices.length);
  const matched = statuses.filter((s) => s === 'matched').length;
  const matchedRatio = matched / totalRefWords;

  const pace = paceScore(params.paceWpm, params.targetWpm);
  const filler = fillerScore(params.fillerCount, params.durationMs);

  // Proxies: without Azure there is no pronunciation signal, so accuracy
  // leans on how reliably the recognizer matched the reference, fluency on
  // pace steadiness, and intonation is a neutral 70.
  const completeness = clampScore(100 * matchedRatio);
  const accuracy = Math.min(95, clampScore(70 + 25 * matchedRatio));
  const fluency = Math.min(95, clampScore(0.6 * pace + 0.4 * accuracy));
  const intonation = 70;
  const pronProxy = clampScore(0.5 * accuracy + 0.2 * fluency + 0.3 * completeness);

  return {
    overallScore: overallScore(pronProxy, pace, filler),
    accuracy,
    fluency,
    completeness,
    intonation,
    paceWpm: params.paceWpm,
    targetWpm: params.targetWpm,
    fillerCount: params.fillerCount,
    words,
    audioUri: params.audioUri,
    durationMs: params.durationMs,
    waveform: params.waveform,
    source: 'live',
  };
}
