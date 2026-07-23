import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';
import type { MetricTone } from '@/lib/metrics';

const SECONDARY = { light: '#77777E', dark: '#9E9EA6' } as const;

export type MetricCardProps = {
  label: string;
  value: number;
  /** Small baseline-aligned unit after the value, e.g. "%" or "wpm". */
  unit?: string;
  /** 'neutral' de-emphasizes the value (live-fallback intonation). */
  tone: MetricTone | 'neutral';
  width: number;
};

export function MetricCard({ label, value, unit, tone, width }: MetricCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const secondary = SECONDARY[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const valueColor = tone === 'neutral' ? palette[scheme].foreground : colors[tone];

  return (
    <View style={[styles.card, { width }]}>
      {hasGlass ? (
        <GlassView
          glassEffectStyle="regular"
          style={[StyleSheet.absoluteFill, styles.shape, { backgroundColor: colors.controlCard }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.shape,
            { backgroundColor: colors.controlCardSolid },
          ]}
        />
      )}
      <Text style={[styles.label, { color: secondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{Math.round(value)}</Text>
        {unit ? <Text style={[styles.unit, { color: valueColor }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 96,
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  shape: {
    borderRadius: 26,
    borderCurve: 'continuous',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  value: {
    fontSize: 30,
    fontFamily: fonts.bold,
    letterSpacing: -0.4,
  },
  unit: {
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
});
