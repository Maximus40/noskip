import type { SupabaseClient } from '@supabase/supabase-js';

import type { OfferStore } from './handler.ts';

async function call<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function supabaseOfferStore(db: SupabaseClient): OfferStore {
  return {
    claim: async (id) =>
      (
        await call<{ title: string; body: string }[]>(db, 'svc_claim_offer', { p_campaign: id })
      )[0] ?? null,
    targets: async () =>
      (await call<{ token: string }[]>(db, 'svc_offer_push_targets')).map((r) => r.token),
    sent: async (id, count) => {
      await call(db, 'svc_offer_sent', { p_campaign: id, p_count: count });
    },
    deleteTokens: async (tokens) => {
      await call(db, 'svc_delete_push_tokens', { p_tokens: tokens });
    },
  };
}

export function cronSecretChecker(db: SupabaseClient) {
  return (secret: string) => call<boolean>(db, 'svc_cron_secret_ok', { p_secret: secret });
}
