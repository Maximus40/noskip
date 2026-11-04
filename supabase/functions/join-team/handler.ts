import { z } from 'zod';

import type { Authenticator } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';

export type TeamPreview = {
  team_id: string;
  name: string;
  member_count: number;
  capacity: number;
  member_pseudos: string[];
};

export type JoinResult = { team_id: string; name: string; already_member: boolean };

/** Database access, backed by the service-role RPC wrappers (see migration …000600). */
export interface TeamGateway {
  preview(code: string): Promise<TeamPreview | null>;
  join(userId: string, code: string): Promise<JoinResult>;
}

export type Deps = { authenticate: Authenticator; teams: TeamGateway };

const code = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/));

export const inputSchema = z.object({
  code,
  action: z.enum(['preview', 'join']).default('join'),
});

/** Maps database exception messages to HTTP errors with stable codes. */
export function mapDbError(message: string): HttpError | null {
  for (const [needle, status] of [
    ['invalid_invite_code', 404],
    ['team_full', 409],
    ['max_teams_reached', 409],
  ] as const) {
    if (message.includes(needle)) return new HttpError(status, needle);
  }
  return null;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const user = await deps.authenticate(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_invite_code');
      const { code, action } = parsed.data;

      if (action === 'preview') {
        const preview = await deps.teams.preview(code);
        if (!preview) throw new HttpError(404, 'invalid_invite_code');
        return json({ preview });
      }

      const result = await deps.teams.join(user.id, code);
      log('info', 'join-team', result.already_member ? 'already_member' : 'joined', {
        team: result.team_id,
      });
      return json({ team: result });
    } catch (err) {
      if (!(err instanceof HttpError) && err instanceof Error) {
        const mapped = mapDbError(err.message);
        if (mapped) return errorResponse(mapped, 'join-team');
      }
      return errorResponse(err, 'join-team');
    }
  };
}
