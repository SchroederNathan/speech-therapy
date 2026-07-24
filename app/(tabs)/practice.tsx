import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinimizeOnScroll } from '@/components/glass-tabs';
import { HeaderActions } from '@/components/header-actions';
import { PassageCarousel } from '@/components/passage-carousel';
import { DrillCard } from '@/components/practice/drill-card';
import { FreestyleCard } from '@/components/practice/freestyle-card';
import { AddPassageRow, PassageRow } from '@/components/practice/passage-row';
import { SectionHeader } from '@/components/practice/section-header';
import { IntroReveal } from '@/components/splash';
import { palette } from '@/constants/colors';
import { DRILLS } from '@/constants/drills';
import { fonts } from '@/constants/fonts';
import { PASSAGES } from '@/constants/passages';
import { randomTopic, TOPICS, type FreestyleTopic } from '@/constants/topics';
import { useCustomPassages } from '@/hooks/use-custom-passages';
import { useDerivedStats, useRecommendations } from '@/hooks/use-session-history';
import {
  FREESTYLE_ID_PREFIX,
  freestyleTopicIdFrom,
} from '@/lib/recommendations';
import { removePassage } from '@/services/user-passages';
import type { Passage, PassageCategory } from '@/types/session';

const CATEGORY_TITLES: Partial<Record<PassageCategory, string>> = {
  stories: 'Stories',
  news: 'News',
  narration: 'Narration',
  poetry: 'Poetry',
  twisters: 'Tongue Twisters',
};

const DEFAULT_RECOMMEND_SUBTITLE = 'Picks that adapt as you practice';

function openContent(item: { id: string }) {
  if (item.id.startsWith(FREESTYLE_ID_PREFIX)) {
    router.push(`/session/freestyle?topicId=${freestyleTopicIdFrom(item.id)}`);
  } else {
    router.push(`/session/${item.id}`);
  }
}

export default function PracticeScreen() {
  const onScroll = useMinimizeOnScroll();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? palette.dark : palette.light;

  const recommendations = useRecommendations();
  const customPassages = useCustomPassages();
  const stats = useDerivedStats();
  const [topic, setTopic] = useState<FreestyleTopic>(TOPICS[0]);

  const shuffleTopic = useCallback(() => {
    setTopic((current) => randomTopic(current.id));
  }, []);

  const startFreestyle = useCallback((t: FreestyleTopic) => {
    router.push(`/session/freestyle?topicId=${t.id}`);
  }, []);

  const confirmDeleteCustom = useCallback((passage: Passage) => {
    Alert.alert('Delete passage?', `“${passage.title}” will be removed from your library.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removePassage(passage.id) },
    ]);
  }, []);

  // Library groups: built-ins by category, in a stable order.
  const groups = (Object.keys(CATEGORY_TITLES) as PassageCategory[])
    .map((category) => ({
      category,
      title: CATEGORY_TITLES[category]!,
      passages: PASSAGES.filter((p) => p.category === category),
    }))
    .filter((g) => g.passages.length > 0);

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}>
      {/* Same header composition as Home: title left, streak + avatar right
          (glass capsules → transform-only reveal). */}
      <View style={styles.header}>
        <IntroReveal order={0}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Practice</Text>
        </IntroReveal>
        <IntroReveal order={0} fade={false}>
          <HeaderActions streak={stats.streak} />
        </IntroReveal>
      </View>

      {/* Recommended: real-data picks; glass cards → transform-only reveal. */}
      <IntroReveal order={1}>
        <SectionHeader
          title="For you"
          subtitle={recommendations.reason ?? DEFAULT_RECOMMEND_SUBTITLE}
        />
      </IntroReveal>
      <IntroReveal order={2} fade={false}>
        <PassageCarousel items={recommendations.items} onStart={openContent} />
      </IntroReveal>

      {/* Drills */}
      <IntroReveal order={3}>
        <SectionHeader title="Drills" subtitle="One-minute workouts for a single skill" />
      </IntroReveal>
      <IntroReveal order={4} fade={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.drillsRow}
          contentContainerStyle={styles.drillsContent}>
          {DRILLS.map((drill) => (
            <DrillCard key={drill.id} drill={drill} onStart={openContent} />
          ))}
        </ScrollView>
      </IntroReveal>

      {/* Freestyle */}
      <IntroReveal order={5}>
        <SectionHeader
          title="Freestyle"
          subtitle="No script. Speak off the cuff and see your words live"
        />
      </IntroReveal>
      <IntroReveal order={6} fade={false}>
        <View style={styles.sectionBody}>
          <FreestyleCard topic={topic} onShuffle={shuffleTopic} onStart={startFreestyle} />
        </View>
      </IntroReveal>

      {/* Library */}
      <IntroReveal order={7}>
        <SectionHeader title="Your passages" subtitle="Practice your own words" />
      </IntroReveal>
      <IntroReveal order={8} fade={false}>
        <View>
          {customPassages.map((passage) => (
            <PassageRow
              key={passage.id}
              passage={passage}
              onPress={openContent}
              onLongPress={confirmDeleteCustom}
            />
          ))}
          <AddPassageRow onPress={() => router.push('/passage-editor')} />
        </View>
      </IntroReveal>

      {groups.map((group) => (
        <IntroReveal key={group.category} order={9} fade={false}>
          <SectionHeader title={group.title} />
          {group.passages.map((passage) => (
            <PassageRow key={passage.id} passage={passage} onPress={openContent} />
          ))}
        </IntroReveal>
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 34,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  drillsRow: {
    marginHorizontal: -20,
    marginTop: 8,
    // The interactive glass press response grows past the card bounds; the
    // scroll view must not clip it (same finding as PassageCarousel).
    overflow: 'visible',
  },
  drillsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionBody: {
    marginTop: 8,
  },
});
