import { PauseIcon, PlayIcon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import { useResultPlayback } from '@/hooks/use-result-playback';
import { formatClock } from '@/lib/metrics';
import { sessionColors } from '@/constants/session-theme';
import type { SessionResult } from '@/types/session';

const SECONDARY = { light: '#77777E', dark: '#9E9EA6' } as const;
const PLAY_SIZE = 44;
const BAR_MAX = 26;
const BAR_MIN = 6;

export type PlaybackPillProps = {
  result: SessionResult;
};

/** Recording playback: black play circle, the result's static waveform (bars
 * tint as the playhead passes them), and the clock. */
export function PlaybackPill({ result }: PlaybackPillProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const secondary = SECONDARY[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const playback = useResultPlayback(result.audioUri, result.durationMs);

  const playedBars =
    result.durationMs > 0
      ? Math.floor((playback.positionMs / result.durationMs) * result.waveform.length)
      : 0;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playback.toggle();
  };

  const body = (
    <>
      <Pressable
        onPress={handleToggle}
        hitSlop={8}
        style={({ pressed }) => [
          styles.playCircle,
          { backgroundColor: colors.pillDark },
          pressed && { opacity: 0.8 },
        ]}>
        <HugeiconsIcon
          icon={playback.isPlaying ? PauseIcon : PlayIcon}
          size={18}
          color={colors.pillDarkText}
          // Optical centering: the triangle reads left-heavy in a circle.
          style={playback.isPlaying ? undefined : { marginLeft: 2 }}
        />
      </Pressable>

      <View style={styles.waveform}>
        {result.waveform.map((v, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: BAR_MIN + v * (BAR_MAX - BAR_MIN),
                backgroundColor: i < playedBars ? colors.accent : colors.waveformBar,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.clock, { color: secondary }]}>
        {formatClock(playback.isPlaying ? playback.positionMs : result.durationMs)}
      </Text>
    </>
  );

  return (
    <View style={styles.wrap}>
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
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 72,
    borderRadius: 36,
    borderCurve: 'continuous',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 14,
  },
  shape: {
    borderRadius: 36,
    borderCurve: 'continuous',
  },
  playCircle: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    height: BAR_MAX + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
  clock: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    fontVariant: ['tabular-nums'],
  },
});
