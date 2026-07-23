import { createContext, use, useEffect, useRef } from 'react';
import type { ViewProps } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** True once the splash has ended and screen content may animate in. Defaults
 * to true so anything rendered outside the provider simply shows. */
const IntroContext = createContext(true);

export const IntroRevealProvider = IntroContext.Provider;

/** Gap between successive `order` slots. */
const STAGGER_MS = 80;
/** Head start so the splash fade is underway before the first item moves. */
const BASE_DELAY_MS = 120;
const DURATION_MS = 450;

/**
 * Animated style for the intro reveal: hidden until the splash reveal begins,
 * then fades/slides in at its stagger slot. Use directly on components that
 * can't tolerate a wrapper view (e.g. inside expo-router's TabList, whose
 * trigger parsing skips unknown wrappers); otherwise prefer `IntroReveal`.
 * Mounting after the intro already ran renders visible immediately.
 *
 * `fade: false` animates transform only. Required for anything containing a
 * GlassView — iOS glass effects break (render empty) under an ancestor whose
 * opacity is animated. Those items rely on the splash overlay's own fade-out
 * for their fade-in, and slide into place beneath it.
 */
export function useIntroRevealStyle(order: number, dy = 14, fade = true) {
  const revealed = use(IntroContext);
  const skipped = useRef(revealed).current;
  const progress = useSharedValue(skipped ? 1 : 0);

  useEffect(() => {
    if (revealed && !skipped) {
      progress.value = withDelay(
        BASE_DELAY_MS + order * STAGGER_MS,
        withTiming(1, {
          duration: DURATION_MS,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
        ReduceMotion.System,
      );
    }
  }, [revealed, skipped, order, progress]);

  return useAnimatedStyle(() => ({
    ...(fade ? { opacity: progress.value } : null),
    transform: [{ translateY: (1 - progress.value) * dy }],
  }));
}

export type IntroRevealProps = ViewProps & {
  /** Stagger slot: 0 animates first (chrome), higher orders follow top-to-bottom. */
  order: number;
  /** Slide-in distance (positive = rises from below); 0 for a pure fade. */
  dy?: number;
  /** Set false for children containing GlassViews (see useIntroRevealStyle). */
  fade?: boolean;
};

/** Wrapper view that hides its children until the splash reveal begins, then
 * fades/slides them in at their stagger slot. */
export function IntroReveal({
  order,
  dy = 14,
  fade = true,
  style,
  children,
  ...rest
}: IntroRevealProps) {
  const animatedStyle = useIntroRevealStyle(order, dy, fade);
  return (
    <Animated.View {...rest} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
