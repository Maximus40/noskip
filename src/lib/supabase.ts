import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { env } from './env';

export type Db = SupabaseClient<Database>;

function makeClient(): Db | null {
  if (!env) return null;
  const client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  // Refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return client;
}

const client = makeClient();

export const isSupabaseConfigured = client !== null;

/** The configured client. Screens behind the root gate can rely on it. */
export function db(): Db {
  if (!client) throw new Error('Supabase is not configured (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY).');
  return client;
}
