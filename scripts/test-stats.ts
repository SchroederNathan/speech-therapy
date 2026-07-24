/**
 * Self-tests for derived practice statistics. Pure JS — run with:
 *   bun scripts/test-stats.ts
 */

import {
  DAILY_GOAL_MINUTES,
  dailyAggregates,
  dayKey,
  metricTrend,
  skillProfile,
  streak,
  todayProgress,
  topChallengingWords,
  totals,
  weeklyHistory,
} from '@/lib/stats';
import type { SessionRecord } from '@/types/history';

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

const DAY = 86_400_000;
// Fixed local-noon anchor so day math never straddles midnight in any TZ.
const NOW = new Date(2026, 6, 24, 12, 0, 0).getTime();

let seq = 0;
function rec(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    id: `r${seq++}`,
    completedAt: NOW,
    mode: 'passage',
    passageId: 'epic-speech',
    durationMs: 120_000,
    overallScore: 80,
    accuracy: 85,
    fluency: 82,
    completeness: 90,
    intonation: 75,
    paceWpm: 150,
    targetWpm: 150,
    fillerCount: 2,
    source: 'azure',
    wordCounts: { good: 90, mispronounced: 5, omitted: 3, inserted: 2 },
    challengingWords: ['peck', 'pickled'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
section('dayKey');
{
  const d = new Date(2026, 0, 5, 23, 59).getTime();
  assertEq(dayKey(d), '2026-01-05', 'formats local YYYY-MM-DD with padding');
}

// ---------------------------------------------------------------------------
section('streak');
{
  assertEq(streak([], NOW), 0, 'empty history → 0');
  assertEq(streak([rec({})], NOW), 1, 'session today → 1');
  assertEq(
    streak([rec({ completedAt: NOW - DAY })], NOW),
    1,
    'yesterday only (empty morning) → 1',
  );
  assertEq(
    streak([rec({ completedAt: NOW - 2 * DAY })], NOW),
    0,
    'gap: nothing today or yesterday → 0',
  );
  assertEq(
    streak(
      [rec({}), rec({ completedAt: NOW - DAY }), rec({ completedAt: NOW - 2 * DAY })],
      NOW,
    ),
    3,
    'three consecutive days → 3',
  );
  assertEq(
    streak(
      [rec({}), rec({ completedAt: NOW - DAY }), rec({ completedAt: NOW - 3 * DAY })],
      NOW,
    ),
    2,
    'gap two days back stops the count',
  );
  assertEq(
    streak([rec({}), rec({ completedAt: NOW - 3 * 60_000 })], NOW),
    1,
    'multiple sessions in one day count once',
  );
}

// ---------------------------------------------------------------------------
section('todayProgress / weeklyHistory');
{
  assertEq(todayProgress([], NOW), 0, 'empty → 0');
  const half = rec({ durationMs: (DAILY_GOAL_MINUTES / 2) * 60_000 });
  assert(Math.abs(todayProgress([half], NOW) - 0.5) < 1e-9, 'half the goal → 0.5');
  const over = rec({ durationMs: DAILY_GOAL_MINUTES * 2 * 60_000 });
  assertEq(todayProgress([over], NOW), 1, 'clamped at 1');

  const goalDay = (offset: number) =>
    rec({ completedAt: NOW - offset * DAY, durationMs: DAILY_GOAL_MINUTES * 60_000 });
  assertEq(
    weeklyHistory([goalDay(5), goalDay(1), rec({ completedAt: NOW - 2 * DAY })], NOW),
    [true, false, false, false, true],
    'oldest-first flags; short day misses goal',
  );
  assertEq(weeklyHistory([], NOW).length, 5, 'always 5 entries');
}

// ---------------------------------------------------------------------------
section('skillProfile');
{
  const empty = skillProfile([]);
  assertEq(empty.accuracy.samples, 0, 'empty → zero samples');

  // Live-source intonation must be excluded (hardcoded placeholder).
  const live = [rec({ source: 'live', intonation: 70 }), rec({ source: 'live' })];
  assertEq(skillProfile(live).intonation.samples, 0, 'live records excluded from intonation');
  assert(skillProfile(live).fluency.samples === 2, 'live records still count for fluency');

  // Freestyle excluded from accuracy.
  const freestyle = [rec({ mode: 'freestyle', accuracy: 0, source: 'live' })];
  assertEq(skillProfile(freestyle).accuracy.samples, 0, 'freestyle excluded from accuracy');

  // EWMA: newest sample dominates at α=0.3 vs a single seed.
  const drift = [
    rec({ completedAt: NOW - DAY, accuracy: 100 }),
    rec({ completedAt: NOW, accuracy: 50 }),
  ];
  const est = skillProfile(drift).accuracy;
  assertEq(est.samples, 2, 'two samples');
  assert(Math.abs(est.value - (0.3 * 50 + 0.7 * 100)) < 1e-9, 'EWMA seeded then blended', est);

  // Pace uses paceScore vs target: on-target reads score 100.
  const paced = [rec({ paceWpm: 150, targetWpm: 150 })];
  assertEq(skillProfile(paced).pace.value, 100, 'on-target pace → 100');
  const zero = [rec({ paceWpm: 0 })];
  assertEq(skillProfile(zero).pace.samples, 0, 'zero WPM excluded from pace');
}

// ---------------------------------------------------------------------------
section('dailyAggregates / totals / metricTrend / topChallengingWords');
{
  const recordsList = [
    rec({ completedAt: NOW - DAY, durationMs: 60_000, overallScore: 60, fillerCount: 3 }),
    rec({ completedAt: NOW - DAY, durationMs: 60_000, overallScore: 80, fillerCount: 1 }),
    rec({ completedAt: NOW, durationMs: 120_000, overallScore: 90 }),
  ];
  const series = dailyAggregates(recordsList, 3, NOW);
  assertEq(series.length, 3, 'one entry per day');
  assertEq(series[0].sessions, 0, 'empty day has zero sessions');
  assertEq(series[0].avgOverall, null, 'empty day has null averages');
  assertEq(series[1].sessions, 2, 'yesterday grouped');
  assertEq(series[1].avgOverall, 70, 'yesterday average score');
  assertEq(series[1].fillerRate, 2, 'fillers per active minute');
  assertEq(series[2].minutes, 2, "today's minutes");

  const t = totals(recordsList);
  assertEq(t.sessions, 3, 'total sessions');
  assertEq(t.bestOverall, 90, 'best score');
  assertEq(t.longestStreak, 2, 'longest streak spans both days');

  const gapped = [rec({ completedAt: NOW - 5 * DAY }), rec({ completedAt: NOW })];
  assertEq(totals(gapped).longestStreak, 1, 'gap resets longest streak');

  const trend = metricTrend(recordsList, 'overallScore', 2);
  assertEq(trend.map((p) => p.value), [80, 90], 'last-n, oldest first (stable within day)');

  const words = topChallengingWords(
    [rec({ challengingWords: ['Peck', 'butter'] }), rec({ challengingWords: ['peck'] })],
    5,
  );
  assertEq(words[0], { word: 'peck', count: 2 }, 'case-insensitive frequency ranking');
}

// ---------------------------------------------------------------------------
section('recommend');
{
  const { recommend, FREESTYLE_ID_PREFIX } = await import('@/lib/recommendations');

  const cold = recommend([], skillProfile([]));
  assertEq(cold.weakest, null, 'cold start has no weakest skill');
  assertEq(cold.reason, null, 'cold start uses default subtitle');
  assert(cold.items.length === 4, 'cold start returns starter set', cold.items.map((i) => i.id));
  assert(
    cold.items.some((i) => i.id.startsWith(FREESTYLE_ID_PREFIX)),
    'cold start includes a freestyle card',
  );

  // Five sessions with weak pace (way over target) and everything else strong.
  const slow = Array.from({ length: 5 }, (_, i) =>
    rec({
      completedAt: NOW - i * DAY,
      paceWpm: 220,
      targetWpm: 150,
      accuracy: 95,
      fluency: 95,
      intonation: 95,
      fillerCount: 0,
    }),
  );
  const paceRec = recommend(slow, skillProfile(slow));
  assertEq(paceRec.weakest, 'pace', 'weak pace detected');
  assert(
    paceRec.items.some((i) => i.id === 'drill-slow-read' || i.id === 'drill-brisk-read'),
    'pace recommendation includes a pacing drill',
    paceRec.items.map((i) => i.id),
  );
  assert(
    paceRec.items.every((i) => i.id !== 'epic-speech' || slow[0].passageId !== 'epic-speech'),
    'most recent passage excluded',
  );

  // Heavy fillers → freestyle pinned first.
  const filler = Array.from({ length: 5 }, (_, i) =>
    rec({
      completedAt: NOW - i * DAY,
      fillerCount: 20,
      durationMs: 60_000,
      accuracy: 95,
      fluency: 95,
      intonation: 95,
    }),
  );
  const fillerRec = recommend(filler, skillProfile(filler));
  assertEq(fillerRec.weakest, 'fillers', 'weak fillers detected');
  assert(
    fillerRec.items[0].id.startsWith(FREESTYLE_ID_PREFIX),
    'freestyle pinned first for fillers',
    fillerRec.items.map((i) => i.id),
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
