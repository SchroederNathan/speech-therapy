import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHROME_BLUR_BLEED, ProgressiveBlur } from '@/components/glass-tabs';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';

const BUTTON_SIZE = 44;

type CircleButtonProps = {
  onPress: () => void;
  children: ReactNode;
};

function CircleButton({ onPress, children }: CircleButtonProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const hasGlass = isLiquidGlassAvailable();

  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => !hasGlass && pressed && { opacity: 0.7 }}>
      {hasGlass ? (
        <GlassView glassEffectStyle="regular" isInteractive style={styles.circle}>
          {children}
        </GlassView>
      ) : (
        <View style={[styles.circle, { backgroundColor: colors.circleButton }]}>{children}</View>
      )}
    </Pressable>
  );
}

export type SessionTopBarProps = {
  onDismiss: () => void;
  /** Renders an "Aa" text-size button on the right when provided. */
  onTextSize?: () => void;
  /** Center slot (e.g. the live WPM header on the practice screen). */
  children?: ReactNode;
};

/** Shared session header: circular glass dismiss chevron (left), optional
 * "Aa" text-size button (right), and a centered content slot. Absolutely
 * positioned over the screen so content scrolls beneath it. */
export function SessionTopBar({ onDismiss, onTextSize, children }: SessionTopBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const foreground = palette[scheme].foreground;

  return (
    <>
      <ProgressiveBlur
        direction="top"
        tint={scheme}
        style={[
          styles.blur,
          { height: insets.top + 6 + BUTTON_SIZE + CHROME_BLUR_BLEED },
        ]}
      />
      <View style={[styles.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <CircleButton onPress={onDismiss}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={24} color={foreground} strokeWidth={2} />
        </CircleButton>

        <View style={styles.center} pointerEvents="none">
          {children}
        </View>

        {onTextSize ? (
          <CircleButton onPress={onTextSize}>
            <Text style={[styles.textSizeLabel, { color: foreground }]}>Aa</Text>
          </CircleButton>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  blur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  textSizeLabel: {
    fontSize: 17,
    fontFamily: fonts.semibold,
  },
});
