import { z } from 'zod';

import type { CronAuthorizer } from '../_shared/cron.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export interface GymChangeStore {
  info(userId: string): Promise<{ pseudo: string | null; changed_at: string | null } | null>;
  teammateTargets(userId: string): Promise<{ token: string; team_id: string }[]>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authorize: CronAuthorizer;
  store: GymChangeStore;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
};

export const inputSchema = z
  .object({ user_id: z.uuid(), changed_at: z.string().min(10).max(40) })
  .strict();

/** Never names the gym: teammates never learn where a player trains. */
export function gymChangeMessage(pseudo: string | null): string {
  return `${pseudo ?? 'Un pote'} a changé de salle principale. Prochain changement possible dans 30 jours.`;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await deps.authorize(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const { user_id, changed_at } = parsed.data;

      // Only the latest change is announced (a stale or replayed call does nothing).
      const info = await deps.store.info(user_id);
      if (!info?.changed_at || Date.parse(info.changed_at) !== Date.parse(changed_at)) {
        log('info', 'notify-gym-change', 'stale');
        return json({ sent: 0, skipped: 'stale' });
      }

      const targets = await deps.store.teammateTargets(user_id);
      let sent = 0;
      if (targets.length) {
        const result = await deps.push(
          targets.map((t) => ({
            to: t.token,
            body: gymChangeMessage(info.pseudo),
            sound: 'default',
            data: { type: 'gym_change', user_id, team_id: t.team_id },
          })),
        );
        sent = result.sent;
        if (result.invalidTokens.length) await deps.store.deleteTokens(result.invalidTokens);
      }
      log('info', 'notify-gym-change', 'done', { sent });
      return json({ sent });
    } catch (err) {
      return errorResponse(err, 'notify-gym-change');
    }
  };
}
