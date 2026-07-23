import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { metricTone, type MetricTone } from '@/lib/metrics';
import type { SessionResult } from '@/types/session';

import { MetricCard } from './metric-card';

const SCREEN_PADDING = 20;
const GAP = 12;

type MetricSpec = {
  label: string;
  value: number;
  unit?: string;
  tone: MetricTone | 'neutral';
};

export type MetricGridProps = {
  result: SessionResult;
};

/** 2×3 metric cards: Accuracy, Fluency, Pace / Fillers, Complete, Intonation. */
export function MetricGrid({ result }: MetricGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - SCREEN_PADDING * 2 - GAP * 2) / 3;

  const metrics: MetricSpec[] = [
    {
      label: 'Accuracy',
      value: result.accuracy,
      unit: '%',
      tone: metricTone('accuracy', result.accuracy),
    },
    {
      label: 'Fluency',
      value: result.fluency,
      unit: '%',
      tone: metricTone('fluency', result.fluency),
    },
    {
      label: 'Pace',
      value: result.paceWpm,
      unit: 'wpm',
      tone: metricTone('pace', result.paceWpm, result.targetWpm),
    },
    {
      label: 'Fillers',
      value: result.fillerCount,
      tone: metricTone('fillers', result.fillerCount),
    },
    {
      label: 'Complete',
      value: result.completeness,
      unit: '%',
      tone: metricTone('completeness', result.completeness),
    },
    {
      // Prosody score out of 100, not a percentage — no unit (matches design).
      label: 'Intonation',
      value: result.intonation,
      // Live-fallback intonation is a guess, not a measurement — de-emphasize.
      tone: result.source === 'live' ? 'neutral' : metricTone('intonation', result.intonation),
    },
  ];

  return (
    <View style={styles.grid}>
      {metrics.map((m) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          unit={m.unit}
          tone={m.tone}
          width={cardWidth}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});
