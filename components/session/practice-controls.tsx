import { PauseIcon, PlayIcon, StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Rotate01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';

import { CHROME_BLUR_BLEED, ProgressiveBlur } from '@/components/glass-tabs';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';
import type { PracticeError, PracticeStatus } from '@/types/session';

import { LiveWaveform } from './live-waveform';

const SECONDARY = { light: '#77777E', dark: '#9E9EA6' } as const;
const CIRCLE = 56;

export type PracticeControlsProps = {
  status: PracticeStatus;
  error: PracticeError | null;
  elapsedMs: number;
  meterLevel: SharedValue<number>;
  onPauseToggle: () => void;
  onRestart: () => void;
  onStop: () => void;
  onErrorDismiss: () => void;
};

/** Floating glass control card: waveform + timer row over a
 * `[restart] [Pause ↔ Resume] [stop]` row. Swaps to a message + actions
 * layout when the session errors. */
export function PracticeControls({
  status,
  error,
  elapsedMs,
  meterLevel,
  onPauseToggle,
  onRestart,
  onStop,
  onErrorDismiss,
}: PracticeControlsProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const foreground = palette[scheme].foreground;
  const secondary = SECONDARY[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const processing = status === 'processing';
  const paused = status === 'paused';

  const pillContent = processing ? (
    <>
      <ActivityIndicator size="small" color={colors.pillDarkText} />
      <Text style={[styles.pillLabel, { color: colors.pillDarkText }]}>Scoring…</Text>
    </>
  ) : (
    <>
      <HugeiconsIcon
        icon={paused ? PlayIcon : PauseIcon}
        size={20}
        color={colors.pillDarkText}
      />
      <Text style={[styles.pillLabel, { color: colors.pillDarkText }]}>
        {paused ? 'Resume' : 'Pause'}
      </Text>
    </>
  );

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <ProgressiveBlur
        direction="bottom"
        tint={scheme}
        style={[
          styles.blur,
          {
            top: -CHROME_BLUR_BLEED,
            bottom: -(insets.bottom + 8),
          },
        ]}
      />
      <View style={styles.card}>
        {/* Glass as an absolute sibling under the content — the solid buttons
            inside are never nested in another glass effect. */}
        {hasGlass ? (
          <GlassView
            glassEffectStyle="regular"
            style={[StyleSheet.absoluteFill, styles.cardShape, { backgroundColor: colors.controlCard }]}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.cardShape,
              { backgroundColor: colors.controlCardSolid },
            ]}
          />
        )}

        {status === 'error' ? (
          <View style={styles.errorWrap}>
            <Text style={[styles.errorTitle, { color: foreground }]}>Something went wrong</Text>
            <Text style={[styles.errorMessage, { color: secondary }]}>
              {error?.message ?? 'Speech recognition is unavailable right now.'}
            </Text>
            <View style={styles.controlsRow}>
              <Pressable
                onPress={onErrorDismiss}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: colors.circleButton },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.pillLabel, { color: foreground }]}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={onRestart}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: colors.pillDark },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.pillLabel, { color: colors.pillDarkText }]}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <LiveWaveform
              meterLevel={meterLevel}
              elapsedMs={elapsedMs}
              barColor={colors.waveformBar}
              timerColor={foreground}
            />
            <View style={styles.controlsRow}>
              <Pressable
                onPress={onRestart}
                disabled={processing}
                style={({ pressed }) => [
                  styles.circle,
                  { backgroundColor: colors.circleButton },
                  (pressed || processing) && styles.pressed,
                ]}>
                <HugeiconsIcon icon={Rotate01Icon} size={24} color={foreground} strokeWidth={1.8} />
              </Pressable>

              <Pressable
                onPress={onPauseToggle}
                disabled={processing}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: colors.pillDark },
                  pressed && !processing && styles.pressed,
                ]}>
                {pillContent}
              </Pressable>

              <Pressable
                onPress={onStop}
                disabled={processing}
                style={({ pressed }) => [
                  styles.circle,
                  { backgroundColor: colors.circleButton },
                  (pressed || processing) && styles.pressed,
                ]}>
                <HugeiconsIcon icon={StopIcon} size={22} color={foreground} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  blur: {
    position: 'absolute',
    left: -12,
    right: -12,
  },
  card: {
    padding: 16,
    borderRadius: 40,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardShape: {
    borderRadius: 40,
    borderCurve: 'continuous',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pillLabel: {
    fontSize: 17,
    fontFamily: fonts.semibold,
  },
  pressed: {
    opacity: 0.75,
  },
  errorWrap: {
    alignItems: 'center',
    paddingTop: 6,
  },
  errorTitle: {
    fontSize: 17,
    fontFamily: fonts.semibold,
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
});
