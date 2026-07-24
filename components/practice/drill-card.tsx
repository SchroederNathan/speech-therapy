import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { DRILL_META } from '@/constants/drills';
import { fonts } from '@/constants/fonts';
import { SKILL_ICONS, SKILL_LABELS } from '@/constants/skills';
import type { Passage } from '@/types/session';

const THEME = {
  light: {
    glassTint: 'rgba(255,255,255,0.45)',
    solidFallback: 'rgba(244,244,246,0.96)',
    secondary: '#77777E',
    iconBed: 'rgba(17,17,20,0.08)',
  },
  dark: {
    glassTint: 'rgba(10,10,12,0.55)',
    solidFallback: 'rgba(26,26,30,0.96)',
    secondary: '#9E9EA6',
    iconBed: 'rgba(255,255,255,0.10)',
  },
} as const;

export type DrillCardProps = {
  drill: Passage;
  onStart: (drill: Passage) => void;
};

/** Compact card for the horizontal drills row. Content lives INSIDE the
 * GlassView so the interactive press response fires (same finding as
 * PassageCard); the icon bed is a plain view — never a nested glass. */
export function DrillCard({ drill, onStart }: DrillCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();
  const meta = DRILL_META[drill.id];
  const foreground = scheme === 'dark' ? '#FFFFFF' : '#111114';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart(drill);
  };

  const body = (
    <>
      <View style={[styles.iconBed, { backgroundColor: theme.iconBed }]}>
        <HugeiconsIcon
          icon={meta ? SKILL_ICONS[meta.skill] : SKILL_ICONS.accuracy}
          size={22}
          color={foreground}
          strokeWidth={1.5}
        />
      </View>
      <Text style={[styles.title, { color: foreground }]} numberOfLines={1}>
        {drill.title}
      </Text>
      {meta != null && (
        <Text style={[styles.blurb, { color: theme.secondary }]} numberOfLines={1}>
          {meta.blurb}
        </Text>
      )}
      <Text style={[styles.meta, { color: theme.secondary }]}>
        {meta ? `${SKILL_LABELS[meta.skill]} · ` : ''}
        {drill.duration}
      </Text>
    </>
  );

  return (
    <Pressable onPress={handlePress} style={styles.item}>
      {hasGlass ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          style={[styles.card, { backgroundColor: theme.glassTint }]}>
          {body}
        </GlassView>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.solidFallback }]}>{body}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 168,
  },
  card: {
    flex: 1,
    borderRadius: 26,
    borderCurve: 'continuous',
    padding: 16,
  },
  iconBed: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
  blurb: {
    fontSize: 13,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    marginTop: 8,
  },
});
