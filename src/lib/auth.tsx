import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { runInitialSync } from './initialSync';
import { initPurchases, loginPurchases, logoutPurchases } from './purchases';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  syncing: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, syncing: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const hadSession = useRef(false);

  const handleSession = (next: Session | null) => {
    setSession(next);
    const justSignedIn = !!next && !hadSession.current;
    const justSignedOut = !next && hadSession.current;
    hadSession.current = !!next;
    if (justSignedIn) {
      setSyncing(true);
      runInitialSync()
        .catch(() => {})
        .finally(() => setSyncing(false));
      loginPurchases(next!.user.id).catch(() => {});
    }
    if (justSignedOut) {
      logoutPurchases().catch(() => {});
    }
  };

  useEffect(() => {
    initPurchases();
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      handleSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading, syncing }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Returns whether a session was created immediately. If the project has
// "Confirm email" enabled (Supabase's default), signUp succeeds but there's
// no session until the user clicks the confirmation link — callers need to
// tell the user to check their email rather than treating them as signed in.
export async function signUpWithPassword(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
