import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/constants/fonts';

const TICK_COUNT = 35;

const THEME = {
  light: {
    glassTint: 'rgba(255,255,255,0.45)',
    solidFallback: 'rgba(255,255,255,0.96)',
    foreground: '#111114',
    secondary: '#77777E',
    muted: '#9A9AA0',
    tick: '#111114',
    track: 'rgba(17,17,20,0.16)',
    divider: '#E4E4E9',
    badgeBg: '#1C1C21',
    badgeText: '#FFFFFF',
    positive: '#23A55A',
  },
  dark: {
    glassTint: 'rgba(10,10,12,0.55)',
    solidFallback: 'rgba(26,26,30,0.96)',
    foreground: '#FFFFFF',
    secondary: '#9E9EA6',
    muted: '#7C7C84',
    tick: '#FFFFFF',
    track: 'rgba(255,255,255,0.18)',
    divider: 'rgba(255,255,255,0.12)',
    badgeBg: '#F2F2F5',
    badgeText: '#111114',
    positive: '#2ECC71',
  },
} as const;

export type ProgressCardProps = {
  /** Best overall score, 0–100. */
  bestScore: number;
  /** Tier label for the badge (e.g. "ORATOR"). */
  rating: string;
  /** What earned the best score (passage title or mode label). */
  sessionLabel: string;
  /** Relative time of the best session, e.g. "2d ago". */
  timeAgo: string;
  totalMinutes: number;
  minutesThisWeek: number;
  totalSessions: number;
  sessionsThisWeek: number;
  longestStreak: number;
};

/** Chunky upward arrow that fronts the green "this week" deltas — traced from
 * the design so it reads at 11px where a stroke icon would smear. */
function UpArrow({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12">
      <Path d="M6 2 L10 7 L7.5 7 L7.5 10 L4.5 10 L4.5 7 L2 7 Z" fill={color} />
    </Svg>
  );
}

/** A tick-meter: a row of rounded bars, the first `fill` fraction inked and the
 * rest dimmed to a track — the same visual language as the daily-goal gauge. */
function TickMeter({ fill, tick, track }: { fill: number; tick: string; track: string }) {
  const filled = Math.round(Math.max(0, Math.min(fill, 1)) * TICK_COUNT);
  return (
    <View style={styles.meter}>
      {Array.from({ length: TICK_COUNT }, (_, i) => (
        <View
          key={i}
          style={[styles.tick, { backgroundColor: i < filled ? tick : track }]}
        />
      ))}
    </View>
  );
}

/** One momentum stat: big value + unit on top, a small caption below (green
 * "N this week" delta, or a muted label for the streak). */
function Stat({
  value,
  unit,
  delta,
  caption,
  theme,
}: {
  value: string;
  unit: string;
  delta?: number;
  caption?: string;
  theme: (typeof THEME)[keyof typeof THEME];
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Text style={[styles.statValue, { color: theme.foreground }]}>{value}</Text>
        <Text style={[styles.statUnit, { color: theme.secondary }]}>{unit}</Text>
      </View>
      {delta != null ? (
        <View style={styles.statDelta}>
          <UpArrow color={theme.positive} />
          <Text style={[styles.deltaLabel, { color: theme.positive }]}>{delta} this week</Text>
        </View>
      ) : (
        <Text style={[styles.captionLabel, { color: theme.muted }]}>{caption}</Text>
      )}
    </View>
  );
}

/** "Your progress" body: a frosted best-score hero above a three-up momentum
 * row (minutes, sessions, longest streak). */
export function ProgressCard({
  bestScore,
  rating,
  sessionLabel,
  timeAgo,
  totalMinutes,
  minutesThisWeek,
  totalSessions,
  sessionsThisWeek,
  longestStreak,
}: ProgressCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const heroBody = (
    <>
      <Text style={[styles.eyebrow, { color: theme.secondary }]}>BEST SCORE</Text>
      <View style={styles.scoreRow}>
        <View style={styles.scoreValue}>
          <Text style={[styles.score, { color: theme.foreground }]}>{bestScore}</Text>
          <Text style={[styles.scoreMax, { color: theme.muted }]}>/100</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
          <Text style={[styles.badgeLabel, { color: theme.badgeText }]}>{rating}</Text>
        </View>
      </View>
      <TickMeter fill={bestScore / 100} tick={theme.tick} track={theme.track} />
      <View style={styles.metaRow}>
        <Text style={[styles.metaName, { color: theme.secondary }]} numberOfLines={1}>
          {sessionLabel}
        </Text>
        <Text style={[styles.metaTime, { color: theme.muted }]}>{timeAgo}</Text>
      </View>
    </>
  );

  return (
    <View>
      {hasGlass ? (
        <GlassView glassEffectStyle="regular" style={[styles.hero, { backgroundColor: theme.glassTint }]}>
          {heroBody}
        </GlassView>
      ) : (
        <View style={[styles.hero, { backgroundColor: theme.solidFallback }]}>{heroBody}</View>
      )}

      <View style={styles.momentum}>
        <Stat
          value={String(totalMinutes)}
          unit="min"
          delta={minutesThisWeek}
          theme={theme}
        />
        <View style={[styles.momentumDivider, { backgroundColor: theme.divider }]} />
        <Stat
          value={String(totalSessions)}
          unit="sessions"
          delta={sessionsThisWeek}
          theme={theme}
        />
        <View style={[styles.momentumDivider, { backgroundColor: theme.divider }]} />
        <Stat
          value={String(longestStreak)}
          unit="days"
          caption="longest streak"
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  scoreValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  score: {
    fontSize: 40,
    fontFamily: fonts.heavy,
    letterSpacing: -1,
  },
  scoreMax: {
    fontSize: 18,
    fontFamily: fonts.semibold,
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 50,
    borderCurve: 'continuous',
  },
  badgeLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 20,
  },
  tick: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaName: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  metaTime: {
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  momentum: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 21,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  statDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deltaLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  captionLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  momentumDivider: {
    width: 1,
    height: 34,
  },
});
