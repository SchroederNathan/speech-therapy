/**
 * Derived practice statistics: streaks, daily/weekly goal progress, the EWMA
 * skill profile that drives recommendations, and the aggregate helpers the
 * Analytics screen will consume.
 *
 * PURE module: runs under bun for scripts/test-stats.ts. All "today" math
 * takes an explicit `now` timestamp so tests are deterministic.
 */

import { fillerScore, paceScore } from '@/services/scoring';
import type {
  SessionRecord,
  SkillEstimate,
  SkillKey,
  SkillProfile,
} from '@/types/history';

export const DAILY_GOAL_MINUTES = 20;

/** Local-calendar day key, YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const DAY_MS = 86_400_000;

function minutesByDay(records: readonly SessionRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = dayKey(r.completedAt);
    map.set(key, (map.get(key) ?? 0) + r.durationMs / 60_000);
  }
  return map;
}

export function minutesOnDay(records: readonly SessionRecord[], dayMs: number): number {
  const key = dayKey(dayMs);
  let total = 0;
  for (const r of records) {
    if (dayKey(r.completedAt) === key) total += r.durationMs / 60_000;
  }
  return total;
}

/** Today's goal completion, 0–1. */
export function todayProgress(records: readonly SessionRecord[], now: number): number {
  return Math.min(minutesOnDay(records, now) / DAILY_GOAL_MINUTES, 1);
}

/** Goal-met flags for the 5 days before today, oldest first — exactly the
 * shape WeeklyProgress's `history` prop expects. */
export function weeklyHistory(
  records: readonly SessionRecord[],
  now: number,
): boolean[] {
  const byDay = minutesByDay(records);
  const out: boolean[] = [];
  for (let i = 5; i >= 1; i--) {
    out.push((byDay.get(dayKey(now - i * DAY_MS)) ?? 0) >= DAILY_GOAL_MINUTES);
  }
  return out;
}

/** Consecutive days with ≥1 session, counting back from today — or from
 * yesterday when today has none yet (an empty morning doesn't break it). */
export function streak(records: readonly SessionRecord[], now: number): number {
  const days = new Set(records.map((r) => dayKey(r.completedAt)));
  let start = now;
  if (!days.has(dayKey(start))) {
    start -= DAY_MS;
    if (!days.has(dayKey(start))) return 0;
  }
  let count = 0;
  while (days.has(dayKey(start - count * DAY_MS))) count++;
  return count;
}

// --- Skill profile -----------------------------------------------------------

const EWMA_ALPHA = 0.3;
const EWMA_WINDOW = 30;
/** A skill needs this many samples before recommendations trust it. */
export const SKILL_KNOWN_SAMPLES = 3;

type SkillInput = {
  /** Metric extraction; null = record not eligible for this skill. */
  input: (r: SessionRecord) => number | null;
};

const SKILL_INPUTS: Record<SkillKey, SkillInput> = {
  // Freestyle has no reference text, so its accuracy (0) is meaningless.
  accuracy: { input: (r) => (r.mode === 'freestyle' ? null : r.accuracy) },
  fluency: { input: (r) => r.fluency },
  // Live-fallback intonation is a hardcoded placeholder — Azure-only.
  intonation: { input: (r) => (r.source === 'azure' ? r.intonation : null) },
  pace: { input: (r) => (r.paceWpm > 0 ? paceScore(r.paceWpm, r.targetWpm) : null) },
  fillers: { input: (r) => fillerScore(r.fillerCount, r.durationMs) },
};

export const SKILL_KEYS = Object.keys(SKILL_INPUTS) as SkillKey[];

/** EWMA (α=0.3) per skill over the most recent ≤30 records, oldest→newest,
 * seeded with each skill's first eligible sample. */
export function skillProfile(records: readonly SessionRecord[]): SkillProfile {
  const recent = [...records]
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-EWMA_WINDOW);

  const profile = {} as SkillProfile;
  for (const key of SKILL_KEYS) {
    const { input } = SKILL_INPUTS[key];
    const estimate: SkillEstimate = { value: 0, samples: 0 };
    for (const r of recent) {
      const x = input(r);
      if (x == null) continue;
      estimate.value =
        estimate.samples === 0 ? x : EWMA_ALPHA * x + (1 - EWMA_ALPHA) * estimate.value;
      estimate.samples += 1;
    }
    profile[key] = estimate;
  }
  return profile;
}

// --- Analytics-ready aggregates (data now, UI later) --------------------------

export type DailyAggregate = {
  dayKey: string;
  minutes: number;
  sessions: number;
  /** null when the day has no sessions. */
  avgOverall: number | null;
  avgPace: number | null;
  /** Fillers per active minute. */
  fillerRate: number | null;
};

/** Per-day series for the last `days` days ending today, oldest first. */
export function dailyAggregates(
  records: readonly SessionRecord[],
  days: number,
  now: number,
): DailyAggregate[] {
  const byDay = new Map<string, SessionRecord[]>();
  for (const r of records) {
    const key = dayKey(r.completedAt);
    const list = byDay.get(key) ?? [];
    list.push(r);
    byDay.set(key, list);
  }

  const out: DailyAggregate[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY_MS);
    const list = byDay.get(key) ?? [];
    const minutes = list.reduce((s, r) => s + r.durationMs / 60_000, 0);
    const avg = (f: (r: SessionRecord) => number) =>
      list.length ? list.reduce((s, r) => s + f(r), 0) / list.length : null;
    out.push({
      dayKey: key,
      minutes,
      sessions: list.length,
      avgOverall: avg((r) => r.overallScore),
      avgPace: avg((r) => r.paceWpm),
      fillerRate:
        minutes > 0
          ? list.reduce((s, r) => s + r.fillerCount, 0) / minutes
          : null,
    });
  }
  return out;
}

export type Totals = {
  minutes: number;
  sessions: number;
  bestOverall: number;
  longestStreak: number;
};

export function totals(records: readonly SessionRecord[]): Totals {
  let minutes = 0;
  let bestOverall = 0;
  for (const r of records) {
    minutes += r.durationMs / 60_000;
    if (r.overallScore > bestOverall) bestOverall = r.overallScore;
  }

  // Longest run of consecutive practice days across all history.
  const days = [...new Set(records.map((r) => dayKey(r.completedAt)))].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of days) {
    if (prev != null) {
      const gap = Math.round(
        (new Date(key).getTime() - new Date(prev).getTime()) / DAY_MS,
      );
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = key;
  }

  return { minutes, sessions: records.length, bestOverall, longestStreak };
}

export type MetricKey =
  | 'overallScore'
  | 'accuracy'
  | 'fluency'
  | 'intonation'
  | 'paceWpm'
  | 'fillerCount';

/** Last-n `{completedAt, value}` series for sparklines, oldest first. */
export function metricTrend(
  records: readonly SessionRecord[],
  key: MetricKey,
  n: number,
): { completedAt: number; value: number }[] {
  return [...records]
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-n)
    .map((r) => ({ completedAt: r.completedAt, value: r[key] }));
}

/** Frequency-ranked trouble words across all sessions. */
export function topChallengingWords(
  records: readonly SessionRecord[],
  n: number,
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const word of r.challengingWords) {
      const key = word.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}
