import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const LIGHT = require('@/assets/lottie/splash/light.json');
const DARK = require('@/assets/lottie/splash/dark.json');

/** The splash artwork inverts the scheme on purpose: light mode plays white
 * shapes on a black backdrop and vice versa. The backdrop color fills any
 * aspect-ratio gaps behind the covered composition. */
const BACKDROP = { light: '#000000', dark: '#FFFFFF' } as const;

/** The animation is 102.6 frames @60fps (~1.7s). The fallback fires if
 * onAnimationFinish never does, so the splash can't wedge the app shut. */
const FINISH_FALLBACK_MS = 2600;
/** Long enough to overlap the first few stagger slots — transform-only items
 * (glass) borrow this fade as their fade-in. */
const FADE_MS = 600;

export type SplashOverlayProps = {
  /** Fired exactly once, when the logo animation ends and the fade to the app begins. */
  onReveal: () => void;
  /** Fired once the overlay is fully transparent and can be unmounted. */
  onDone: () => void;
};

/** Full-screen Lottie splash rendered above the app. Plays once, then fades
 * out into the app background while the content intro staggers in beneath. */
export function SplashOverlay({ onReveal, onDone }: SplashOverlayProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const viewRef = useRef<LottieView>(null);
  const finishedRef = useRef(false);
  const opacity = useSharedValue(1);
  const onRevealRef = useRef(onReveal);
  const onDoneRef = useRef(onDone);
  onRevealRef.current = onReveal;
  onDoneRef.current = onDone;

  // Stable JS-thread function: the timing callback runs as a worklet, and
  // scheduleOnRN needs a host function reference (not a worklet closure).
  const handleFadeDone = useCallback(() => onDoneRef.current(), []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onRevealRef.current();
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.out(Easing.quad) },
      (done) => {
        if (done) scheduleOnRN(handleFadeDone);
      },
    );
  }, [opacity, handleFadeDone]);

  // autoPlay is unreliable on fresh mounts (same gotcha as LoadingSpinner), so
  // kick playback imperatively, and cap total splash time with a fallback.
  useEffect(() => {
    const play = setTimeout(() => viewRef.current?.play(), 32);
    const fallback = setTimeout(finish, FINISH_FALLBACK_MS);
    return () => {
      clearTimeout(play);
      clearTimeout(fallback);
    };
  }, [finish]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP[scheme] }, fadeStyle]}>
      <LottieView
        ref={viewRef}
        key={scheme}
        source={scheme === 'dark' ? DARK : LIGHT}
        autoPlay
        loop={false}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        onAnimationFinish={(isCancelled) => {
          if (!isCancelled) finish();
        }}
        onAnimationFailure={finish}
      />
    </Animated.View>
  );
}
