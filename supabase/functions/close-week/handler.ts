import { z } from 'zod';

import type { CronAuthorizer } from '../_shared/cron.ts';
import { formatKg } from '../_shared/cron.ts';
import { pickSkipLines, RECENT_LINES_AVOIDED } from '../_shared/generated/skipDraw.ts';
import { SKIP_LINE_IDS } from '../_shared/generated/skipLineIds.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export type WeekSummary = {
  week_id: string;
  team_id: string;
  team_name: string;
  week_start: string;
  total_kg: number;
  skips_count: number;
  is_team_pr: boolean;
  is_record: boolean;
  machine_pseudo: string | null;
  skip_cards: { card_id: string; user_id: string; pseudo: string | null }[];
};

export type Pref = 'skip' | 'recap' | 'team_pr';

export interface WeekStore {
  dueWeek(): Promise<string>;
  teamsToClose(week: string): Promise<string[]>;
  recentLines(team: string, limit: number): Promise<string[]>;
  memberIds(team: string): Promise<string[]>;
  closeTeamWeek(
    team: string,
    week: string,
    lines: Record<string, string>,
  ): Promise<{ week_id: string; newly_closed: boolean }>;
  pending(step: 'skip' | 'recap'): Promise<string[]>;
  claim(weekId: string, step: 'skip' | 'recap'): Promise<boolean>;
  summary(weekId: string): Promise<WeekSummary | null>;
  teamTargets(team: string, pref: Pref): Promise<string[]>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authorize: CronAuthorizer;
  store: WeekStore;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
  random: () => number;
};

export const inputSchema = z
  .object({
    step: z.enum(['close', 'recap']),
    week_start: z.iso.date().optional(),
  })
  .strict();

export const skipMessage = (pseudo: string | null) =>
  `SKIP. ${pseudo ?? 'Un pote'} a choisi le canap'.`;
export const prMessage = (kg: number) =>
  `PR DE LA TEAM ! ${formatKg(kg)} kg soulevés cette semaine 🏆`;
export function recapMessage(kg: number, machine: string | null): string {
  if (!machine) return `Bilan : la team a soulevé 0 kg. Le Canap' remporte la semaine.`;
  return `Bilan : la team a soulevé ${formatKg(kg)} kg. Machine de la semaine : ${machine}.`;
}

function isMonday(iso: string): boolean {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 1;
}

export function createHandler(deps: Deps) {
  const { store } = deps;

  async function broadcast(team: string, pref: Pref, build: (to: string) => PushMessage) {
    const tokens = await store.teamTargets(team, pref);
    if (tokens.length === 0) return 0;
    const result = await deps.push(tokens.map(build));
    if (result.invalidTokens.length) await store.deleteTokens(result.invalidTokens);
    return result.sent;
  }

  async function notifySkips(weekId: string): Promise<number> {
    if (!(await store.claim(weekId, 'skip'))) return 0;
    const s = await store.summary(weekId);
    if (!s) return 0;
    let sent = 0;
    for (const card of s.skip_cards) {
      sent += await broadcast(s.team_id, 'skip', (to) => ({
        to,
        title: s.team_name,
        body: skipMessage(card.pseudo),
        sound: 'default',
        data: { type: 'skip', card_id: card.card_id, week_id: s.week_id, team_id: s.team_id },
      }));
    }
    if (s.is_team_pr) {
      sent += await broadcast(s.team_id, 'team_pr', (to) => ({
        to,
        title: s.team_name,
        body: prMessage(s.total_kg),
        sound: 'default',
        data: { type: 'team_pr', week_id: s.week_id, team_id: s.team_id },
      }));
    }
    return sent;
  }

  async function notifyRecap(weekId: string): Promise<number> {
    if (!(await store.claim(weekId, 'recap'))) return 0;
    const s = await store.summary(weekId);
    if (!s) return 0;
    return await broadcast(s.team_id, 'recap', (to) => ({
      to,
      title: s.team_name,
      body: recapMessage(s.total_kg, s.machine_pseudo),
      sound: 'default',
      data: { type: 'recap', week_id: s.week_id, team_id: s.team_id },
    }));
  }

  /** Each team is closed and notified on its own: one failure never blocks the others. */
  async function runClose(week: string) {
    const teams = await store.teamsToClose(week);
    let closed = 0;
    let failed = 0;
    for (const team of teams) {
      try {
        const [recent, members] = await Promise.all([
          store.recentLines(team, RECENT_LINES_AVOIDED),
          store.memberIds(team),
        ]);
        const drawn = pickSkipLines(SKIP_LINE_IDS, recent, members.length, deps.random);
        const lines = Object.fromEntries(members.map((id, i) => [id, drawn[i]]));
        const res = await store.closeTeamWeek(team, week, lines);
        if (res.newly_closed) closed += 1;
      } catch (err) {
        failed += 1;
        log('error', 'close-week', 'team_close_failed', {
          team,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
    let pushed = 0;
    for (const weekId of await store.pending('skip')) {
      try {
        pushed += await notifySkips(weekId);
      } catch (err) {
        log('warn', 'close-week', 'skip_notify_failed', {
          week: weekId,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
    return { week_start: week, teams: teams.length, closed, failed, pushed };
  }

  async function runRecap() {
    let pushed = 0;
    let weeks = 0;
    for (const weekId of await store.pending('recap')) {
      try {
        pushed += await notifyRecap(weekId);
        weeks += 1;
      } catch (err) {
        log('warn', 'close-week', 'recap_notify_failed', {
          week: weekId,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
    return { weeks, pushed };
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await deps.authorize(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const { step, week_start } = parsed.data;
      if (week_start && !isMonday(week_start)) throw new HttpError(400, 'invalid_week');

      if (step === 'recap') {
        const result = await runRecap();
        log('info', 'close-week', 'recap_done', result);
        return json(result);
      }
      const result = await runClose(week_start ?? (await store.dueWeek()));
      log('info', 'close-week', 'close_done', result);
      return json(result);
    } catch (err) {
      return errorResponse(err, 'close-week');
    }
  };
}
