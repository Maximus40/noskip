import type { SupabaseClient } from '@supabase/supabase-js';

import type { AccountStore } from './handler.ts';

export function supabaseAccountStore(db: SupabaseClient): AccountStore {
  return {
    async handoverTeams(userId) {
      const { data, error } = await db.rpc('svc_handover_teams', { p_user: userId });
      if (error) throw new Error(error.message);
      return ((data ?? []) as { solo_team_id: string }[]).map((r) => r.solo_team_id);
    },
    async deleteTeams(teamIds) {
      const { error } = await db.from('teams').delete().in('id', teamIds);
      if (error) throw new Error(error.message);
    },
    async deleteAvatars(userId) {
      const bucket = db.storage.from('avatars');
      const { data, error } = await bucket.list(userId, { limit: 1000 });
      if (error) throw new Error(error.message);
      const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
      if (paths.length) {
        const removed = await bucket.remove(paths);
        if (removed.error) throw new Error(removed.error.message);
      }
    },
    async deleteBillingLog(userId) {
      const { error } = await db.from('rc_events').delete().eq('app_user_id', userId);
      if (error) throw new Error(error.message);
    },
    async deleteUser(userId) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}
