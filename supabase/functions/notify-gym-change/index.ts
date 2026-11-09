// notify-gym-change: tells a player's teammates that their primary gym changed (anti-cheat
// transparency, max once every 30 days). Called by a database trigger through pg_net with the
// shared `x-cron-secret` header (no JWT verification). Never mentions which gym.
import { adminClient, requireEnv } from '../_shared/auth.ts';
import { cronAuthorizer } from '../_shared/cron.ts';
import { sendPush } from '../_shared/push.ts';
import { createHandler } from './handler.ts';
import { cronSecretChecker, supabaseGymChangeStore } from './store.ts';

const db = adminClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authorize: cronAuthorizer(cronSecretChecker(db)),
    store: supabaseGymChangeStore(db),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
  }),
);
