import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http.ts';

export type AuthedUser = { id: string };

/** Resolves the caller from the `Authorization: Bearer <jwt>` header. */
export type Authenticator = (req: Request) => Promise<AuthedUser>;

export function supabaseAuthenticator(url: string, anonKey: string): Authenticator {
  return async (req) => {
    const header = req.headers.get('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'not_authenticated');
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'not_authenticated');
    return { id: data.user.id };
  };
}

export function adminClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'server_misconfigured', `Missing env ${name}`);
  return value;
}
