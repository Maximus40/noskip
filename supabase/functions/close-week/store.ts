import type { SupabaseClient } from '@supabase/supabase-js';

import type { WeekStore, WeekSummary } from './handler.ts';

async function call<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function supabaseWeekStore(db: SupabaseClient): WeekStore {
  return {
    dueWeek: () => call<string>(db, 'svc_due_week'),
    teamsToClose: async (week) =>
      (await call<{ team_id: string }[]>(db, 'svc_teams_to_close', { p_week: week })).map(
        (r) => r.team_id,
      ),
    recentLines: async (team, limit) =>
      (
        await call<{ line_id: string }[]>(db, 'svc_recent_skip_lines', {
          p_team: team,
          p_limit: limit,
        })
      ).map((r) => r.line_id),
    memberIds: async (team) =>
      (await call<{ user_id: string }[]>(db, 'svc_team_member_ids', { p_team: team })).map(
        (r) => r.user_id,
      ),
    closeTeamWeek: (team, week, lines) =>
      call(db, 'svc_close_team_week', { p_team: team, p_week: week, p_lines: lines }),
    pending: async (step) =>
      (
        await call<{ week_id: string }[]>(db, 'svc_weeks_pending_notification', { p_step: step })
      ).map((r) => r.week_id),
    claim: (weekId, step) =>
      call<boolean>(db, 'svc_claim_week_notification', { p_week_id: weekId, p_step: step }),
    summary: (weekId) => call<WeekSummary | null>(db, 'svc_week_summary', { p_week_id: weekId }),
    teamTargets: async (team, pref) =>
      (
        await call<{ token: string }[]>(db, 'svc_team_push_targets', { p_team: team, p_pref: pref })
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
