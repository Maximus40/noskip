// search-gyms: finds real gyms (OSM leisure=fitness_centre) around a coarse point or by name,
// caches them in public.gyms and returns them. The caller's position is never stored.
import { adminClient, requireEnv, supabaseAuthenticator } from '../_shared/auth.ts';
import { createHandler } from './handler.ts';
import { supabaseGymStore } from './store.ts';

const url = requireEnv('SUPABASE_URL');

Deno.serve(
  createHandler({
    authenticate: supabaseAuthenticator(url, requireEnv('SUPABASE_ANON_KEY')),
    store: supabaseGymStore(adminClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))),
    fetcher: fetch,
    overpassUrl: Deno.env.get('OVERPASS_URL') ?? 'https://overpass-api.de/api/interpreter',
  }),
);
