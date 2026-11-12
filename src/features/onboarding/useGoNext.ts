import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';

/** Data the onboarding gate (src/app/index.tsx) reads to pick the next step. */
const GATE_KEYS = new Set(['profile', 'my-gyms', 'my-teams', 'pro', 'local-onboarding']);

/**
 * Ends an onboarding step: reloads what the gate reads, then goes back to it. Without the
 * reload, the gate could decide on the cached state from before the step and show it again.
 */
export function useGoNext() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    // At most 3 s: a failing query would otherwise hold the step through its retries; the
    // gate still waits for fresh data on its side.
    await Promise.race([
      queryClient
        .refetchQueries({ predicate: (q) => GATE_KEYS.has(String(q.queryKey[0])) })
        .catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    router.replace('/');
  }, [queryClient]);
}
