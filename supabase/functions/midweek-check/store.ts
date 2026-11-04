import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShakyPlayer, ShakyStore } from './handler.ts';

export function supabaseShakyStore(db: SupabaseClient): ShakyStore {
  return {
    async claim(force) {
      const { data, error } = await db.rpc('svc_claim_shaky_alerts', { p_force: force });
      if (error) throw new Error(error.message);
      return (data ?? []) as ShakyPlayer[];
    },
    async selfTargets(userId) {
      const { data, error } = await db.rpc('svc_user_push_targets', {
        p_user: userId,
        p_pref: 'shaky_bar',
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as { token: string }[]).map((r) => r.token);
    },
    async teammateTargets(userId) {
      const { data, error } = await db.rpc('svc_teammate_push_targets', {
        p_user: userId,
        p_pref: 'shaky_bar',
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as { token: string; team_id: string }[];
    },
    async deleteTokens(tokens) {
      const { error } = await db.rpc('svc_delete_push_tokens', { p_tokens: tokens });
      if (error) throw new Error(error.message);
    },
  };
}
