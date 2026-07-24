import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AnimatedDashedBorder } from '@/components/animated-dashed-border';
import { fonts } from '@/constants/fonts';
import { SKILL_LABELS } from '@/constants/skills';
import type { Passage } from '@/types/session';

const THUMB_SIZE = 56;
const THUMB_RADIUS = 18;

const THEME = {
  light: {
    glassTint: 'rgba(255,255,255,0.45)',
    solidFallback: 'rgba(244,244,246,0.96)',
    secondary: '#77777E',
    foreground: '#111114',
    dashed: 'rgba(17,17,20,0.25)',
  },
  dark: {
    glassTint: 'rgba(10,10,12,0.55)',
    solidFallback: 'rgba(26,26,30,0.96)',
    secondary: '#9E9EA6',
    foreground: '#FFFFFF',
    dashed: 'rgba(255,255,255,0.28)',
  },
} as const;

/** Small square of the passage's card artwork (same gradient technique as
 * PassageCard, minus the text-legibility bed). */
function ArtworkThumb({ artwork }: { artwork: Passage['artwork'] }) {
  return (
    <View style={styles.thumb}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `linear-gradient(to bottom, ${artwork.base[0]} 0%, ${artwork.base[1]} 100%)`,
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `radial-gradient(ellipse ${THUMB_SIZE}px ${THUMB_SIZE}px at 100% 0%, ${artwork.blob[0]} 0%, ${artwork.blob[1]} 40%, transparent 100%)`,
          },
        ]}
      />
    </View>
  );
}

export type PassageRowProps = {
  passage: Passage;
  onPress: (passage: Passage) => void;
  onLongPress?: (passage: Passage) => void;
};

/** Library list row: artwork thumb, title, duration + skill chips. The whole
 * row is the pressable glass (content inside, per the PassageCard finding). */
export function PassageRow({ passage, onPress, onLongPress }: PassageRowProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const skills = (passage.skills ?? []).map((s) => SKILL_LABELS[s]).join(' · ');

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(passage);
  };

  const body = (
    <>
      <ArtworkThumb artwork={passage.artwork} />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
          {passage.title}
        </Text>
        <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={1}>
          {passage.duration}
          {skills.length > 0 ? `  ·  ${skills}` : ''}
        </Text>
      </View>
    </>
  );

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress ? () => onLongPress(passage) : undefined}>
      {hasGlass ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          style={[styles.row, { backgroundColor: theme.glassTint }]}>
          {body}
        </GlassView>
      ) : (
        <View style={[styles.row, { backgroundColor: theme.solidFallback }]}>{body}</View>
      )}
    </Pressable>
  );
}

/** Dashed "add your own" row that opens the passage editor. */
export function AddPassageRow({ onPress }: { onPress: () => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <AnimatedDashedBorder
        style={styles.addBorder}
        borderRadius={26}
        strokeColor={theme.dashed}
        strokeWidth={1.5}
        dashLength={5}
        gapLength={5}>
        <View style={styles.addRow}>
          <View style={[styles.thumb, styles.addThumb, { borderColor: theme.dashed }]}>
            <HugeiconsIcon
              icon={PlusSignIcon}
              size={22}
              color={theme.secondary}
              strokeWidth={1.5}
            />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: theme.foreground }]}>Add your own</Text>
            <Text style={[styles.meta, { color: theme.secondary }]}>
              Paste any text, speech, or transcript
            </Text>
          </View>
        </View>
      </AnimatedDashedBorder>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 26,
    borderCurve: 'continuous',
    marginTop: 12,
  },
  addBorder: {
    marginTop: 12,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  addThumb: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 13,
    fontFamily: fonts.regular,
  },
});
