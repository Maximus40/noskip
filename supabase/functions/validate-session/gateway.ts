import type { SupabaseClient } from '@supabase/supabase-js';

import type { PushTarget, SessionGateway, Validation } from './handler.ts';

export function supabaseSessionGateway(db: SupabaseClient): SessionGateway {
  return {
    async validate(userId, gymId, endedAt, demo) {
      const { data, error } = await db.rpc('svc_validate_session', {
        p_user: userId,
        p_gym: gymId,
        p_ended_at: endedAt,
        p_demo: demo,
      });
      if (error) throw new Error(error.message);
      const row = ((data ?? []) as Validation[])[0];
      if (!row) throw new Error('no_open_session');
      return row;
    },
    async pseudo(userId) {
      const { data, error } = await db
        .from('profiles')
        .select('pseudo')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.pseudo as string | null) ?? null;
    },
    async teammateTargets(userId) {
      const { data, error } = await db.rpc('svc_teammate_push_targets', {
        p_user: userId,
        p_pref: 'plate_loaded',
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as PushTarget[];
    },
    async deleteTokens(tokens) {
      const { error } = await db.rpc('svc_delete_push_tokens', { p_tokens: tokens });
      if (error) throw new Error(error.message);
    },
  };
}
