import { usePracticeSession as usePracticeSessionMock } from './use-practice-session.mock';
import { usePracticeSession as usePracticeSessionReal } from './use-practice-session.real';

import type { Passage, PracticeSession } from '@/types/session';

/**
 * Swap point between the mock session (UI development, Expo Go) and the real
 * speech-recognition engine. EXPO_PUBLIC_MOCK_PRACTICE is inlined at build
 * time, so the selection is a module-level constant — both implementations
 * are hooks and the chosen one is called unconditionally.
 *
 * Default: the real engine. Set EXPO_PUBLIC_MOCK_PRACTICE=1 to use the mock.
 */
const USE_MOCK = process.env.EXPO_PUBLIC_MOCK_PRACTICE === '1';

export const usePracticeSession: (passage: Passage) => PracticeSession = USE_MOCK
  ? usePracticeSessionMock
  : usePracticeSessionReal;

export { USE_MOCK };
