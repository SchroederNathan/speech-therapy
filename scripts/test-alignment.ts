/**
 * Self-tests for the anchored greedy aligner. Pure JS — run with:
 *   bun scripts/test-alignment.ts
 */

import { tokenizePassage } from '@/lib/passage-text';
import {
  PassageAligner,
  SKIP_TOLERANCE,
  tokenizeTranscript,
  type AlignerEvent,
} from '@/services/alignment';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
  );
}

function section(name: string) {
  console.log(`\n== ${name}`);
}

const ev = (
  transcript: string,
  isFinal: boolean,
  atActiveMs = 0,
  segments?: AlignerEvent['segments'],
): AlignerEvent => ({ transcript, isFinal, atActiveMs, segments });

// ---------------------------------------------------------------------------
section('tokenizeTranscript');
{
  const tokens = tokenizeTranscript('Hello, world —  test');
  assertEq(
    tokens.map((t) => t.norm),
    ['hello', 'world', 'test'],
    'normalizes and drops punctuation-only tokens',
  );
  assert(tokens.every((t) => t.endMs === null), 'no times without segments');

  const timed = tokenizeTranscript('ignored', [
    { startTimeMillis: 1000, endTimeMillis: 2000, segment: 'one two' },
    { startTimeMillis: 2000, endTimeMillis: 2500, segment: 'three' },
  ]);
  assertEq(timed.map((t) => t.norm), ['one', 'two', 'three'], 'segment-derived tokens');
  assertEq(timed.map((t) => t.endMs), [1500, 2000, 2500], 'interpolated end times');
}

// ---------------------------------------------------------------------------
section('sequential interim/final progression');
{
  const tokenized = tokenizePassage('You ship your app to production. Congrats!');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  a.handleEvent(ev('you', false, 500));
  assertEq(a.currentWordIndex, 0, 'interim: last matched word is partial (frontier at it)');
  assertEq(a.matchedCount, 1, 'one match');

  a.handleEvent(ev('you ship your', false, 1200));
  assertEq(a.currentWordIndex, 2, 'frontier at "your" (partial)');
  assertEq(a.matchedCount, 3, 'three matches');

  a.handleEvent(ev('you ship your app to', true, 2000));
  assertEq(a.currentWordIndex, 5, 'final: frontier one past last match');
  assertEq(a.matchedCount, 5, 'five matches committed');
  assertEq(a.refWordStatuses().slice(0, 6), ['matched', 'matched', 'matched', 'matched', 'matched', 'unspoken'], 'committed statuses');
  assert(a.timeline[0] !== null && a.timeline[4] !== null, 'timeline populated for committed words');
  assertEq(a.timeline[5], null, 'unspoken word has no commit');
}

