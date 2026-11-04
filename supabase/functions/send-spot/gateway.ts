import type { SupabaseClient } from '@supabase/supabase-js';

import type { SpotGateway, SpotResult } from './handler.ts';

export function supabaseSpotGateway(db: SupabaseClient): SpotGateway {
  return {
    async send(from, to, team) {
      const { data, error } = await db.rpc('svc_send_spot', {
        p_from: from,
        p_to: to,
        p_team: team,
      });
      if (error) throw new Error(error.message);
      const row = ((data ?? []) as SpotResult[])[0];
      if (!row) throw new Error('spot_failed');
      return row;
    },
    async targets(userId) {
      const { data, error } = await db.rpc('svc_user_push_targets', {
        p_user: userId,
        p_pref: 'spot',
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as { token: string }[]).map((r) => r.token);
    },
    async deleteTokens(tokens) {
      const { error } = await db.rpc('svc_delete_push_tokens', { p_tokens: tokens });
      if (error) throw new Error(error.message);
    },
  };
}
