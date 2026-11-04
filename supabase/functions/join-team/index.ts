// join-team: preview a team from its invite code, or join it.
// Limits (4 players, 8 with the Team plan, 3 teams per player) are enforced in SQL under a row lock.
import { adminClient, requireEnv, supabaseAuthenticator } from '../_shared/auth.ts';
import { supabaseTeamGateway } from './gateway.ts';
import { createHandler } from './handler.ts';

const url = requireEnv('SUPABASE_URL');

Deno.serve(
  createHandler({
    authenticate: supabaseAuthenticator(url, requireEnv('SUPABASE_ANON_KEY')),
    teams: supabaseTeamGateway(adminClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))),
  }),
);
