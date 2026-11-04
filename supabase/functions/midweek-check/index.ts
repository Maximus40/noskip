// midweek-check: every day at 18:00 Paris, "la barre tremble" — warns players who can only
// reach their goal by training every remaining day, and their teammates (so they spot them).
// Called only by pg_cron with the `x-cron-secret` header (deployed without JWT verification).
import { adminClient, requireEnv } from '../_shared/auth.ts';
import { cronAuthorizer } from '../_shared/cron.ts';
import { sendPush } from '../_shared/push.ts';
import { cronSecretChecker } from '../close-week/store.ts';
import { createHandler } from './handler.ts';
import { supabaseShakyStore } from './store.ts';

const db = adminClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authorize: cronAuthorizer(cronSecretChecker(db)),
    store: supabaseShakyStore(db),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
  }),
);
