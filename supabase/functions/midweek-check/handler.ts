import { z } from 'zod';

import type { CronAuthorizer } from '../_shared/cron.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export type ShakyPlayer = {
  user_id: string;
  pseudo: string | null;
  days_left: number;
  missing: number;
};

export interface ShakyStore {
  /** Claims today's alerts (one per player per Paris day); nothing before 18:00 unless forced. */
  claim(force: boolean): Promise<ShakyPlayer[]>;
  selfTargets(userId: string): Promise<string[]>;
  teammateTargets(userId: string): Promise<{ token: string; team_id: string }[]>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authorize: CronAuthorizer;
  store: ShakyStore;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
};

export const inputSchema = z.object({ force: z.boolean().optional() }).strict();

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function selfMessage(daysLeft: number, missing: number): string {
  return `Il te reste ${plural(daysLeft, 'jour')} pour charger ${plural(missing, 'disque')}. Le Canap' te chauffe déjà la place.`;
}

export function teammateMessage(pseudo: string | null): string {
  return `${pseudo ?? 'Un pote'} risque le skip. Spotte-le !`;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await deps.authorize(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');

      const players = await deps.store.claim(parsed.data.force ?? false);
      const messages: PushMessage[] = [];
      for (const p of players) {
        try {
          const [self, mates] = await Promise.all([
            deps.store.selfTargets(p.user_id),
            deps.store.teammateTargets(p.user_id),
          ]);
          for (const to of self) {
            messages.push({
              to,
              body: selfMessage(p.days_left, p.missing),
              sound: 'default',
              data: { type: 'shaky_self' },
            });
          }
          for (const m of mates) {
            messages.push({
              to: m.token,
              body: teammateMessage(p.pseudo),
              sound: 'default',
              data: { type: 'shaky', user_id: p.user_id, team_id: m.team_id },
            });
          }
        } catch (err) {
          log('warn', 'midweek-check', 'targets_failed', {
            message: err instanceof Error ? err.message : 'unknown',
          });
        }
      }

      let sent = 0;
      if (messages.length) {
        const result = await deps.push(messages);
        sent = result.sent;
        if (result.invalidTokens.length) await deps.store.deleteTokens(result.invalidTokens);
      }
      log('info', 'midweek-check', 'done', { shaky: players.length, sent });
      return json({ shaky: players.length, sent });
    } catch (err) {
      return errorResponse(err, 'midweek-check');
    }
  };
}
