/**
 * Shared passage tokenization. Both the UI (teleprompter rendering) and the
 * recognition engine (transcript alignment) MUST use this module so word
 * indices agree everywhere.
 */

export type SentenceRange = {
  /** Inclusive display-word index. */
  start: number;
  /** Exclusive display-word index. */
  end: number;
  paragraphIndex: number;
};

export type ParagraphRange = {
  start: number;
  end: number;
};

export type TokenizedPassage = {
  /** Display tokens in original casing/punctuation, whitespace-split. */
  words: string[];
  /**
   * Normalized (matchable) form of each display word; '' for tokens that are
   * pure punctuation (em-dashes etc.) and should be skipped by alignment.
   */
  norms: string[];
  /** Indices into `words` for tokens with a non-empty norm. */
  matchableIndices: number[];
  paragraphs: ParagraphRange[];
  sentences: SentenceRange[];
};

/** Lowercase, strip diacritics and everything but letters/digits/apostrophes. */
export function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9']/g, '');
}

const SENTENCE_END = /[.!?]["')\]]*$/;
/** Cap paragraph size so the teleprompter's active paragraph stays cheap to render. */
const MAX_SENTENCES_PER_PARAGRAPH = 6;

export function tokenizePassage(text: string): TokenizedPassage {
  const words: string[] = [];
  const norms: string[] = [];
  const matchableIndices: number[] = [];
  const paragraphs: ParagraphRange[] = [];
  const sentences: SentenceRange[] = [];

  const rawParagraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const raw of rawParagraphs) {
    const tokens = raw.split(' ').filter(Boolean);

    // Sentence ranges within this raw paragraph, in token offsets.
    const sentenceBreaks: number[] = [];
    tokens.forEach((token, i) => {
      if (SENTENCE_END.test(token)) sentenceBreaks.push(i + 1);
    });
    if (sentenceBreaks[sentenceBreaks.length - 1] !== tokens.length) {
      sentenceBreaks.push(tokens.length);
    }

    // Split oversize paragraphs into pseudo-paragraphs of ≤ MAX_SENTENCES each.
    for (let s = 0; s < sentenceBreaks.length; s += MAX_SENTENCES_PER_PARAGRAPH) {
      const chunkSentenceBreaks = sentenceBreaks.slice(s, s + MAX_SENTENCES_PER_PARAGRAPH);
      const chunkStartToken = s === 0 ? 0 : sentenceBreaks[s - 1];
      const chunkEndToken = chunkSentenceBreaks[chunkSentenceBreaks.length - 1];

      const paragraphIndex = paragraphs.length;
      const base = words.length;
      paragraphs.push({ start: base, end: base + (chunkEndToken - chunkStartToken) });

      let sentenceStart = chunkStartToken;
      for (const sentenceEnd of chunkSentenceBreaks) {
        sentences.push({
          start: base + (sentenceStart - chunkStartToken),
          end: base + (sentenceEnd - chunkStartToken),
          paragraphIndex,
        });
        sentenceStart = sentenceEnd;
      }

      for (let i = chunkStartToken; i < chunkEndToken; i++) {
        const token = tokens[i];
        const norm = normalizeToken(token);
        if (norm) matchableIndices.push(words.length);
        words.push(token);
        norms.push(norm);
      }
    }
  }

  return { words, norms, matchableIndices, paragraphs, sentences };
}

/** The sentence containing the given display-word index (or the last one). */
export function sentenceAt(tokenized: TokenizedPassage, wordIndex: number): SentenceRange {
  const found = tokenized.sentences.find((s) => wordIndex >= s.start && wordIndex < s.end);
  return found ?? tokenized.sentences[tokenized.sentences.length - 1];
}
