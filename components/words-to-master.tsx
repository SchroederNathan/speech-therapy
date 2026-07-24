import { PlayIcon, VolumeHighIcon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { fonts } from '@/constants/fonts';

const THEME = {
  light: {
    glassTint: 'rgba(255,255,255,0.45)',
    solidFallback: 'rgba(255,255,255,0.96)',
    foreground: '#111114',
    secondary: '#77777E',
    chipBg: '#F3F3F5',
    chipText: '#8A8A90',
    speakerBg: '#F1F1F4',
    speakerIcon: '#33333A',
    divider: 'rgba(17,17,20,0.06)',
    badgeBg: '#1C1C21',
    badgeText: '#FFFFFF',
  },
  dark: {
    glassTint: 'rgba(10,10,12,0.55)',
    solidFallback: 'rgba(26,26,30,0.96)',
    foreground: '#FFFFFF',
    secondary: '#9E9EA6',
    chipBg: 'rgba(255,255,255,0.08)',
    chipText: '#9E9EA6',
    speakerBg: 'rgba(255,255,255,0.08)',
    speakerIcon: '#D8D8DE',
    divider: 'rgba(255,255,255,0.06)',
    badgeBg: '#F2F2F5',
    badgeText: '#111114',
  },
} as const;

export type WordToMaster = { word: string; count: number };

export type WordsToMasterProps = {
  words: readonly WordToMaster[];
  onPracticeAll: () => void;
  /** Play the word's pronunciation (TTS not wired yet — haptic-only for now). */
  onSpeak?: (word: string) => void;
};

/** "Words to master" body: a frosted card whose header pairs a count summary
 * with a "Practice all" pill, over one row per trouble word (frequency chip +
 * a tap-to-hear speaker). */
export function WordsToMaster({ words, onPracticeAll, onSpeak }: WordsToMasterProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const handlePracticeAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPracticeAll();
  };

  const handleSpeak = (word: string) => {
    Haptics.selectionAsync();
    onSpeak?.(word);
  };

  const body = (
    <>
      <View style={styles.header}>
        <Text style={[styles.summary, { color: theme.secondary }]}>
          {words.length} {words.length === 1 ? 'word needs' : 'words need'} work
        </Text>
        <Pressable
          onPress={handlePracticeAll}
          style={({ pressed }) => [
            styles.practiceAll,
            { backgroundColor: theme.badgeBg },
            pressed && { opacity: 0.85 },
          ]}>
          <HugeiconsIcon icon={PlayIcon} size={13} color={theme.badgeText} />
          <Text style={[styles.practiceAllLabel, { color: theme.badgeText }]}>Practice all</Text>
        </Pressable>
      </View>

      {words.map((item, i) => (
        <Fragment key={item.word}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
          <View style={styles.row}>
            <View style={styles.wordGroup}>
              <Text style={[styles.word, { color: theme.foreground }]} numberOfLines={1}>
                {item.word}
              </Text>
              <View style={[styles.chip, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.chipLabel, { color: theme.chipText }]}>{item.count}×</Text>
              </View>
            </View>
            <Pressable
              onPress={() => handleSpeak(item.word)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.speaker,
                { backgroundColor: theme.speakerBg },
                pressed && { opacity: 0.6 },
              ]}>
              <HugeiconsIcon icon={VolumeHighIcon} size={19} color={theme.speakerIcon} />
            </Pressable>
          </View>
        </Fragment>
      ))}
    </>
  );

  return hasGlass ? (
    <GlassView glassEffectStyle="regular" style={[styles.card, { backgroundColor: theme.glassTint }]}>
      {body}
    </GlassView>
  ) : (
    <View style={[styles.card, { backgroundColor: theme.solidFallback }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  summary: {
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  practiceAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 50,
    borderCurve: 'continuous',
  },
  practiceAllLabel: {
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 10,
  },
  wordGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  word: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  chipLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  speaker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 18,
  },
});
