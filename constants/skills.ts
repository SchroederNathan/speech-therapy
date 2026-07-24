import type { IconSvgElement } from '@hugeicons/react-native';
import {
  AudioWave01Icon,
  Chatting01Icon,
  DashboardSpeed01Icon,
  MaskTheater01Icon,
  Target01Icon,
} from '@hugeicons-pro/core-stroke-rounded';

import type { SkillKey } from '@/types/history';

/** User-facing names for the tracked skills (chips, drill cards, subtitles). */
export const SKILL_LABELS: Record<SkillKey, string> = {
  accuracy: 'Articulation',
  fluency: 'Flow',
  pace: 'Pacing',
  fillers: 'Fillers',
  intonation: 'Expression',
};

export const SKILL_ICONS: Record<SkillKey, IconSvgElement> = {
  accuracy: Target01Icon,
  fluency: AudioWave01Icon,
  pace: DashboardSpeed01Icon,
  fillers: Chatting01Icon,
  intonation: MaskTheater01Icon,
};
