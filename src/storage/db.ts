import AsyncStorage from '@react-native-async-storage/async-storage';

// The "uh_" prefix matches the app's "UlamHub" name. Changing it would
// orphan every value already written to a device's AsyncStorage (a fresh
// key reads back empty), so leave it as-is even if the name changes again.
export const KEYS = {
  onboarding: 'uh_onboarding',
  recipes: 'uh_recipes',
  plan: 'uh_plan',
  grocery: 'uh_grocery',
  settings: 'uh_settings',
  profile: 'uh_profile',
  chat: 'uh_chat',
  supportChat: 'uh_support_chat',
  partyPlan: 'uh_party_plan',
} as const;

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted or unexpectedly-shaped JSON on disk shouldn't crash the
    // screen that reads it — fall back to the caller's default instead.
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** Wipes every locally-stored key — used when the account itself is deleted,
 * so nothing from it lingers on-device (unlike a normal log out, which keeps
 * local data around in case the same account signs back in). */
export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
