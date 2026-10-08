import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { runInitialSync } from './initialSync';
import { initPurchases, loginPurchases, logoutPurchases } from './purchases';
import { ensureOwnKitchen } from './kitchen';

// Lets a browser tab opened by openAuthSessionAsync close itself and hand
// control back to the app on web; a no-op on iOS/Android.
WebBrowser.maybeCompleteAuthSession();

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
    // onAuthStateChange also fires on things that aren't a real sign-in/out —
    // e.g. a silent token refresh still calls back with a session. hadSession
    // is the only way to tell "this is a *new* session" from "same session,
    // just re-reported" so the one-time sync/purchases/kitchen setup below
    // doesn't re-run on every refresh.
    const justSignedIn = !!next && !hadSession.current;
    const justSignedOut = !next && hadSession.current;
    hadSession.current = !!next;
    if (justSignedIn) {
      setSyncing(true);
      runInitialSync()
        .catch(() => {})
        .finally(() => setSyncing(false));
      loginPurchases(next!.user.id).catch(() => {});
      ensureOwnKitchen().catch(() => {});
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
  // Without this, the confirmation email links to whatever the Supabase
  // project's Site URL happens to be (often left at the default
  // http://localhost:3000), which just fails to load on a phone. Point it
  // at our own branded landing page instead — it still has to be added to
  // the project's Redirect URLs allow list in Supabase for this to work.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: 'https://ulam-backend.onrender.com/auth/confirmed' },
  });
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

// Opens the system browser for the OAuth consent screen, then exchanges the
// ?code it redirects back with for a real session — this project uses
// Supabase's default PKCE flow, not the older implicit (#access_token) one.
// Supabase itself will happily create a brand-new account for a Google
// identity it's never seen before, regardless of which button the user
// tapped — allowAccountCreation is what actually enforces "Continue with
// Google" (signin) vs "Sign up with Google" (signup) as distinct actions.
export async function signInWithGoogle(allowAccountCreation: boolean): Promise<void> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return; // user cancelled — not an error

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code !== 'string') {
    throw new Error((queryParams?.error_description as string) || 'Google sign-in did not complete.');
  }
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;

  if (!allowAccountCreation) {
    const user = sessionData.session?.user;
    // Supabase doesn't expose an explicit "was this just created" flag for
    // OAuth sign-ins — created_at and last_sign_in_at landing within a few
    // seconds of each other is the standard way to detect a brand-new user.
    const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
    const lastSignInAt = user?.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
    const isNewAccount = createdAt > 0 && Math.abs(lastSignInAt - createdAt) < 5000;
    if (isNewAccount) {
      await supabase.auth.signOut();
      throw new Error("We couldn't find a UlamHub account for this Google account — tap \"Create account\" to sign up first.");
    }
  }
}

// Unlike Google (web OAuth redirect), Apple's own Sign In sheet hands back a
// native identity token directly — no browser round-trip needed. Supabase
// verifies that token itself via signInWithIdToken, but only if the nonce it
// was issued with matches: Apple only ever sees the SHA-256 hash (it signs
// that into the token), so Supabase has to be given the original raw value
// to hash and compare against.
async function signInWithAppleIdentityToken(identityToken: string, rawNonce: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  return data.session;
}

// Apple's dialog doesn't distinguish "sign in" from "sign up" the way the
// email/password form does — a first-time Apple ID just creates an account.
// Mirrors signInWithGoogle's allowAccountCreation guard so "Continue with
// Apple" on the sign-in tab can't silently create a brand-new account.
export async function signInWithApple(allowAccountCreation: boolean): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return; // user cancelled — not an error
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }
  const session = await signInWithAppleIdentityToken(credential.identityToken, rawNonce);

  if (!allowAccountCreation) {
    const user = session?.user;
    // Same heuristic as signInWithGoogle — Supabase doesn't expose an
    // explicit "was this just created" flag for an identity-token sign-in.
    const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
    const lastSignInAt = user?.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
    const isNewAccount = createdAt > 0 && Math.abs(lastSignInAt - createdAt) < 5000;
    if (isNewAccount) {
      await supabase.auth.signOut();
      throw new Error('We couldn\'t find a UlamHub account for this Apple ID — tap "Create account" to sign up first.');
    }
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
