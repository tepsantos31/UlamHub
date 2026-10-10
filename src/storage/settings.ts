import * as Localization from 'expo-localization';
import { getJSON, setJSON, KEYS } from './db';
import { SettingsState, ProfileState } from '../types/models';
import { pushSettings as pushSettingsRemote, pushProfile } from '../lib/sync';
import i18n from '../lib/i18n';

// Only consulted the first time this device ever reads settings (getJSON's
// fallback is never used again once something is written to KEYS.settings) —
// after that, the language the user picked (or kept) in Profile is what
// sticks, regardless of what the device's own locale is set to.
function detectDefaultLanguage(): SettingsState['language'] {
  const deviceLanguage = Localization.getLocales()[0]?.languageCode;
  return deviceLanguage === 'es' ? 'es' : 'en';
}

const DEFAULT_SETTINGS: SettingsState = {
  unit: 'metric',
  language: detectDefaultLanguage(),
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
  // A device with settings saved before `language` existed shouldn't have
  // its app suddenly switch away from English on upgrade — only a brand-new
  // install (going through DEFAULT_SETTINGS above) gets the device-locale
  // guess; everyone else defaults to the language the app has always been.
  const next = { ...s, notif: migrateNotif(s.notif), language: s.language ?? 'en' };
  // i18next's changeLanguage() unconditionally re-emits languageChanged (and
  // bumps every useTranslation() consumer's snapshot) even when passed the
  // language it's already on — guard it, since getSettings() runs on nearly
  // every screen's focus effect and an unconditional call here can feed back
  // into a screen's own `t`-dependent effects and loop.
  if (i18n.language !== next.language) {
    i18n.changeLanguage(next.language).catch(() => {});
  }
  return next;
}

export async function setSettings(s: SettingsState): Promise<void> {
  await setJSON(KEYS.settings, s);
  if (i18n.language !== s.language) {
    i18n.changeLanguage(s.language).catch(() => {});
  }
  pushSettingsRemote(s).catch(() => {});
}

export async function getProfile(): Promise<ProfileState> {
  return getJSON<ProfileState>(KEYS.profile, DEFAULT_PROFILE);
}

export async function setProfile(p: ProfileState): Promise<void> {
  await setJSON(KEYS.profile, p);
  pushProfile(p).catch(() => {});
}
