/**
 * Local recommendation heuristic: the weakest skill in the EWMA profile picks
 * drills, tagged passages, and (when relevant) a freestyle topic. Pure module
 * — runs under bun for self-tests.
 */

import { DRILLS } from '@/constants/drills';
import { PASSAGES } from '@/constants/passages';
import { TOPICS, type FreestyleTopic } from '@/constants/topics';
import { SKILL_KNOWN_SAMPLES } from '@/lib/stats';
import type { SessionRecord, SkillKey, SkillProfile } from '@/types/history';
import type { Passage } from '@/types/session';

/** Pseudo-passage id namespace the Practice tab branches on to route into
 * the freestyle session instead of the teleprompter. */
export const FREESTYLE_ID_PREFIX = 'freestyle-';

export function freestyleTopicIdFrom(pseudoId: string): string {
  return pseudoId.slice(FREESTYLE_ID_PREFIX.length);
}

const FREESTYLE_ARTWORK: Passage['artwork'] = {
  base: ['rgba(240,110,50,0.92)', 'rgba(210,50,120,0.85)'],
  blob: ['rgba(255,230,150,0.92)', 'rgba(255,140,180,0.55)'],
};

/** A freestyle topic dressed as a carousel card. */
export function freestylePassageItem(topic: FreestyleTopic): Passage {
  return {
    id: `${FREESTYLE_ID_PREFIX}${topic.id}`,
    title: topic.title,
    duration: 'Impromptu',
    artwork: FREESTYLE_ARTWORK,
    text: topic.prompt,
    targetWpm: 150,
  };
}

/** Ties break toward the most actionable skill. */
const TIE_PRIORITY: SkillKey[] = ['fillers', 'pace', 'accuracy', 'fluency', 'intonation'];

const REASONS: Record<SkillKey, string> = {
  accuracy: 'Some words tripped you up recently, so drill the tricky sounds',
  fluency: 'Build smoother, steadier delivery with these',
  pace: 'Your pace drifted from target recently. These will lock it in',
  fillers: 'Trim the filler words by practicing off the cuff',
  intonation: 'Add more expression and melody to your reads',
};

export type RecommendationSet = {
  items: Passage[];
  /** Section subtitle; null on cold start (use the default copy). */
  reason: string | null;
  weakest: SkillKey | null;
};

function lastPracticedAt(records: readonly SessionRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.passageId) continue;
    map.set(r.passageId, Math.max(map.get(r.passageId) ?? 0, r.completedAt));
  }
  return map;
}

/** Stable-until-next-session topic pick (no Math.random so the card doesn't
 * reshuffle on every render). */
function suggestedTopic(records: readonly SessionRecord[]): FreestyleTopic {
  return TOPICS[records.length % TOPICS.length];
}

export function recommend(
  records: readonly SessionRecord[],
  profile: SkillProfile,
): RecommendationSet {
  const known = TIE_PRIORITY.filter((k) => profile[k].samples >= SKILL_KNOWN_SAMPLES);

  if (records.length < 3 || known.length === 0) {
    return {
      items: [
        PASSAGES.find((p) => p.id === 'epic-speech')!,
        PASSAGES.find((p) => p.id === 'tongue-twisters')!,
        DRILLS.find((d) => d.id === 'drill-minimal-pairs')!,
        freestylePassageItem(TOPICS.find((t) => t.id === 'introduce-yourself')!),
      ],
      reason: null,
      weakest: null,
    };
  }

  // argmin over known skills; TIE_PRIORITY order makes ties actionable-first.
  let weakest = known[0];
  for (const key of known) {
    if (profile[key].value < profile[weakest].value) weakest = key;
  }

  const last = lastPracticedAt(records);
  const mostRecentPassageId = [...records]
    .sort((a, b) => b.completedAt - a.completedAt)
    .find((r) => r.passageId)?.passageId;

  const byStaleness = (a: Passage, b: Passage) =>
    (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0);

  const drills = DRILLS.filter((d) => d.skills?.includes(weakest))
    .sort(byStaleness)
    .slice(0, 2);
  const passages = PASSAGES.filter(
    (p) => p.skills?.includes(weakest) && p.id !== mostRecentPassageId,
  )
    .sort(byStaleness)
    .slice(0, 2);

  const freestyle =
    weakest === 'fillers' || weakest === 'fluency'
      ? [freestylePassageItem(suggestedTopic(records))]
      : [];

  // Fillers has no tagged passages: freestyle leads, stale passages fill in.
  const items =
    weakest === 'fillers'
      ? [...freestyle, ...drills, ...[...PASSAGES].sort(byStaleness).slice(0, 2)]
      : [...drills, ...passages, ...freestyle];

  return { items: items.slice(0, 5), reason: REASONS[weakest], weakest };
}
