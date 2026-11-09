import type { SupabaseClient } from '@supabase/supabase-js';

import type { GymChangeStore } from './handler.ts';

async function call<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function supabaseGymChangeStore(db: SupabaseClient): GymChangeStore {
  return {
    info: async (userId) =>
      (
        await call<{ pseudo: string | null; changed_at: string | null }[]>(
          db,
          'svc_gym_change_info',
          { p_user: userId },
        )
      )[0] ?? null,
    teammateTargets: (userId) =>
      call<{ token: string; team_id: string }[]>(db, 'svc_teammate_push_targets', {
        p_user: userId,
        p_pref: 'gym_change',
      }),
    deleteTokens: async (tokens) => {
      await call(db, 'svc_delete_push_tokens', { p_tokens: tokens });
    },
  };
}

export function cronSecretChecker(db: SupabaseClient) {
  return (secret: string) => call<boolean>(db, 'svc_cron_secret_ok', { p_secret: secret });
}
