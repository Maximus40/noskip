// send-offer: pushes a shop offer to players who opted in to « Nouveautés et offres ».
// Called by app_private.send_offer() through pg_net with the shared `x-cron-secret` header
// (no JWT verification). Each campaign is sent once.
import { adminClient, requireEnv } from '../_shared/auth.ts';
import { cronAuthorizer } from '../_shared/cron.ts';
import { sendPush } from '../_shared/push.ts';
import { createHandler } from './handler.ts';
import { cronSecretChecker, supabaseOfferStore } from './store.ts';

const db = adminClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authorize: cronAuthorizer(cronSecretChecker(db)),
    store: supabaseOfferStore(db),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
  }),
);
