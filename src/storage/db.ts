import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  onboarding: 'uh_onboarding',
  recipes: 'uh_recipes',
  plan: 'uh_plan',
  grocery: 'uh_grocery',
  settings: 'uh_settings',
  profile: 'uh_profile',
  chat: 'uh_chat',
  supportChat: 'uh_support_chat',
} as const;

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
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
