import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiCoachingCard } from '@/components/session/ai-coaching-card';
import { MetricGrid } from '@/components/session/metric-grid';
import { PlaybackPill } from '@/components/session/playback-pill';
import { ResultsFooter } from '@/components/session/results-footer';
import { ScoreGauge } from '@/components/session/score-gauge';
import { SessionTopBar } from '@/components/session/session-top-bar';
import { TranscriptCard } from '@/components/session/transcript-card';
import { WordBreakdown } from '@/components/session/word-breakdown';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';

import { useSessionContext } from './_layout';

function dismissToHome() {
  try {
    router.dismissTo('/');
  } catch {
    router.dismissAll();
  }
}

export default function ResultsScreen() {
  const { result, bumpRetry } = useSessionContext();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const background = palette[scheme].background;

  useEffect(() => {
    if (!result) router.back();
  }, [result]);

  // Celebrate the finished session.
  useEffect(() => {
    if (result) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Fire once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bumpRetry();
    router.back();
  }, [bumpRetry]);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissToHome();
  }, []);

  if (!result) return null;

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 62,
          paddingBottom: insets.bottom + 150,
          paddingHorizontal: 20,
        }}>
        <ScoreGauge score={result.overallScore} />
        <View style={styles.playback}>
          <PlaybackPill result={result} />
        </View>
        <View style={styles.metrics}>
          <MetricGrid result={result} />
        </View>
        <View style={styles.coaching}>
          <AiCoachingCard result={result} />
        </View>
        <View style={styles.breakdown}>
          {result.mode === 'freestyle' ? (
            <TranscriptCard transcript={result.transcript ?? ''} />
          ) : (
            <WordBreakdown words={result.words} />
          )}
        </View>
      </ScrollView>

      <SessionTopBar onDismiss={handleDone}>
        <Text style={[styles.title, { color: palette[scheme].foreground }]}>
          Session Complete
        </Text>
      </SessionTopBar>
      <ResultsFooter onRetry={handleRetry} onDone={handleDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 21,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
  },
  playback: {
    marginTop: 10,
  },
  metrics: {
    marginTop: 12,
  },
  coaching: {
    marginTop: 28,
  },
  breakdown: {
    marginTop: 28,
  },
});
