import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

/**
 * Generalized radial tick-fan gauge (the DailyGoalCard fan math, made
 * parametric). Angles are screen-space degrees: 0° = right, 90° = down.
 * `progress` (0..1) wipes each tick from track to fill color in sequence.
 */

const AnimatedLine = Animated.createAnimatedComponent(Line);

type TickProps = {
  index: number;
  tickCount: number;
  startAngle: number;
  sweep: number;
  outerRadius: number;
  tickLength: number;
  tickWidth: number;
  center: number;
  progress: SharedValue<number>;
  fill: string;
  track: string;
};

function Tick({
  index,
  tickCount,
  startAngle,
  sweep,
  outerRadius,
  tickLength,
  tickWidth,
  center,
  progress,
  fill,
  track,
}: TickProps) {
  const angle = ((startAngle + (sweep / (tickCount - 1)) * index) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const inner = outerRadius - tickLength;

  const animatedProps = useAnimatedProps(() => {
    const filled = interpolate(
      progress.value * tickCount - index,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { stroke: interpolateColor(filled, [0, 1], [track, fill]) };
  });

  return (
    <AnimatedLine
      x1={center + cos * inner}
      y1={center + sin * inner}
      x2={center + cos * outerRadius}
      y2={center + sin * outerRadius}
      strokeWidth={tickWidth}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

export type TickGaugeProps = {
  tickCount: number;
  /** Screen-space degrees (0° = right, 90° = down). */
  startAngle: number;
  /** Signed sweep in degrees; positive = clockwise on screen. */
  sweep: number;
  outerRadius: number;
  tickLength: number;
  tickWidth: number;
  /** 0..1 fill progress. */
  progress: SharedValue<number>;
  fill: string;
  track: string;
  /** Centered in the gauge's hollow. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TickGauge({
  tickCount,
  startAngle,
  sweep,
  outerRadius,
  tickLength,
  tickWidth,
  progress,
  fill,
  track,
  children,
  style,
}: TickGaugeProps) {
  const size = outerRadius * 2 + tickWidth;
  const center = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {Array.from({ length: tickCount }, (_, i) => (
          <Tick
            key={i}
            index={i}
            tickCount={tickCount}
            startAngle={startAngle}
            sweep={sweep}
            outerRadius={outerRadius}
            tickLength={tickLength}
            tickWidth={tickWidth}
            center={center}
            progress={progress}
            fill={fill}
            track={track}
          />
        ))}
      </Svg>
      {children != null && (
        <View style={styles.center} pointerEvents="none">
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
