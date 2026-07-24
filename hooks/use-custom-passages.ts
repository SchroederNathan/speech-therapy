import { useSyncExternalStore } from 'react';

import { getCustomPassages, subscribe } from '@/services/user-passages';
import type { CustomPassage } from '@/types/session';

/** User-authored passages, oldest first; re-renders on add/remove. */
export function useCustomPassages(): readonly CustomPassage[] {
  return useSyncExternalStore(subscribe, getCustomPassages);
}
