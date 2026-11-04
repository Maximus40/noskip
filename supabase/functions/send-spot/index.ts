// send-spot: nudge a teammate who has not trained yet today. Limits live in SQL
// (3 per day per sender, 1 per day to the same person, not after their session, not on a joker).
import { adminClient, requireEnv, supabaseAuthenticator } from '../_shared/auth.ts';
import { sendPush } from '../_shared/push.ts';
import { supabaseSpotGateway } from './gateway.ts';
import { createHandler } from './handler.ts';

const url = requireEnv('SUPABASE_URL');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

Deno.serve(
  createHandler({
    authenticate: supabaseAuthenticator(url, requireEnv('SUPABASE_ANON_KEY')),
    spots: supabaseSpotGateway(adminClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))),
    push: (messages) => sendPush(fetch, messages, expoAccessToken),
  }),
);
