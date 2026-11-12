import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { db } from '@/lib/supabase';

import {
  loadPlans,
  manageSubscription,
  type PlanOption,
  purchase,
  restore,
  revenueCatHasPro,
  revenueCatKey,
} from './revenuecat';

export type Entitlement = {
  active: boolean;
  source: 'individual' | 'duo' | 'team' | null;
  expiresAt: string | null;
  offeredBy: string | null;
  teamName: string | null;
  isPayer: boolean;
};

export const entitlementKey = (uid: string) => ['entitlement', uid] as const;
export const proKey = (uid: string) => ['pro', uid] as const;

/** Development builds only: lets you test the app before RevenueCat is set up. */
const DEV_BYPASS_KEY = 'noskip.dev.pro-bypass';

export async function setDevProBypass(on: boolean): Promise<void> {
  if (!__DEV__) return;
  if (on) await AsyncStorage.setItem(DEV_BYPASS_KEY, '1');
  else await AsyncStorage.removeItem(DEV_BYPASS_KEY);
}

async function devBypass(): Promise<boolean> {
  if (!__DEV__) return false;
  return (await AsyncStorage.getItem(DEV_BYPASS_KEY)) === '1';
}

export const paymentsAvailable = () => revenueCatKey() !== null;

async function fetchEntitlement(): Promise<Entitlement> {
  const { data, error } = await db().rpc('my_entitlement');
  if (error) throw error;
  const row = data?.[0];
  return {
    active: row?.active ?? false,
    source: row?.source ?? null,
    expiresAt: row?.expires_at ?? null,
    offeredBy: row?.offered_by ?? null,
    teamName: row?.team_name ?? null,
    isPayer: row?.is_payer ?? false,
  };
}

/** Server view of my plan (own, covered by a paying teammate, or a team's plan). */
export function useEntitlement() {
  const uid = useUserId();
  return useQuery({ queryKey: entitlementKey(uid), queryFn: fetchEntitlement });
}

/**
 * Pro access: the server (webhook-synced) is the source of truth; right after a purchase the
 * store receipt (RevenueCat) unlocks immediately, before the webhook lands.
 */
export function useHasPro() {
  const uid = useUserId();
  return useQuery({
    queryKey: proKey(uid),
    queryFn: async () => {
      if ((await fetchEntitlement()).active) return true;
      try {
        if (await revenueCatHasPro(uid)) return true;
      } catch {
        // Store unreachable: fall back to the server answer.
      }
      return devBypass();
    },
  });
}

export function usePlans() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['plans', uid],
    enabled: paymentsAvailable(),
    staleTime: 10 * 60_000,
    queryFn: () => loadPlans(uid),
  });
}

/** The store confirms a purchase before RevenueCat's webhook reaches the server: re-read later. */
export const WEBHOOK_FOLLOW_UPS_MS = [3_000, 8_000, 20_000] as const;

function useRefreshAccess() {
  const uid = useUserId();
  const qc = useQueryClient();
  return () => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: proKey(uid) });
      qc.invalidateQueries({ queryKey: entitlementKey(uid) });
    };
    refresh();
    for (const ms of WEBHOOK_FOLLOW_UPS_MS) setTimeout(refresh, ms);
  };
}

export function usePurchase() {
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (input: { option: PlanOption; teamId?: string | null }) =>
      purchase(input.option, { teamId: input.teamId }),
    onSuccess: refresh,
  });
}

export function useRestore() {
  const uid = useUserId();
  const refresh = useRefreshAccess();
  return useMutation({ mutationFn: () => restore(uid), onSuccess: refresh });
}

/** "Gérer mon abonnement": the store's page for this player's subscription. */
export function useManageSubscription() {
  const uid = useUserId();
  return () => manageSubscription(uid);
}
