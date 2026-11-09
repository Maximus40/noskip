import { z } from 'zod';

import type { CronAuthorizer } from '../_shared/cron.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export type BeltType = 'belt' | 'big_canap';

export type PendingBelt = {
  team_id: string;
  team_name: string;
  month: string;
  type: BeltType;
  user_id: string;
  pseudo: string | null;
};

export interface BeltStore {
  /** Previous month once the 1st at 10:00 Paris has passed, otherwise null. */
  dueMonth(force: boolean): Promise<string | null>;
  teamsForMonth(month: string): Promise<string[]>;
  award(team: string, month: string): Promise<{ type: BeltType; user_id: string }[]>;
  pending(): Promise<PendingBelt[]>;
  claim(team: string, month: string, type: BeltType): Promise<boolean>;
  teamTargets(team: string): Promise<string[]>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authorize: CronAuthorizer;
  store: BeltStore;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
};

export const inputSchema = z
  .object({
    force: z.boolean().optional(),
    month: z.iso.date().optional(),
  })
  .strict();

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function ofMonth(isoMonth: string): string {
  const name = MONTHS[Number(isoMonth.split('-')[1]) - 1];
  return /^[aeiouyéè]/.test(name) ? `d'${name}` : `de ${name}`;
}

export function beltMessage(type: BeltType, pseudo: string | null, month: string): string {
  const who = pseudo ?? 'Un pote';
  return type === 'belt'
    ? `🥇 ${who} décroche la Ceinture ${ofMonth(month)}. Le plus régulier de la team.`
    : `Trophée Gros Canap' ${ofMonth(month)} : ${who}. Le Canap' est fier de toi.`;
}

export function createHandler(deps: Deps) {
  const { store } = deps;

  async function notify(b: PendingBelt): Promise<number> {
    if (!(await store.claim(b.team_id, b.month, b.type))) return 0;
    const tokens = await store.teamTargets(b.team_id);
    if (tokens.length === 0) return 0;
    const result = await deps.push(
      tokens.map((to) => ({
        to,
        title: b.team_name,
        body: beltMessage(b.type, b.pseudo, b.month),
        sound: 'default',
        data: { type: 'belt', belt: b.type, team_id: b.team_id, user_id: b.user_id },
      })),
    );
    if (result.invalidTokens.length) await store.deleteTokens(result.invalidTokens);
    return result.sent;
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await deps.authorize(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      if (parsed.data.month && !parsed.data.month.endsWith('-01')) {
        throw new HttpError(400, 'invalid_month');
      }

      const month = parsed.data.month ?? (await store.dueMonth(parsed.data.force ?? false));
      if (!month) {
        log('info', 'monthly-belt', 'too_early');
        return json({ skipped: 'too_early' });
      }

      let awarded = 0;
      let failed = 0;
      for (const team of await store.teamsForMonth(month)) {
        try {
          awarded += (await store.award(team, month)).length;
        } catch (err) {
          failed += 1;
          log('error', 'monthly-belt', 'award_failed', {
            team,
            message: err instanceof Error ? err.message : 'unknown',
          });
        }
      }

      let pushed = 0;
      for (const b of await store.pending()) {
        try {
          pushed += await notify(b);
        } catch (err) {
          log('warn', 'monthly-belt', 'notify_failed', {
            message: err instanceof Error ? err.message : 'unknown',
          });
        }
      }
      const result = { month, awarded, failed, pushed };
      log('info', 'monthly-belt', 'done', result);
      return json(result);
    } catch (err) {
      return errorResponse(err, 'monthly-belt');
    }
  };
}
