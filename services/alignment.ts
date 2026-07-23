/**
 * Anchored incremental greedy alignment between live speech-recognition
 * transcripts and a tokenized passage.
 *
 * Design (see plan):
 * - Final results commit an anchor (`anchorRef` into the reference words,
 *   `anchorTranscriptLen` into the transcript tokens). Every result event
 *   re-aligns all *pending* (post-anchor) tokens from the anchor, which
 *   absorbs interim retro-mutations for free.
 * - Forward search with SKIP_TOLERANCE: up to 4 reference words may be
 *   skipped to find a match. Skipped words are marked tentatively spoken
 *   ('skipped') — Azure judges them properly later.
 * - Unmatched transcript tokens are insertion candidates; only insertions
 *   committed by a FINAL result feed the filler counter.
 * - The last matched token of an interim result is treated as "partial"
 *   (currently being spoken): the frontier points AT it, not past it.
 *
 * PURE module: no react / react-native imports, so it runs under bun for
 * the self-test scripts.
 */

import { normalizeToken, type TokenizedPassage } from '@/lib/passage-text';

export const SKIP_TOLERANCE = 4;

const WPM_WINDOW_MS = 15_000;
/** No live WPM until this much active time has elapsed. */
const WPM_MIN_ELAPSED_MS = 5_000;
/** ...and until the sample window spans at least this long. */
const WPM_MIN_SPAN_MS = 2_000;

/**
 * Filler lexicon, applied to final-committed insertions only (words that did
 * NOT match the reference — "so" spoken where the passage says "so" is never
 * a filler).
 */
const FILLER_UNIGRAMS = new Set([
  'um',
  'umm',
  'uh',
  'uhh',
  'uhm',
  'er',
  'err',
  'ah',
  'ahh',
  'hmm',
  'hm',
  'mmm',
  'like',
  'so',
  'basically',
  'actually',
  'literally',
  'right',
  'well',
  'okay',
  'ok',
  'anyway',
]);
const FILLER_BIGRAMS = new Set(['you know', 'i mean', 'sort of', 'kind of']);

export type TranscriptSegmentTiming = {
  /** Ms offset of the utterance start within the current recording segment. */
  startTimeMillis: number;
  /** Ms offset of the utterance end within the current recording segment. */
  endTimeMillis: number;
  /** The text portion covered by this timing span. */
  segment: string;
};

export type AlignerEvent = {
  transcript: string;
  isFinal: boolean;
  /** Active-session ms (pauses excluded) when the event arrived — wall-clock fallback for timestamps. */
  atActiveMs: number;
  /** Recognizer-provided timings, relative to the current recording segment's audio. */
  segments?: TranscriptSegmentTiming[];
};

export type RefWordStatus = 'unspoken' | 'matched' | 'skipped';

export type WordCommit = {
  /** Index into the tokenized passage's matchable words. */
  matchableIndex: number;
  /** Index into the tokenized passage's display words. */
  displayIndex: number;
  /** Recording segment (pause/resume cycle) this word was heard in. */
  segmentIndex: number;
  /** Ms offset within that segment's audio, when the recognizer provided timings. */
  endMsInSegment: number | null;
  /** Active-session ms at commit (wall-clock fallback). */
  atActiveMs: number;
};

export type CommittedInsertion = {
  /** Normalized token. */
  norm: string;
  /** Raw token as transcribed. */
  raw: string;
  segmentIndex: number;
  endMsInSegment: number | null;
  atActiveMs: number;
  /** Last matched matchable index before this insertion; -1 when none. */
  afterMatchableIndex: number;
  /** Whether the filler lexicon matched this insertion (bigrams flag both tokens). */
  filler: boolean;
};

type Token = { raw: string; norm: string; endMs: number | null };

/**
 * Split a transcript into normalized tokens. When recognizer segment timings
 * are provided, per-token end times are interpolated across each span.
 */
export function tokenizeTranscript(
  transcript: string,
  segments?: TranscriptSegmentTiming[],
): Token[] {
  const out: Token[] = [];
  const pushTokens = (text: string, startMs: number | null, endMs: number | null) => {
    const raws = text.split(/\s+/).filter(Boolean);
    raws.forEach((raw, i) => {
      const norm = normalizeToken(raw);
      if (!norm) return;
      let tokenEnd: number | null = null;
      if (startMs != null && endMs != null) {
        tokenEnd = startMs + ((endMs - startMs) * (i + 1)) / raws.length;
      }
      out.push({ raw, norm, endMs: tokenEnd });
    });
  };

  const usable = segments?.filter((s) => s.segment.trim().length > 0) ?? [];
  if (usable.length > 0) {
    for (const seg of usable) {
      pushTokens(seg.segment, seg.startTimeMillis, seg.endTimeMillis);
    }
    if (out.length > 0) return out;
  }
  pushTokens(transcript, null, null);
  return out;
}

type PendingAlignment = {
  matchedRefs: number[];
  skippedRefs: number[];
  /** Ref position after consuming all pending tokens. */
  refPos: number;
  /** Last matched matchable index (including a prefix-matched partial), or null. */
  lastMatch: number | null;
  /** Full (non-prefix) matches only. */
  fullMatchCount: number;
};

