import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && anonKey);

if (!supabaseConfigured) {
  console.warn(
    '⚠️  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set — auth, cloud sync, and kitchen sharing are disabled until mobile/.env has real values.',
  );
}

// Falls back to harmless placeholder values when unconfigured so createClient()
// doesn't throw at import time — supabaseConfigured is what everything else checks.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Without this, signInWithOAuth defaults to the "implicit" flow, which
    // redirects back with tokens in a URL *fragment* (#access_token=...).
    // signInWithGoogle() in auth.tsx expects a ?code= query param to exchange
    // for a session — that's the "pkce" flow, so it has to be explicit here.
    flowType: 'pkce',
  },
});
