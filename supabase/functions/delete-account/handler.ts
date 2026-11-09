import { z } from 'zod';

import type { Authenticator } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';

export interface AccountStore {
  /** Hands owned teams over to the oldest member; returns teams where the player is alone. */
  handoverTeams(userId: string): Promise<string[]>;
  deleteTeams(teamIds: string[]): Promise<void>;
  /** Avatar files under avatars/<uid>/. */
  deleteAvatars(userId: string): Promise<void>;
  /** RevenueCat event log rows carrying the user id. */
  deleteBillingLog(userId: string): Promise<void>;
  /** Deletes the auth user: every table cascades from it. */
  deleteUser(userId: string): Promise<void>;
}

export type Deps = { authenticate: Authenticator; store: AccountStore };

/** The app makes the player type the word, the server checks it too. */
export const inputSchema = z.object({ confirm: z.literal('SUPPRIMER') }).strict();

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const user = await deps.authenticate(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'confirmation_required');

      const soloTeams = await deps.store.handoverTeams(user.id);
      if (soloTeams.length) await deps.store.deleteTeams(soloTeams);
      // Files and logs first: if a step fails the account still exists and the player can retry.
      await deps.store.deleteAvatars(user.id);
      await deps.store.deleteBillingLog(user.id);
      await deps.store.deleteUser(user.id);

      log('info', 'delete-account', 'deleted', { teams_deleted: soloTeams.length });
      return json({ deleted: true });
    } catch (err) {
      return errorResponse(err, 'delete-account');
    }
  };
}