const EMPTY_PENDING: PendingAlignment = {
  matchedRefs: [],
  skippedRefs: [],
  refPos: 0,
  lastMatch: null,
  fullMatchCount: 0,
};

export class PassageAligner {
  private readonly refNorms: string[];
  private readonly refDisplay: number[];
  private readonly displayWordCount: number;

  /** Committed status per matchable index. */
  private committed: RefWordStatus[];
  /** Commit metadata per matchable index (matched words only). */
  readonly timeline: (WordCommit | null)[];
  readonly committedInsertions: CommittedInsertion[] = [];

  private anchorRef = 0;
  private anchorTranscriptLen = 0;
  /** Norms of the committed transcript prefix — detects utterance resets. */
  private anchorNorms: string[] = [];
  private committedMatched = 0;
  private lastCommittedMatch = -1;
  private segmentIndex = 0;
  private pending: PendingAlignment;
  private interim = false;

  fillerCount = 0;

  private wpmSamples: { atMs: number; matched: number }[] = [];

  constructor(private readonly tokenized: TokenizedPassage) {
    this.refNorms = tokenized.matchableIndices.map((d) => tokenized.norms[d]);
    this.refDisplay = tokenized.matchableIndices.slice();
    this.displayWordCount = tokenized.words.length;
    this.committed = new Array(this.refNorms.length).fill('unspoken');
    this.timeline = new Array(this.refNorms.length).fill(null);
    this.pending = { ...EMPTY_PENDING };
  }

  get totalMatchable(): number {
    return this.refNorms.length;
  }

  /** Matched words, committed + pending (full matches only). */
  get matchedCount(): number {
    return this.committedMatched + this.pending.fullMatchCount;
  }

  get isComplete(): boolean {
    return Math.max(this.anchorRef, this.pending.refPos) >= this.refNorms.length;
  }

  /**
   * Display index of the first word not yet fully spoken. During an interim
   * result the last matched word counts as partial (frontier points at it).
   */
  get currentWordIndex(): number {
    if (this.interim && this.pending.lastMatch != null) {
      return this.refDisplay[this.pending.lastMatch];
    }
    const frontier = Math.max(this.anchorRef, this.pending.refPos);
    return frontier < this.refDisplay.length ? this.refDisplay[frontier] : this.displayWordCount;
  }

  /** Called when a new recognition session begins (start/resume/auto-restart). */
  beginSegment(segmentIndex: number): void {
    this.segmentIndex = segmentIndex;
    this.anchorTranscriptLen = 0;
    this.anchorNorms = [];
    this.pending = { ...EMPTY_PENDING, refPos: this.anchorRef };
    this.interim = false;
  }

