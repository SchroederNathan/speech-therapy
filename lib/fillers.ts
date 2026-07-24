/**
 * Filler lexicon shared by the passage aligner (fillers = final-committed
 * insertions vs the reference) and the freestyle session (fillers = matches
 * in the raw final transcript, since there is no reference text).
 *
 * PURE module: runs under bun for self-tests.
 */

export const FILLER_UNIGRAMS = new Set([
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

export const FILLER_BIGRAMS = new Set(['you know', 'i mean', 'sort of', 'kind of']);

/** Count fillers in normalized tokens — greedy bigrams first, then unigrams
 * (the same rule the aligner applies to insertion runs). */
export function countFillers(norms: readonly string[]): number {
  let count = 0;
  let i = 0;
  while (i < norms.length) {
    if (i + 1 < norms.length && FILLER_BIGRAMS.has(`${norms[i]} ${norms[i + 1]}`)) {
      count++;
      i += 2;
    } else {
      if (FILLER_UNIGRAMS.has(norms[i])) count++;
      i += 1;
    }
  }
  return count;
}
