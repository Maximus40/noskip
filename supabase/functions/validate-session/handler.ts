import { z } from 'zod';

import type { Authenticator } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export type Validation = {
  session_id: string;
  validated_at: string;
  duration_min: number;
  week_start: string;
  done_this_week: number;
  goal: number;
  lifetime_sessions: number;
};

export type PushTarget = { user_id: string; token: string; team_id: string };

export interface SessionGateway {
  validate(userId: string, gymId: string, endedAt: string, demo: boolean): Promise<Validation>;
  pseudo(userId: string): Promise<string | null>;
  teammateTargets(userId: string): Promise<PushTarget[]>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authenticate: Authenticator;
  sessions: SessionGateway;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
  /** Demo sessions (dev mode) are accepted only for these user ids. Empty in production. */
  demoUserIds: ReadonlySet<string>;
};

// Only gym id and times leave the phone. Coordinates are rejected outright.
export const inputSchema = z
  .object({
    gym_id: z.uuid(),
    ended_at: z.iso.datetime({ offset: true }),
    started_at: z.iso.datetime({ offset: true }).optional(),
    duration_min: z.number().int().min(0).max(1440).optional(),
    demo: z.boolean().optional(),
  })
  .strict();

const DB_ERRORS: Record<string, number> = {
  session_too_short: 422,
  no_open_session: 409,
  already_validated_today: 409,
  gym_mismatch: 403,
  invalid_ended_at: 400,
};

export function plateLoadedMessage(pseudo: string | null): string {
  return `${pseudo ?? 'Un pote'} vient de charger 20 kg 💪`;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const user = await deps.authenticate(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const { gym_id, ended_at, demo = false } = parsed.data;
      if (demo && !deps.demoUserIds.has(user.id)) throw new HttpError(403, 'demo_not_allowed');

      let result: Validation;
      try {
        result = await deps.sessions.validate(user.id, gym_id, ended_at, demo);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        const code = Object.keys(DB_ERRORS).find((c) => message.includes(c));
        if (code) throw new HttpError(DB_ERRORS[code], code);
        throw err;
      }
      log('info', 'validate-session', 'validated', {
        session: result.session_id,
        duration_min: result.duration_min,
        demo,
      });

      // Tell the team. Failures here never undo the validation.
      let notified = 0;
      try {
        const [pseudo, targets] = await Promise.all([
          deps.sessions.pseudo(user.id),
          deps.sessions.teammateTargets(user.id),
        ]);
        const body = plateLoadedMessage(pseudo);
        const pushResult = await deps.push(
          targets.map((t) => ({
            to: t.token,
            body,
            sound: 'default',
            data: { type: 'plate_loaded', team_id: t.team_id },
          })),
        );
        notified = pushResult.sent;
        if (pushResult.invalidTokens.length)
          await deps.sessions.deleteTokens(pushResult.invalidTokens);
      } catch (err) {
        log('warn', 'validate-session', 'notify_failed', {
          message: err instanceof Error ? err.message : 'unknown',
        });
      }

      return json({ session: result, notified });
    } catch (err) {
      return errorResponse(err, 'validate-session');
    }
  };
}
