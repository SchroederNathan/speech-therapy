import { Mic02Icon } from '@hugeicons-pro/core-solid-rounded';
import { ShuffleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import type { FreestyleTopic } from '@/constants/topics';

const THEME = {
  light: {
    glassTint: 'rgba(255,255,255,0.45)',
    solidFallback: 'rgba(244,244,246,0.96)',
    secondary: '#77777E',
    foreground: '#111114',
    buttonTint: '#1C1C21',
    buttonSolid: '#1C1C21',
    buttonLabel: '#FFFFFF',
    shuffleBed: 'rgba(17,17,20,0.08)',
  },
  dark: {
    glassTint: 'rgba(10,10,12,0.55)',
    solidFallback: 'rgba(26,26,30,0.96)',
    secondary: '#9E9EA6',
    foreground: '#FFFFFF',
    buttonTint: '#F2F2F5',
    buttonSolid: '#F2F2F5',
    buttonLabel: '#111114',
    shuffleBed: 'rgba(255,255,255,0.10)',
  },
} as const;

export type FreestyleCardProps = {
  topic: FreestyleTopic;
  onShuffle: () => void;
  onStart: (topic: FreestyleTopic) => void;
};

/** Impromptu-mode card: suggested topic + shuffle, and a Start button.
 * DailyGoalCard's structure — card glass as an absolute sibling so the
 * button/shuffle GlassViews are never nested inside another glass. */
export function FreestyleCard({ topic, onShuffle, onStart }: FreestyleCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const handleShuffle = () => {
    Haptics.selectionAsync();
    onShuffle();
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart(topic);
  };

  const shuffleContent = (
    <HugeiconsIcon icon={ShuffleIcon} size={18} color={theme.foreground} strokeWidth={1.5} />
  );

  const buttonContent = (
    <>
      <HugeiconsIcon icon={Mic02Icon} size={20} color={theme.buttonLabel} />
      <Text style={[styles.buttonLabel, { color: theme.buttonLabel }]}>Start Speaking</Text>
    </>
  );

  return (
    <View style={styles.card}>
      {hasGlass ? (
        <GlassView
          glassEffectStyle="regular"
          style={[StyleSheet.absoluteFill, styles.cardShape, { backgroundColor: theme.glassTint }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.cardShape,
            { backgroundColor: theme.solidFallback },
          ]}
        />
      )}

      <View style={styles.topicRow}>
        <View style={styles.topicText}>
          <Text style={[styles.caption, { color: theme.secondary }]}>Suggested topic</Text>
          <Text style={[styles.title, { color: theme.foreground }]}>{topic.title}</Text>
        </View>
        <Pressable onPress={handleShuffle} hitSlop={8}>
          {hasGlass ? (
            <GlassView glassEffectStyle="regular" isInteractive style={styles.shuffle}>
              {shuffleContent}
            </GlassView>
          ) : (
            <View style={[styles.shuffle, { backgroundColor: theme.shuffleBed }]}>
              {shuffleContent}
            </View>
          )}
        </Pressable>
      </View>

      <Text style={[styles.prompt, { color: theme.secondary }]} numberOfLines={3}>
        {topic.prompt}
      </Text>

      <Pressable onPress={handleStart} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {hasGlass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={theme.buttonTint}
            style={styles.button}>
            {buttonContent}
          </GlassView>
        ) : (
          <View style={[styles.button, { backgroundColor: theme.buttonSolid }]}>
            {buttonContent}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 36,
    borderCurve: 'continuous',
  },
  cardShape: {
    borderRadius: 36,
    borderCurve: 'continuous',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topicText: {
    flex: 1,
    gap: 2,
  },
  caption: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  shuffle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 21,
    marginTop: 10,
  },
  button: {
    height: 54,
    borderRadius: 27,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  buttonLabel: {
    fontSize: 17,
    fontFamily: fonts.semibold,
  },
});
