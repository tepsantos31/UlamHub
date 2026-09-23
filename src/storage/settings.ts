import { getJSON, setJSON, KEYS } from './db';
import { SettingsState, ProfileState } from '../types/models';
import { pushSettings as pushSettingsRemote, pushProfile } from '../lib/sync';

const DEFAULT_SETTINGS: SettingsState = {
  unit: 'metric',
  notif: { mealRem: true, grocery: false, social: true },
  plan: null,
};

const DEFAULT_PROFILE: ProfileState = {
  name: 'Samantha Cruz',
  handle: '@sam.kusina',
  avatarInitial: 'S',
};

export async function getSettings(): Promise<SettingsState> {
  return getJSON<SettingsState>(KEYS.settings, DEFAULT_SETTINGS);
}

export async function setSettings(s: SettingsState): Promise<void> {
  await setJSON(KEYS.settings, s);
  pushSettingsRemote(s).catch(() => {});
}

export async function getProfile(): Promise<ProfileState> {
  return getJSON<ProfileState>(KEYS.profile, DEFAULT_PROFILE);
}

export async function setProfile(p: ProfileState): Promise<void> {
  await setJSON(KEYS.profile, p);
  pushProfile(p).catch(() => {});
}
