import { useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AnimatedRoundedNumber } from '@/components/animated-rounded-number';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { scoreLabel } from '@/lib/metrics';

import { TickGauge } from './tick-gauge';

/** 270° segmented gauge: opening at the bottom, filling clockwise from the
 * bottom-left tick, black fill over a 22%-alpha track. */
const TICK_COUNT = 20;
const START_ANGLE = 135;
const SWEEP = 270;
const OUTER_RADIUS = 120;
const TICK_LENGTH = 30;
const TICK_WIDTH = 9;

const FILL_DELAY_MS = 350;
const FILL_DURATION_MS = 1100;

const TRACK = {
  light: 'rgba(17,17,20,0.22)',
  dark: 'rgba(255,255,255,0.22)',
} as const;

const SECONDARY = { light: '#77777E', dark: '#9E9EA6' } as const;

export type ScoreGaugeProps = {
  /** 0–100 overall score. */
  score: number;
};

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const foreground = palette[scheme].foreground;
  const secondary = SECONDARY[scheme];

  const clamped = Math.max(0, Math.min(score, 100));
  const progress = useSharedValue(0);
  // The number counts up in sync with the tick fill (numericText rolls the
  // digits natively).
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    progress.value = withDelay(
      FILL_DELAY_MS,
      withTiming(clamped / 100, {
        duration: FILL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    const timeout = setTimeout(() => setDisplayScore(clamped), FILL_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [clamped, progress]);

  return (
    <TickGauge
      tickCount={TICK_COUNT}
      startAngle={START_ANGLE}
      sweep={SWEEP}
      outerRadius={OUTER_RADIUS}
      tickLength={TICK_LENGTH}
      tickWidth={TICK_WIDTH}
      progress={progress}
      fill={foreground}
      track={TRACK[scheme]}
      style={styles.gauge}>
      {/* Fixed-height box: SwiftUI Hosts don't self-size reliably in flex. */}
      <View style={styles.scoreBox}>
        <AnimatedRoundedNumber
          text={`${displayScore}%`}
          value={displayScore}
          color={foreground}
          fontSize={54}
          fontFamily={fonts.bold}
          weight="bold"
          duration={0.9}
        />
      </View>
      <Text style={[styles.label, { color: secondary }]}>{scoreLabel(clamped)}</Text>
    </TickGauge>
  );
}

const styles = StyleSheet.create({
  gauge: {
    alignSelf: 'center',
  },
  scoreBox: {
    height: 64,
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
});
