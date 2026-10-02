import { getJSON, setJSON, KEYS } from './db';
import { SettingsState, ProfileState } from '../types/models';
import { pushSettings as pushSettingsRemote, pushProfile } from '../lib/sync';

const DEFAULT_SETTINGS: SettingsState = {
  unit: 'metric',
  notif: { party: true, social: true },
  plan: null,
};

// Older saved settings stored `mealRem`/`grocery` instead of `party` (from
// before notifications were simplified to just party reminders + social
// requests). Default `party` to true for a device with pre-existing settings
// so party reminders don't silently stop firing after this change ships.
function migrateNotif(notif: any): SettingsState['notif'] {
  return { party: notif?.party ?? true, social: notif?.social ?? true };
}

// Placeholder identity shown before a real profile is ever saved — not real
// user data. Like any default passed to getJSON, once something is written
// to KEYS.profile this fallback is never consulted again for that device.
const DEFAULT_PROFILE: ProfileState = {
  name: 'Samantha Cruz',
  handle: '@sam.kusina',
  avatarInitial: 'S',
};

export async function getSettings(): Promise<SettingsState> {
  const s = await getJSON<SettingsState>(KEYS.settings, DEFAULT_SETTINGS);
  return { ...s, notif: migrateNotif(s.notif) };
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
