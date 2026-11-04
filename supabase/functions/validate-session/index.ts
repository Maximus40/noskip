// validate-session: the phone reports "I left my gym" (gym id + times, never coordinates);
// the database checks the server clock (≥ 40 min), the gym, one session per day, then the team
// is notified that a plate was loaded.
import { adminClient, requireEnv, supabaseAuthenticator } from '../_shared/auth.ts';
import { sendPush } from '../_shared/push.ts';
import { supabaseSessionGateway } from './gateway.ts';
import { createHandler } from './handler.ts';

const url = requireEnv('SUPABASE_URL');
// Comma-separated user ids allowed to use the developer demo mode. Leave unset in production.
const demoUserIds = new Set(
  (Deno.env.get('DEMO_USER_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authenticate: supabaseAuthenticator(url, requireEnv('SUPABASE_ANON_KEY')),
    sessions: supabaseSessionGateway(adminClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
    demoUserIds,
  }),
);
