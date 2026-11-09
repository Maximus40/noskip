// delete-account: deletes the signed-in player and all their data (App Store requirement).
// Teams they own go to the oldest remaining member; teams where they are alone are deleted.
// Store subscriptions are not cancelled here (only the player can, in their store account).
import { adminClient, requireEnv, supabaseAuthenticator } from '../_shared/auth.ts';
import { createHandler } from './handler.ts';
import { supabaseAccountStore } from './store.ts';

const url = requireEnv('SUPABASE_URL');

Deno.serve(
  createHandler({
    authenticate: supabaseAuthenticator(url, requireEnv('SUPABASE_ANON_KEY')),
    store: supabaseAccountStore(adminClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))),
  }),
);
