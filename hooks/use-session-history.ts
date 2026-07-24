import { useMemo, useSyncExternalStore } from 'react';

import { recommend, type RecommendationSet } from '@/lib/recommendations';
import {
  skillProfile,
  streak,
  todayProgress,
  weeklyHistory,
} from '@/lib/stats';
import { getRecords, subscribe } from '@/services/session-history';
import type { SessionRecord, SkillProfile } from '@/types/history';

/** All persisted session records, oldest first; re-renders on every save. */
export function useSessionRecords(): readonly SessionRecord[] {
  return useSyncExternalStore(subscribe, getRecords);
}

export type DerivedStats = {
  streak: number;
  /** Today's goal completion, 0–1. */
  todayProgress: number;
  /** Goal-met flags for the 5 days before today (WeeklyProgress's shape). */
  weeklyHistory: boolean[];
  skillProfile: SkillProfile;
};

/** Home/Practice-facing stats derived from the record store. */
export function useDerivedStats(): DerivedStats {
  const records = useSessionRecords();
  return useMemo(() => {
    const now = Date.now();
    return {
      streak: streak(records, now),
      todayProgress: todayProgress(records, now),
      weeklyHistory: weeklyHistory(records, now),
      skillProfile: skillProfile(records),
    };
  }, [records]);
}

/** Weakest-skill content picks for the Practice tab's Recommended section. */
export function useRecommendations(): RecommendationSet {
  const records = useSessionRecords();
  return useMemo(() => recommend(records, skillProfile(records)), [records]);
}
