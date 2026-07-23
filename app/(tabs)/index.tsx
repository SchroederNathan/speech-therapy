import { FireIcon, User03Icon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyGoalCard } from '@/components/daily-goal-card';
import { useMinimizeOnScroll } from '@/components/glass-tabs';
import { PassageCarousel } from '@/components/passage-carousel';
import { WeeklyProgress } from '@/components/weekly-progress';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { PASSAGES } from '@/constants/passages';

const MINUTES_GOAL = 20;
const STREAK_FLAME = '#FF9500';

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

  // Demo state until real session data exists: each "practice" adds minutes so
  // the gauge fill + numeric percent transition are visible; wraps past the goal.
  const [minutesDone, setMinutesDone] = useState(9);
  const percent = Math.round(Math.min(minutesDone / MINUTES_GOAL, 1) * 100);
  const startPractice = () => {
    setMinutesDone((m) => (m >= MINUTES_GOAL ? 3 : Math.min(m + 4, MINUTES_GOAL)));
  };

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
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>{greeting()}</Text>
        {/* GlassContainer lets the capsules merge fluidly when they get close. */}
        <GlassContainer spacing={8} style={styles.headerItems}>
          <GlassView isInteractive style={styles.streak}>
            <HugeiconsIcon icon={FireIcon} size={24} color={STREAK_FLAME} />
            <Text style={[styles.streakCount, { color: colors.foreground }]}>1</Text>
          </GlassView>
          <GlassView isInteractive style={styles.avatar}>
            <HugeiconsIcon
              icon={User03Icon}
              size={24}
              color={dark ? '#8E8E93' : '#98989E'}
            />
          </GlassView>
        </GlassContainer>
      </View>
      <WeeklyProgress todayProgress={percent / 100} />
      <DailyGoalCard percent={percent} onStartPractice={startPractice} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>For you</Text>
      <Text style={[styles.sectionSubtitle, { color: dark ? '#9E9EA6' : '#77777E' }]}>
        Sharpen your speaking with these passages
      </Text>
      <PassageCarousel
        items={PASSAGES}
        onStart={(item) => router.push(`/session/${item.id}`)}
      />
      {/* Placeholder cards keep enough scroll to exercise the tab bar minimize. */}
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card }]} />
      ))}
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
  headerItems: {
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
  card: {
    height: 96,
    borderRadius: 20,
    borderCurve: 'continuous',
    marginTop: 12,
  },
});
