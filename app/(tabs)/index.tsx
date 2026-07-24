import { router } from 'expo-router';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalyticsUpIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useMemo } from 'react';

import { DailyGoalCard } from '@/components/daily-goal-card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { useMinimizeOnScroll } from '@/components/glass-tabs';
import { HeaderActions } from '@/components/header-actions';
import { PassageCarousel } from '@/components/passage-carousel';
import { ProgressCard } from '@/components/progress-card';
import { IntroReveal } from '@/components/splash';
import { WeeklyProgress } from '@/components/weekly-progress';
import { WordsToMaster } from '@/components/words-to-master';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { getPassage, PASSAGES } from '@/constants/passages';
import { useSessionRecords, useDerivedStats } from '@/hooks/use-session-history';
import { timeAgo } from '@/lib/format';
import {
  bestSession,
  scoreRating,
  topChallengingWords,
  totals,
  weekTotals,
} from '@/lib/stats';

const MODE_LABELS = { passage: 'Passage', drill: 'Drill', freestyle: 'Freestyle' } as const;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good Evening';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HomeScreen() {
  const onScroll = useMinimizeOnScroll();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? palette.dark : palette.light;

  const stats = useDerivedStats();
  const records = useSessionRecords();
  const percent = Math.round(stats.todayProgress * 100);
  const startPractice = () => router.push('/practice');

  // Progress + trouble words are derived only from real history — never demo
  // data. With nothing recorded yet, `progress` is null and the section shows
  // an empty state that says so rather than inventing numbers.
  const { progress, words } = useMemo(() => {
    const best = bestSession(records);
    if (!best) {
      return { progress: null, words: [] as { word: string; count: number }[] };
    }
    const now = Date.now();
    const t = totals(records);
    const week = weekTotals(records, now);
    return {
      progress: {
        bestScore: Math.round(t.bestOverall),
        rating: scoreRating(t.bestOverall),
        sessionLabel: getPassage(best.passageId)?.title ?? MODE_LABELS[best.mode],
        timeAgo: timeAgo(best.completedAt, now),
        totalMinutes: Math.round(t.minutes),
        minutesThisWeek: Math.round(week.minutes),
        totalSessions: t.sessions,
        sessionsThisWeek: week.sessions,
        longestStreak: t.longestStreak,
      },
      words: topChallengingWords(records, 5),
    };
  }, [records]);

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
      {/* Intro stagger: chrome (header, slot 0 with the tab bar) first, then
          the content cascades top-to-bottom. Anything holding a GlassView
          animates transform-only (fade: false) — glass breaks under animated
          opacity — and gets its fade-in from the splash overlay instead. */}
      <View style={styles.header}>
        <IntroReveal order={0}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>{greeting()}</Text>
        </IntroReveal>
        <IntroReveal order={0} fade={false}>
          <HeaderActions streak={stats.streak} />
        </IntroReveal>
      </View>
      <IntroReveal order={1}>
        <WeeklyProgress todayProgress={stats.todayProgress} history={stats.weeklyHistory} />
      </IntroReveal>
      <IntroReveal order={2} fade={false}>
        <DailyGoalCard percent={percent} onStartPractice={startPractice} />
      </IntroReveal>
      <IntroReveal order={3}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>For you</Text>
        <Text style={[styles.sectionSubtitle, { color: dark ? '#9E9EA6' : '#77777E' }]}>
          Sharpen your speaking with these passages
        </Text>
      </IntroReveal>
      <IntroReveal order={4} fade={false}>
        <PassageCarousel
          items={PASSAGES}
          onStart={(item) => router.push(`/session/${item.id}`)}
        />
      </IntroReveal>
      <IntroReveal order={5}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your progress</Text>
        <Text style={[styles.sectionSubtitle, { color: dark ? '#9E9EA6' : '#77777E' }]}>
          Everything you&apos;ve built so far
        </Text>
      </IntroReveal>
      <IntroReveal order={6} fade={false}>
        {progress ? (
          <ProgressCard {...progress} />
        ) : (
          <EmptyStateCard
            icon={AnalyticsUpIcon}
            title="No progress yet"
            subtitle="Finish your first practice session and your best score, streak, and minutes will show up here."
          />
        )}
      </IntroReveal>
      {words.length > 0 && (
        <>
          <IntroReveal order={7}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Words to master</Text>
            <Text style={[styles.sectionSubtitle, { color: dark ? '#9E9EA6' : '#77777E' }]}>
              The ones that trip you up most often
            </Text>
          </IntroReveal>
          <IntroReveal order={8} fade={false}>
            <WordsToMaster words={words} onPracticeAll={startPractice} />
          </IntroReveal>
        </>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 34,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    marginTop: 28,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    marginTop: 4,
    marginBottom: 4,
  },
});
