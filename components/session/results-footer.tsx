import { Rotate01Icon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHROME_BLUR_BLEED, ProgressiveBlur } from '@/components/glass-tabs';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';

const PILL_HEIGHT = 60;

export type ResultsFooterProps = {
  onRetry: () => void;
  onDone: () => void;
};

/** Floating Retry (light glass) / Done (dark) pills over a bottom
 * progressive blur so results scroll away beneath them. */
export function ResultsFooter({ onRetry, onDone }: ResultsFooterProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const foreground = palette[scheme].foreground;
  const hasGlass = isLiquidGlassAvailable();

  const retryContent = (
    <>
      <HugeiconsIcon icon={Rotate01Icon} size={20} color={foreground} strokeWidth={1.8} />
      <Text style={[styles.pillLabel, { color: foreground }]}>Retry</Text>
    </>
  );

  const doneContent = (
    <>
      <HugeiconsIcon icon={Tick02Icon} size={20} color={colors.pillDarkText} strokeWidth={2} />
      <Text style={[styles.pillLabel, { color: colors.pillDarkText }]}>Done</Text>
    </>
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <ProgressiveBlur
        direction="bottom"
        tint={scheme}
        style={[styles.blur, { top: -CHROME_BLUR_BLEED }]}
      />
      <View style={[styles.row, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.pillWrap, pressed && !hasGlass && styles.pressed]}>
          {hasGlass ? (
            <GlassView glassEffectStyle="regular" isInteractive style={styles.pill}>
              {retryContent}
            </GlassView>
          ) : (
            <View style={[styles.pill, { backgroundColor: colors.circleButton }]}>
              {retryContent}
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.pillWrap, pressed && !hasGlass && styles.pressed]}>
          {hasGlass ? (
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              tintColor={colors.pillDark}
              style={styles.pill}>
              {doneContent}
            </GlassView>
          ) : (
            <View style={[styles.pill, { backgroundColor: colors.pillDark }]}>{doneContent}</View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  blur: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  pillWrap: {
    flex: 1,
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
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
    opacity: 0.8,
  },
});
