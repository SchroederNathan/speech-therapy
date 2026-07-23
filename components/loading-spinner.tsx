import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme, View } from 'react-native';

const START = require('@/assets/lottie/loading-spinner/Start.json');
const ACTIVE = require('@/assets/lottie/loading-spinner/Active.json');
const STOP = require('@/assets/lottie/loading-spinner/Stop.json');

// The animations are authored black. For dark mode, rewrite every fill/stroke
// to white, keeping each node's alpha (the files use alpha-0 helper fills).
function tintLottie(source: object, rgb: [number, number, number]): object {
  const clone = JSON.parse(JSON.stringify(source));
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      const shape = node as { ty?: unknown; c?: { a?: number; k?: unknown[] } };
      if (
        (shape.ty === 'fl' || shape.ty === 'st') &&
        Array.isArray(shape.c?.k) &&
        typeof shape.c.k[0] === 'number'
      ) {
        shape.c.k = [...rgb, typeof shape.c.k[3] === 'number' ? shape.c.k[3] : 1];
      }
      Object.values(node).forEach(walk);
    }
  };
  walk(clone);
  return clone;
}

let whiteSources: { start: object; active: object; stop: object } | null = null;
function getSources(scheme: 'light' | 'dark') {
  if (scheme === 'light') return { start: START, active: ACTIVE, stop: STOP };
  whiteSources ??= {
    start: tintLottie(START, [1, 1, 1]),
    active: tintLottie(ACTIVE, [1, 1, 1]),
    stop: tintLottie(STOP, [1, 1, 1]),
  };
  return whiteSources;
}

// Start is 152.4 frames @60fps (~2.5s), Stop is 58.8 (~1s). The fallbacks fire
// if onAnimationFinish never does, so the spinner can't wedge a screen open.
const START_FALLBACK_MS = 3200;
const STOP_FALLBACK_MS = 1600;

type Phase = 'start' | 'active' | 'stop' | 'done';

export type LoadingSpinnerProps = {
  /** Keep true while the work is in flight; flip false to play the stop animation. */
  active: boolean;
  /** Fired exactly once, after the stop animation completes (or its fallback timer). */
  onFinish?: () => void;
  size?: number;
};

export function LoadingSpinner({ active, onFinish, size = 40 }: LoadingSpinnerProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const sources = useMemo(() => getSources(scheme), [scheme]);
  const [phase, setPhase] = useState<Phase>('start');
  const viewRef = useRef<LottieView>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // autoPlay is unreliable when a LottieView remounts (phase/theme key changes),
  // so kick playback imperatively after each mount.
  useEffect(() => {
    if (phase === 'done') return;
    const timer = setTimeout(() => viewRef.current?.play(), 32);
    return () => clearTimeout(timer);
  }, [phase, scheme]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('done');
    onFinishRef.current?.();
  }, []);

  useEffect(() => {
    if (active) {
      if (finishedRef.current) {
        finishedRef.current = false;
        setPhase('start');
      }
      return;
    }
    setPhase((current) => (current === 'start' || current === 'active' ? 'stop' : current));
  }, [active]);

  useEffect(() => {
    if (phase === 'start') {
      const timer = setTimeout(() => {
        setPhase((current) => (current === 'start' ? 'active' : current));
      }, START_FALLBACK_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'stop') {
      const timer = setTimeout(finish, STOP_FALLBACK_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, finish]);

  if (phase === 'done') return null;

  return (
    <View style={{ width: size, height: size }}>
      {phase === 'start' ? (
        <LottieView
          ref={viewRef}
          key={`start-${scheme}`}
          source={sources.start}
          autoPlay
          loop={false}
          style={{ width: size, height: size }}
          onAnimationFinish={(isCancelled) => {
            if (!isCancelled) {
              setPhase((current) => (current === 'start' ? 'active' : current));
            }
          }}
          onAnimationFailure={() =>
            setPhase((current) => (current === 'start' ? 'active' : current))
          }
        />
      ) : null}
      {phase === 'active' ? (
        <LottieView
          ref={viewRef}
          key={`active-${scheme}`}
          source={sources.active}
          autoPlay
          loop
          style={{ width: size, height: size }}
        />
      ) : null}
      {phase === 'stop' ? (
        <LottieView
          ref={viewRef}
          key={`stop-${scheme}`}
          source={sources.stop}
          autoPlay
          loop={false}
          style={{ width: size, height: size }}
          onAnimationFinish={(isCancelled) => {
            if (!isCancelled) finish();
          }}
          onAnimationFailure={finish}
        />
      ) : null}
    </View>
  );
}
