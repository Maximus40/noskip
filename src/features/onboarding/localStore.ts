import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { HookAnswers } from '@/domain/onboarding';

/** Device-local onboarding facts (before sign-in, or OS permission prompts already shown). */
export type LocalOnboarding = {
  hook: HookAnswers | null;
  locationAsked: boolean;
  notificationsAsked: boolean;
  /** Invite code from a link opened before the player had an account. */
  pendingInviteCode: string | null;
};

const KEY = 'noskip.onboarding.v1';
const QUERY_KEY = ['local-onboarding'] as const;
const EMPTY: LocalOnboarding = {
  hook: null,
  locationAsked: false,
  notificationsAsked: false,
  pendingInviteCode: null,
};

export async function readLocalOnboarding(): Promise<LocalOnboarding> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<LocalOnboarding>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useLocalOnboarding() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: readLocalOnboarding, staleTime: Infinity });
}

export function useUpdateLocalOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<LocalOnboarding>) => {
      const next = { ...(await readLocalOnboarding()), ...patch };
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(QUERY_KEY, next),
  });
}
