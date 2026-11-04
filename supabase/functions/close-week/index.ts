// close-week: closes the game week every Sunday at 20:00 Paris (pg_cron, both UTC hours) and
// sends the Sunday recap at 20:05. Idempotent: replays never duplicate cards or pushes.
// Called only by pg_cron with the `x-cron-secret` header (deployed without JWT verification).
import { adminClient, requireEnv } from '../_shared/auth.ts';
import { cronAuthorizer } from '../_shared/cron.ts';
import { sendPush } from '../_shared/push.ts';
import { createHandler } from './handler.ts';
import { cronSecretChecker, supabaseWeekStore } from './store.ts';

const db = adminClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authorize: cronAuthorizer(cronSecretChecker(db)),
    store: supabaseWeekStore(db),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
    random: Math.random,
  }),
);
