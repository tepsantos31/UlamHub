import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  onboarding: 'uh_onboarding',
  recipes: 'uh_recipes',
  plan: 'uh_plan',
  grocery: 'uh_grocery',
  pantry: 'uh_pantry',
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
