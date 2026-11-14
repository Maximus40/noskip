import { z } from 'zod';

import type { CronAuthorizer } from '../_shared/cron.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';

export interface OfferStore {
  /** Marks the campaign as sent and returns its text; null when already sent (replay). */
  claim(campaignId: string): Promise<{ title: string; body: string } | null>;
  /** Phones of players who turned « Nouveautés et offres » on (off by default). */
  targets(): Promise<string[]>;
  sent(campaignId: string, count: number): Promise<void>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export type Deps = {
  authorize: CronAuthorizer;
  store: OfferStore;
  push: (messages: PushMessage[]) => Promise<{ sent: number; invalidTokens: string[] }>;
};

export const inputSchema = z.object({ campaign_id: z.uuid() }).strict();

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await deps.authorize(req);
      const parsed = inputSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const { campaign_id } = parsed.data;

      const campaign = await deps.store.claim(campaign_id);
      if (!campaign) {
        log('info', 'send-offer', 'already_sent', { campaign: campaign_id });
        return json({ sent: 0, skipped: 'already_sent' });
      }
      const tokens = await deps.store.targets();
      let sent = 0;
      if (tokens.length) {
        const result = await deps.push(
          tokens.map((to) => ({
            to,
            title: campaign.title,
            body: campaign.body,
            sound: 'default',
            data: { type: 'offer', campaign_id },
          })),
        );
        sent = result.sent;
        if (result.invalidTokens.length) await deps.store.deleteTokens(result.invalidTokens);
      }
      await deps.store.sent(campaign_id, sent);
      log('info', 'send-offer', 'done', { campaign: campaign_id, sent });
      return json({ sent });
    } catch (err) {
      return errorResponse(err, 'send-offer');
    }
  };
}
