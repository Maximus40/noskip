import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { db, isSupabaseConfigured } from '@/lib/supabase';

type AuthState = { session: Session | null; loading: boolean; configured: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true, configured: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: isSupabaseConfigured,
    configured: isSupabaseConfigured,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = db();
    client.auth
      .getSession()
      .then(({ data }) => setState((s) => ({ ...s, session: data.session, loading: false })))
      .catch(() => setState((s) => ({ ...s, loading: false })));
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setState((s) => ({ ...s, session, loading: false }));
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Current user id; only call below the auth gate. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId called without a session');
  return session.user.id;
}
