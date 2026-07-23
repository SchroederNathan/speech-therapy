import { Host, Text as SwiftUIText } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import { Mic02Icon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';

/** Radial tick gauge: exactly the BOTTOM half of a ring whose centre sits at
 * the top of the card, so the ticks fan downward around the text, which sits
 * in the hollow. Angles are screen-space degrees (0° = right, 90° = down);
 * the fill runs from the horizontal middle-left tick (180° = 0%) down across
 * the bottom to the horizontal middle-right tick (0° = 100%). */
const TICK_COUNT = 15;
const START_ANGLE = 180;
const SWEEP = -180;
const OUTER_RADIUS = 128;
const TICK_LENGTH = 34;
const TICK_WIDTH = 10;
const GAUGE_SIZE = OUTER_RADIUS * 2 + TICK_WIDTH;
const GAUGE_CENTER = GAUGE_SIZE / 2;
// Ring centre (≈ the "Daily Goal" caption) measured from the card's top edge —
// close enough that the gauge sits just below the container's top.
const CENTER_Y = 20;
const WINDOW_HEIGHT = 156;

const THEME = {
  light: {
    tick: '#111114',
    track: 'rgba(17,17,20,0.14)',
    glassTint: 'rgba(255,255,255,0.45)',
    solidFallback: 'rgba(244,244,246,0.96)',
    secondary: '#77777E',
    buttonTint: '#1C1C21',
    buttonSolid: '#1C1C21',
    buttonLabel: '#FFFFFF',
  },
  dark: {
    tick: '#FFFFFF',
    track: 'rgba(255,255,255,0.16)',
    glassTint: 'rgba(10,10,12,0.55)',
    solidFallback: 'rgba(26,26,30,0.96)',
    secondary: '#9E9EA6',
    buttonTint: '#F2F2F5',
    buttonSolid: '#F2F2F5',
    buttonLabel: '#111114',
  },
} as const;

export type DailyGoalCardProps = {
  /** Goal completion, 0–100. */
  percent: number;
  onStartPractice: () => void;
};

const AnimatedLine = Animated.createAnimatedComponent(Line);

/** One gauge tick; sweeps from track to fill color as `progress` (0–1)
 * crosses its slot, so fill changes wipe across the fan. */
function Tick({
  index,
  progress,
  fill,
  track,
}: {
  index: number;
  progress: SharedValue<number>;
  fill: string;
  track: string;
}) {
  const angle = ((START_ANGLE + (SWEEP / (TICK_COUNT - 1)) * index) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const inner = OUTER_RADIUS - TICK_LENGTH;
  const animatedProps = useAnimatedProps(() => {
    const filled = interpolate(
      progress.value * TICK_COUNT - index,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { stroke: interpolateColor(filled, [0, 1], [track, fill]) };
  });
  return (
    <AnimatedLine
      x1={GAUGE_CENTER + cos * inner}
      y1={GAUGE_CENTER + sin * inner}
      x2={GAUGE_CENTER + cos * OUTER_RADIUS}
      y2={GAUGE_CENTER + sin * OUTER_RADIUS}
      strokeWidth={TICK_WIDTH}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

export function DailyGoalCard({ percent, onStartPractice }: DailyGoalCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const colors = palette[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const clamped = Math.max(0, Math.min(percent, 100));
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(clamped / 100, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, progress]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartPractice();
  };

  const buttonContent = (
    <>
      <HugeiconsIcon icon={Mic02Icon} size={22} color={theme.buttonLabel} />
      <Text style={[styles.buttonLabel, { color: theme.buttonLabel }]}>Start Practicing</Text>
    </>
  );

  return (
    <View style={styles.card}>
      {/* The card's glass sits as an absolute sibling under the content, so the
          button's own GlassView below is never nested inside another glass
          effect (nested glass doesn't render on iOS 26). */}
      {hasGlass ? (
        <GlassView
          glassEffectStyle="regular"
          style={[StyleSheet.absoluteFill, styles.cardShape, { backgroundColor: theme.glassTint }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.cardShape,
            { backgroundColor: theme.solidFallback },
          ]}
        />
      )}

      <View style={styles.gaugeWindow}>
        <Svg
          width={GAUGE_SIZE}
          height={GAUGE_SIZE}
          style={{ position: 'absolute', top: CENTER_Y - GAUGE_CENTER, alignSelf: 'center' }}>
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <Tick key={i} index={i} progress={progress} fill={theme.tick} track={theme.track} />
          ))}
        </Svg>
        <View style={styles.gaugeCenter} pointerEvents="none">
          <Text style={[styles.caption, { color: theme.secondary }]}>Daily Goal</Text>
          <Host matchContents>
            <SwiftUIText
              modifiers={[
                contentTransition('numericText'),
                animation(Animation.spring({ duration: 0.6 }), clamped),
                // SwiftUI can't use the runtime-loaded OTFs; design:'rounded'
                // resolves to the same SF Pro Rounded face natively.
                font({ size: 38, weight: 'bold', design: 'rounded' }),
                foregroundStyle(colors.foreground),
              ]}>
              {`${clamped}%`}
            </SwiftUIText>
          </Host>
        </View>
      </View>

      <Pressable onPress={handlePress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {hasGlass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={theme.buttonTint}
            style={styles.button}>
            {buttonContent}
          </GlassView>
        ) : (
          <View style={[styles.button, { backgroundColor: theme.buttonSolid }]}>
            {buttonContent}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    // The gauge window sits flush with the top edge; the card's rounded clip
    // is what cuts the ring's top arc — part of the design.
    paddingTop: 0,
    borderRadius: 42,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardShape: {
    borderRadius: 42,
    borderCurve: 'continuous',
  },
  gaugeWindow: {
    height: WINDOW_HEIGHT,
  },
  gaugeCenter: {
    position: 'absolute',
    // Anchors the caption on the ring's centre; the percent hangs below it,
    // inside the ring's hollow.
    top: CENTER_Y -4,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
  },
  caption: {
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  button: {
    height: 60,
    borderRadius: 30,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  buttonLabel: {
    fontSize: 18,
    fontFamily: fonts.semibold,
  },
});
