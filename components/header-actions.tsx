import { FireIcon, User03Icon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { StyleSheet, Text, useColorScheme } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';

const STREAK_FLAME = '#FF9500';

/** The screen-header trailing capsules shared by Home and Practice: streak
 * flame + count, and the profile avatar. GlassContainer lets the capsules
 * merge fluidly when they get close. */
export function HeaderActions({ streak }: { streak: number }) {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? palette.dark : palette.light;

  return (
    <GlassContainer spacing={8} style={styles.row}>
      <GlassView isInteractive style={styles.streak}>
        <HugeiconsIcon icon={FireIcon} size={24} color={STREAK_FLAME} />
        <Text style={[styles.streakCount, { color: colors.foreground }]}>{streak}</Text>
      </GlassView>
      <GlassView isInteractive style={styles.avatar}>
        <HugeiconsIcon icon={User03Icon} size={24} color={dark ? '#8E8E93' : '#98989E'} />
      </GlassView>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderCurve: 'continuous',
  },
  streakCount: {
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  avatar: {
    padding: 8,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