  handleEvent(event: AlignerEvent): void {
    const tokens = tokenizeTranscript(event.transcript, event.segments);

    // Android continuous mode resets the transcript after each final result:
    // a shrunken token list, or a committed prefix that no longer matches,
    // means a new utterance started. (On iOS the transcript accumulates for
    // the whole session and finals are stable, so the prefix always matches.)
    if (
      tokens.length < this.anchorTranscriptLen ||
      !this.anchorNorms.every((norm, i) => tokens[i]?.norm === norm)
    ) {
      this.anchorTranscriptLen = 0;
      this.anchorNorms = [];
    }

    const pendingTokens = tokens.slice(this.anchorTranscriptLen);
    let refPos = this.anchorRef;
    let lastMatch: number | null = null;
    let lastMatchWasPrefix = false;
    const matched: { token: Token; refIdx: number; prefix: boolean }[] = [];
    const skipped: number[] = [];
    // Insertion runs: consecutive unmatched tokens (for bigram filler detection).
    const insertionRuns: { token: Token; afterRef: number }[][] = [];
    let currentRun: { token: Token; afterRef: number }[] | null = null;

    pendingTokens.forEach((token, i) => {
      const isLastInterim = !event.isFinal && i === pendingTokens.length - 1;
      let found = -1;
      let prefix = false;
      for (let k = 0; k <= SKIP_TOLERANCE; k++) {
        const idx = refPos + k;
        if (idx >= this.refNorms.length) break;
        if (this.refNorms[idx] === token.norm) {
          found = idx;
          break;
        }
      }
      // The word currently being spoken may only be partially transcribed:
      // accept a prefix match for the trailing interim token.
      if (found < 0 && isLastInterim && token.norm.length >= 2) {
        for (let k = 0; k <= SKIP_TOLERANCE; k++) {
          const idx = refPos + k;
          if (idx >= this.refNorms.length) break;
          if (this.refNorms[idx].startsWith(token.norm)) {
            found = idx;
            prefix = true;
            break;
          }
        }
      }

      if (found >= 0) {
        for (let j = refPos; j < found; j++) skipped.push(j);
        matched.push({ token, refIdx: found, prefix });
        refPos = found + 1;
        lastMatch = found;
        lastMatchWasPrefix = prefix;
        currentRun = null;
      } else {
        const afterRef = lastMatch ?? this.lastCommittedMatch;
        if (!currentRun) {
          currentRun = [];
          insertionRuns.push(currentRun);
        }
        currentRun.push({ token, afterRef });
      }
    });

    if (event.isFinal) {
      for (const m of matched) {
        if (m.prefix) continue; // never commit a prefix guess
        if (this.committed[m.refIdx] !== 'matched') {
          this.committed[m.refIdx] = 'matched';
          this.committedMatched++;
        }
        this.timeline[m.refIdx] = {
          matchableIndex: m.refIdx,
          displayIndex: this.refDisplay[m.refIdx],
          segmentIndex: this.segmentIndex,
          endMsInSegment: m.token.endMs,
          atActiveMs: event.atActiveMs,
        };
      }
      for (const s of skipped) {
        if (this.committed[s] === 'unspoken') this.committed[s] = 'skipped';
      }
      for (const run of insertionRuns) {
        // Filler detection: greedy bigrams first, then unigrams.
        let i = 0;
        const fillerAt = new Array<boolean>(run.length).fill(false);
        while (i < run.length) {
          if (
            i + 1 < run.length &&
            FILLER_BIGRAMS.has(`${run[i].token.norm} ${run[i + 1].token.norm}`)
          ) {
            this.fillerCount++;
            fillerAt[i] = true;
            fillerAt[i + 1] = true;
            i += 2;
          } else {
            if (FILLER_UNIGRAMS.has(run[i].token.norm)) {
              this.fillerCount++;
              fillerAt[i] = true;
            }
            i += 1;
          }
        }
        run.forEach((entry, j) => {
          this.committedInsertions.push({
            norm: entry.token.norm,
            raw: entry.token.raw,
            segmentIndex: this.segmentIndex,
            endMsInSegment: entry.token.endMs,
            atActiveMs: event.atActiveMs,
            afterMatchableIndex: entry.afterRef,
            filler: fillerAt[j],
          });
        });
      }
      this.anchorRef = refPos;
      this.anchorTranscriptLen = tokens.length;
      this.anchorNorms = tokens.map((t) => t.norm);
      if (lastMatch != null && !lastMatchWasPrefix) this.lastCommittedMatch = lastMatch;
      this.pending = { ...EMPTY_PENDING, refPos };
      this.interim = false;
    } else {
      this.pending = {
        matchedRefs: matched.filter((m) => !m.prefix).map((m) => m.refIdx),
        skippedRefs: skipped,
        refPos,
        lastMatch,
        fullMatchCount: matched.filter((m) => !m.prefix).length,
      };
      this.interim = true;
    }
  }

  /**
   * Per-matchable-word statuses: committed alignment overlaid with the last
   * pending interim (so a stop() before the trailing final still counts what
   * was clearly heard).
   */
  refWordStatuses(): RefWordStatus[] {
    const statuses = this.committed.slice();
    for (const m of this.pending.matchedRefs) {
      if (statuses[m] === 'unspoken') statuses[m] = 'matched';
    }
    for (const s of this.pending.skippedRefs) {
      if (statuses[s] === 'unspoken') statuses[s] = 'skipped';
    }
    return statuses;
  }

  /** Push a WPM sample (~1Hz from the engine's tick loop). */
  recordWpmSample(atActiveMs: number): void {
    this.wpmSamples.push({ atMs: atActiveMs, matched: this.matchedCount });
    const cutoff = atActiveMs - WPM_WINDOW_MS - 500;
    while (this.wpmSamples.length > 0 && this.wpmSamples[0].atMs < cutoff) {
      this.wpmSamples.shift();
    }
  }

  /** Trailing-window live WPM; 0 until there's enough signal. */
  getLiveWpm(nowActiveMs: number): number {
    if (nowActiveMs < WPM_MIN_ELAPSED_MS) return 0;
    const windowStart = nowActiveMs - WPM_WINDOW_MS;
    let baseline: { atMs: number; matched: number } | null = null;
    for (const sample of this.wpmSamples) {
      if (sample.atMs >= windowStart) {
        baseline = sample;
        break;
      }
      baseline = sample; // keep the last sample before the window as the base
    }
    if (!baseline) return 0;
    const spanMs = nowActiveMs - baseline.atMs;
    if (spanMs < WPM_MIN_SPAN_MS) return 0;
    const words = this.matchedCount - baseline.matched;
    return Math.max(0, Math.round((words / spanMs) * 60_000));
  }

  reset(): void {
    this.committed = new Array(this.refNorms.length).fill('unspoken');
    this.timeline.fill(null);
    this.committedInsertions.length = 0;
    this.anchorRef = 0;
    this.anchorTranscriptLen = 0;
    this.anchorNorms = [];
    this.committedMatched = 0;
    this.lastCommittedMatch = -1;
    this.segmentIndex = 0;
    this.pending = { ...EMPTY_PENDING };
    this.interim = false;
    this.fillerCount = 0;
    this.wpmSamples = [];
  }
}