// ---------------------------------------------------------------------------
section('retroactive interim mutation');
{
  const tokenized = tokenizePassage('The quick brown fox jumps.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  a.handleEvent(ev('the quick round', false, 500)); // "round" mis-heard: prefix/no match
  a.handleEvent(ev('the quick brown fox', false, 900)); // recognizer corrects itself
  assertEq(a.currentWordIndex, 3, 'corrected interim re-aligns from anchor');
  a.handleEvent(ev('the quick brown fox jumps', true, 1500));
  assertEq(a.matchedCount, 5, 'all five committed after correction');
  assertEq(a.committedInsertions.length, 0, 'no lingering insertion from the mutated interim');
}

// ---------------------------------------------------------------------------
section('skipped words within tolerance');
{
  const tokenized = tokenizePassage('one two three four five six seven');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  a.handleEvent(ev('one four five', true, 1000)); // skipped two & three
  const statuses = a.refWordStatuses();
  assertEq(statuses.slice(0, 5), ['matched', 'skipped', 'skipped', 'matched', 'matched'], 'skip marking');
  assertEq(a.currentWordIndex, 5, 'frontier past skipped words');
  assertEq(a.matchedCount, 3, 'skips do not count as matches');
}

// ---------------------------------------------------------------------------
section('beyond skip tolerance -> insertion');
{
  const tokenized = tokenizePassage('alpha beta gamma delta epsilon zeta eta theta');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  // "theta" is 7 words ahead of the frontier (> SKIP_TOLERANCE=4) after alpha.
  assert(SKIP_TOLERANCE === 4, 'skip tolerance is 4 per plan');
  a.handleEvent(ev('alpha theta', true, 1000));
  assertEq(a.matchedCount, 1, 'far-ahead word does not match');
  assertEq(a.committedInsertions.length, 1, 'it becomes a committed insertion');
  assertEq(a.committedInsertions[0].norm, 'theta', 'insertion token recorded');
  assertEq(a.committedInsertions[0].afterMatchableIndex, 0, 'insertion anchored after alpha');
}

// ---------------------------------------------------------------------------
section('repeated words');
{
  const tokenized = tokenizePassage('Peter Piper picked a peck of pickled peppers. A peck of pickled peppers Peter Piper picked.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  a.handleEvent(ev('peter piper picked a peck of pickled peppers', true, 3000));
  assertEq(a.matchedCount, 8, 'first clause fully matched');
  a.handleEvent(ev('peter piper picked a peck of pickled peppers a peck of pickled peppers peter piper picked', true, 7000));
  assertEq(a.matchedCount, 16, 'repeated words match in order');
  assert(a.isComplete, 'passage complete');
}

// ---------------------------------------------------------------------------
section('fillers: finals only, unigrams + bigrams');
{
  const tokenized = tokenizePassage('We should focus on the plan today.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  // Interim insertions never count.
  a.handleEvent(ev('um we should', false, 500));
  assertEq(a.fillerCount, 0, 'interim insertion not counted');

  a.handleEvent(ev('um we should you know focus on like the plan today', true, 4000));
  // um (unigram) + you know (bigram = 1) + like (unigram) = 3
  assertEq(a.fillerCount, 3, 'unigram + bigram + unigram = 3');
  const fillers = a.committedInsertions.filter((i) => i.filler);
  assertEq(fillers.length, 4, 'four insertion tokens flagged (bigram flags both)');
  const nonFillerWords = a.refWordStatuses().filter((s) => s === 'matched').length;
  assertEq(nonFillerWords, 7, 'reference words still matched around fillers');

  // "so" that MATCHES the reference is not a filler.
  const t2 = tokenizePassage('So we begin.');
  const b = new PassageAligner(t2);
  b.beginSegment(0);
  b.handleEvent(ev('so we begin', true, 1000));
  assertEq(b.fillerCount, 0, 'reference-matching "so" is not a filler');
}

// ---------------------------------------------------------------------------
section('prefix partial match on trailing interim token');
{
  const tokenized = tokenizePassage('The wonderful machine works.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  a.handleEvent(ev('the wonde', false, 500));
  assertEq(a.currentWordIndex, 1, 'prefix match points frontier at the in-progress word');
  assertEq(a.matchedCount, 1, 'prefix guess not counted as a full match');
  a.handleEvent(ev('the wonderful', false, 800));
  assertEq(a.matchedCount, 2, 'full match once complete');
}

// ---------------------------------------------------------------------------
section('segments: pause/resume keeps the anchor');
{
  const tokenized = tokenizePassage('First sentence here. Second sentence there.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);
  a.handleEvent(ev('first sentence here', true, 2000, [
    { startTimeMillis: 100, endTimeMillis: 1900, segment: 'first sentence here' },
  ]));
  assertEq(a.currentWordIndex, 3, 'frontier after first sentence');

  a.beginSegment(1); // resume: new recognition session, transcript resets
  a.handleEvent(ev('second sentence there', true, 6000, [
    { startTimeMillis: 200, endTimeMillis: 1800, segment: 'second sentence there' },
  ]));
  assert(a.isComplete, 'aligner persists across segments');
  assertEq(a.timeline[3]?.segmentIndex, 1, 'second-segment commits tagged with segment 1');
  assert((a.timeline[3]?.endMsInSegment ?? 0) > 0, 'segment-relative time recorded');
  assertEq(a.timeline[5]?.endMsInSegment, 1800, 'last word time = segment end');
}

// ---------------------------------------------------------------------------
section('Android-style transcript reset without beginSegment');
{
  const tokenized = tokenizePassage('one two three four five six');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);
  a.handleEvent(ev('one two three', true, 1500));
  // Android continuous: next utterance transcript starts fresh.
  a.handleEvent(ev('four five', false, 2500));
  assertEq(a.matchedCount, 5, 'shrunken transcript treated as new utterance');
  a.handleEvent(ev('four five six', true, 3500));
  assert(a.isComplete, 'complete across utterance reset');
}

// ---------------------------------------------------------------------------
section('WPM trailing window');
{
  const tokenized = tokenizePassage(Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ') + '.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);

  assertEq(a.getLiveWpm(3000), 0, 'zero before 5s of data');

  // Speak 2 words per second: finals each second.
  let transcript = '';
  for (let s = 1; s <= 20; s++) {
    transcript += `${transcript ? ' ' : ''}word${(s - 1) * 2} word${(s - 1) * 2 + 1}`;
    a.handleEvent(ev(transcript, true, s * 1000));
    a.recordWpmSample(s * 1000);
  }
  const wpm = a.getLiveWpm(20_000);
  assert(Math.abs(wpm - 120) <= 8, `steady 2 words/s reads ~120wpm (got ${wpm})`);

  // Stop speaking: trailing window decays.
  for (let s = 21; s <= 33; s++) a.recordWpmSample(s * 1000);
  const decayed = a.getLiveWpm(33_000);
  assert(decayed < 30, `wpm decays after silence (got ${decayed})`);
}

// ---------------------------------------------------------------------------
section('restart resets everything');
{
  const tokenized = tokenizePassage('Say something here. Then more.');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);
  a.handleEvent(ev('say something um here', true, 2000));
  assert(a.matchedCount > 0 && a.fillerCount === 1, 'pre-reset state present');
  a.reset();
  a.beginSegment(0);
  assertEq(a.matchedCount, 0, 'matches cleared');
  assertEq(a.fillerCount, 0, 'fillers cleared');
  assertEq(a.committedInsertions.length, 0, 'insertions cleared');
  assertEq(a.currentWordIndex, 0, 'frontier reset');
  assertEq(a.getLiveWpm(20_000), 0, 'wpm samples cleared');
  a.handleEvent(ev('say something here then more', true, 2500));
  assert(a.isComplete, 'fresh session works after reset');
}

// ---------------------------------------------------------------------------
section('stop before trailing final: pending interim counts');
{
  const tokenized = tokenizePassage('alpha beta gamma delta');
  const a = new PassageAligner(tokenized);
  a.beginSegment(0);
  a.handleEvent(ev('alpha beta', true, 1000));
  a.handleEvent(ev('alpha beta gamma', false, 1500));
  const statuses = a.refWordStatuses();
  assertEq(statuses, ['matched', 'matched', 'matched', 'unspoken'], 'pending interim overlaid at stop');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
