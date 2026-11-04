import type { SupabaseClient } from '@supabase/supabase-js';

import type { JoinResult, TeamGateway, TeamPreview } from './handler.ts';

export function supabaseTeamGateway(db: SupabaseClient): TeamGateway {
  return {
    async preview(code) {
      const { data, error } = await db.rpc('svc_team_preview', { p_code: code });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TeamPreview[];
      return rows[0] ?? null;
    },
    async join(userId, code) {
      const { data, error } = await db.rpc('svc_join_team', { p_user: userId, p_code: code });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as JoinResult[];
      if (!rows[0]) throw new Error('invalid_invite_code');
      return rows[0];
    },
  };
}
