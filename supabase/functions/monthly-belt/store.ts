import type { SupabaseClient } from '@supabase/supabase-js';

import type { BeltStore, BeltType, PendingBelt } from './handler.ts';

async function call<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function supabaseBeltStore(db: SupabaseClient): BeltStore {
  return {
    dueMonth: (force) => call<string | null>(db, 'svc_due_belt_month', { p_force: force }),
    teamsForMonth: async (month) =>
      (await call<{ team_id: string }[]>(db, 'svc_teams_for_belts', { p_month: month })).map(
        (r) => r.team_id,
      ),
    award: (team, month) =>
      call<{ type: BeltType; user_id: string }[]>(db, 'svc_award_team_belts', {
        p_team: team,
        p_month: month,
      }),
    pending: () => call<PendingBelt[]>(db, 'svc_pending_belts'),
    claim: (team, month, type) =>
      call<boolean>(db, 'svc_claim_belt_notification', {
        p_team: team,
        p_month: month,
        p_type: type,
      }),
    teamTargets: async (team) =>
      (
        await call<{ token: string }[]>(db, 'svc_team_push_targets', {
          p_team: team,
          p_pref: 'recap',
        })
      ).map((r) => r.token),
    deleteTokens: async (tokens) => {
      await call(db, 'svc_delete_push_tokens', { p_tokens: tokens });
    },
  };
}

/** Validates the pg_cron secret against app_private.cron_config. */
export function cronSecretChecker(db: SupabaseClient) {
  return (secret: string) => call<boolean>(db, 'svc_cron_secret_ok', { p_secret: secret });
}
