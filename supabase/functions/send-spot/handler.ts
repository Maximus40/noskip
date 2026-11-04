import { z } from 'zod';

import type { Authenticator } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export type SpotResult = { spot_id: string; sent_today: number; from_pseudo: string | null };

export interface SpotGateway {
  send(from: string, to: string, team: string): Promise<SpotResult>;
  targets(userId: string): Promise<string[]>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authenticate: Authenticator;
  spots: SpotGateway;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
};

export const inputSchema = z.object({ to_user: z.uuid(), team_id: z.uuid() }).strict();

const DB_ERRORS: Record<string, number> = {
  cannot_spot_self: 400,
  not_a_member: 403,
  already_trained_today: 409,
  player_has_joker: 409,
  already_spotted_today: 409,
  spot_daily_limit: 429,
};

export function spotMessage(pseudo: string | null): string {
  return `${pseudo ?? 'Un pote'} te spot : bouge à la salle !`;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const user = await deps.authenticate(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const { to_user, team_id } = parsed.data;

      let result: SpotResult;
      try {
        result = await deps.spots.send(user.id, to_user, team_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        const code = Object.keys(DB_ERRORS).find((c) => message.includes(c));
        if (code) throw new HttpError(DB_ERRORS[code], code);
        throw err;
      }

      let delivered = 0;
      try {
        const tokens = await deps.spots.targets(to_user);
        const body = spotMessage(result.from_pseudo);
        const pushed = await deps.push(
          tokens.map((to) => ({ to, body, sound: 'default', data: { type: 'spot', team_id } })),
        );
        delivered = pushed.sent;
        if (pushed.invalidTokens.length) await deps.spots.deleteTokens(pushed.invalidTokens);
      } catch (err) {
        log('warn', 'send-spot', 'notify_failed', {
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
      log('info', 'send-spot', 'spotted', { team: team_id, delivered });
      return json({
        sent_today: result.sent_today,
        remaining_today: 3 - result.sent_today,
        delivered,
      });
    } catch (err) {
      return errorResponse(err, 'send-spot');
    }
  };
}
