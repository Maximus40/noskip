// monthly-belt: on the 1st of the month at 10:00 Paris (pg_cron, both UTC hours), awards each
// team's Ceinture and Gros Canap' for the month that just ended, then tells the team.
// Idempotent. Called only by pg_cron with the `x-cron-secret` header (no JWT verification).
import { adminClient, requireEnv } from '../_shared/auth.ts';
import { cronAuthorizer } from '../_shared/cron.ts';
import { sendPush } from '../_shared/push.ts';
import { createHandler } from './handler.ts';
import { cronSecretChecker, supabaseBeltStore } from './store.ts';

const db = adminClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authorize: cronAuthorizer(cronSecretChecker(db)),
    store: supabaseBeltStore(db),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
  }),
);
