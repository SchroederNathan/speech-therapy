import { useCallback, useEffect, useState } from 'react';

import { requestAiCoaching } from '@/services/ai-coaching';
import type {
  AiCoachingBreakdown,
  PartialAiCoachingBreakdown,
} from '@/types/ai-coaching';
import type { SessionResult } from '@/types/session';

type AiCoachingState =
  | { status: 'loading'; breakdown: null; error: null }
  | { status: 'streaming'; breakdown: PartialAiCoachingBreakdown; error: null }
  | { status: 'success'; breakdown: AiCoachingBreakdown; error: null }
  | { status: 'error'; breakdown: null; error: string };

export function useAiCoaching(result: SessionResult): AiCoachingState & {
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AiCoachingState>({
    status: 'loading',
    breakdown: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    // A stalled server (or dead dev server) never settles the fetch — abort so
    // the card always resolves to an error instead of loading forever.
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30_000);
    setState({ status: 'loading', breakdown: null, error: null });

    requestAiCoaching(result, controller.signal, (partial) => {
      if (controller.signal.aborted) return;
      setState({ status: 'streaming', breakdown: partial, error: null });
    })
      .then((breakdown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'success', breakdown, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted && !timedOut) return;
        setState({
          status: 'error',
          breakdown: null,
          error: timedOut
            ? 'AI coaching took too long to respond.'
            : error instanceof Error
              ? error.message
              : 'AI coaching is unavailable right now.',
        });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, result]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry };
}
