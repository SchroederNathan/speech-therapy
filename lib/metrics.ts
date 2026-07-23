export type MetricTone = 'good' | 'warn' | 'bad';

export type MetricKind =
  | 'accuracy'
  | 'fluency'
  | 'completeness'
  | 'intonation'
  | 'pace'
  | 'fillers';

/**
 * Color semantics for the results metric cards. Pace bands are tighter than
 * the intuitive ±10% because the design shows 189 vs target 179 (+5.6%) as a
 * warning.
 */
export function metricTone(kind: MetricKind, value: number, targetWpm?: number): MetricTone {
  switch (kind) {
    case 'accuracy':
    case 'completeness':
      return value >= 90 ? 'good' : value >= 75 ? 'warn' : 'bad';
    case 'fluency':
      // Looser than accuracy: the design shows 85 fluency as good.
      return value >= 80 ? 'good' : value >= 65 ? 'warn' : 'bad';
    case 'intonation':
      return value >= 75 ? 'good' : value >= 60 ? 'warn' : 'bad';
    case 'pace': {
      if (!targetWpm) return 'good';
      const deviation = Math.abs(value - targetWpm) / targetWpm;
      return deviation <= 0.05 ? 'good' : deviation <= 0.12 ? 'warn' : 'bad';
    }
    case 'fillers':
      return value === 0 ? 'good' : value <= 2 ? 'warn' : 'bad';
  }
}

/** Live pace label for the practice header, e.g. "good pace". */
export function paceLabel(liveWpm: number, targetWpm: number): string {
  if (liveWpm <= 0) return 'warming up';
  const ratio = liveWpm / targetWpm;
  if (ratio > 1.25) return 'too fast';
  if (ratio > 1.1) return 'a bit fast';
  if (ratio < 0.75) return 'too slow';
  if (ratio < 0.9) return 'a bit slow';
  return 'good pace';
}

export function scoreLabel(overallScore: number): string {
  if (overallScore >= 85) return 'Great Job';
  if (overallScore >= 70) return 'Good Work';
  if (overallScore >= 50) return 'Keep Going';
  return 'Keep Practicing';
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
