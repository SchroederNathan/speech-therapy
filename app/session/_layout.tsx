import { Stack } from 'expo-router/stack';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { SessionResult } from '@/types/session';

type SessionContextValue = {
  result: SessionResult | null;
  setResult: (result: SessionResult | null) => void;
  /** Bumped by the results screen's Retry; the practice screen restarts on change. */
  retryToken: number;
  bumpRetry: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSessionContext must be used inside /session routes');
  return value;
}

export default function SessionLayout() {
  const [result, setResult] = useState<SessionResult | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const bumpRetry = useCallback(() => setRetryToken((t) => t + 1), []);

  const value = useMemo(
    () => ({ result, setResult, retryToken, bumpRetry }),
    [result, retryToken, bumpRetry],
  );

  return (
    <SessionContext.Provider value={value}>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionContext.Provider>
  );
}
