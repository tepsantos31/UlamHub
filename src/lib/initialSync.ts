// Runs once whenever a session appears (fresh sign-in, or app relaunch with a
// persisted session). Per table: if the cloud already has something, it wins
// and overwrites local (the common case — signing into an existing account,
// or a second device); if the cloud is empty, the current local state is
// pushed up as the seed (the common case — someone who used the app before
// creating an account, whose local data shouldn't be silently discarded).
//
// Deliberately simple for v1: whole-document last-writer-wins per table, no
// field-level merge. Fine for a single small household; a fuller merge would
// be a reasonable fast-follow if that ever becomes a real problem.
import { KEYS, setJSON } from '../storage/db';
import { listRecipes } from '../storage/recipes';
import { getPlan } from '../storage/plan';
import { getGrocery } from '../storage/grocery';
import { getSettings, getProfile, DEFAULT_PROFILE } from '../storage/settings';
import { getOnboarding } from '../storage/onboarding';
import { supabase } from './supabase';
import { ProfileState } from '../types/models';
import {
  pushRecipe,
  pullRecipes,
  pushPlan,
  pullPlan,
  pushGrocery,
  pullGrocery,
  pushSettings,
  pullSettings,
  pushOnboarding,
  pullOnboarding,
  pushProfile,
  pullProfile,
} from './sync';

export async function runInitialSync(): Promise<void> {
  // Recipes: multi-row, so "empty" means zero rows came back. Remote wins
  // for anything it already has, but a local user-added recipe remote
  // doesn't know about yet (e.g. an earlier background push silently
  // failed — see saveRecipe's .catch) gets pushed up and kept, rather than
  // being wiped out by treating remote as the sole source of truth. That
  // silent-overwrite was the likely cause of recipes "disappearing".
  const remoteRecipes = await pullRecipes();
  const local = await listRecipes();
  if (remoteRecipes && remoteRecipes.length > 0) {
    const remoteIds = new Set(remoteRecipes.map((r) => r.id));
    const localOnly = local.filter((r) => r.userAdded && !remoteIds.has(r.id));
    await Promise.all(localOnly.map((r) => pushRecipe(r)));
    await setJSON(KEYS.recipes, [...remoteRecipes, ...localOnly]);
  } else {
    await Promise.all(local.map((r) => pushRecipe(r)));
  }

  await syncSingleton(KEYS.plan, getPlan, pullPlan, pushPlan);
  await syncSingleton(KEYS.grocery, getGrocery, pullGrocery, pushGrocery);
  await syncSingleton(KEYS.settings, getSettings, pullSettings, pushSettings);
  await syncSingleton(KEYS.onboarding, getOnboarding, pullOnboarding, pushOnboarding);
  await syncProfile();
}

// Profile needs one extra step beyond syncSingleton's generic "empty cloud ->
// push local as the seed" — on a genuinely brand-new account, "local" is
// usually still the untouched DEFAULT_PROFILE placeholder (nothing in the
// onboarding quiz ever asks for a name), so pushing it verbatim means every
// new sign-up gets stuck looking like it belongs to "Samantha Cruz". If the
// cloud is empty AND local is still that placeholder, pull a real name from
// the auth identity (Google's OAuth metadata; Apple's name, when Apple hands
// it to us on first sign-in, is written into local profile earlier — see
// signInWithApple in lib/auth.tsx — so it's already not the placeholder by
// the time we get here) before seeding the cloud with it.
async function syncProfile(): Promise<void> {
  const remote = await pullProfile();
  if (remote != null) {
    await setJSON(KEYS.profile, remote);
    return;
  }
  let local = await getProfile();
  if (local.name === DEFAULT_PROFILE.name) {
    local = { ...local, ...(await profileFromAuthIdentity()) };
  }
  await pushProfile(local);
  await setJSON(KEYS.profile, local);
}

async function profileFromAuthIdentity(): Promise<Partial<ProfileState>> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return {};
  const meta = user.user_metadata ?? {};
  const name: string | undefined = meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : undefined);
  if (!name) return {};
  return { name, avatarInitial: name.trim().charAt(0).toUpperCase() || DEFAULT_PROFILE.avatarInitial };
}

async function syncSingleton<T>(
  key: string,
  getLocal: () => Promise<T>,
  pull: () => Promise<T | null>,
  push: (value: T) => Promise<void>,
): Promise<void> {
  const remote = await pull();
  if (remote != null) {
    await setJSON(key, remote);
  } else {
    await push(await getLocal());
  }
}
