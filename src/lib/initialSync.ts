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
  console.warn('[sync] runInitialSync recipes', { remoteCount: remoteRecipes?.length ?? null, localCount: local.length });
  if (remoteRecipes && remoteRecipes.length > 0) {
    const remoteIds = new Set(remoteRecipes.map((r) => r.id));
    const localOnly = local.filter((r) => r.userAdded && !remoteIds.has(r.id));
    // Write what we already have first — pulling the account's real data
    // down to this device must not be at the mercy of also successfully
    // pushing a few local-only extras. That push is best-effort cleanup
    // (same as saveRecipe's own fire-and-forget push), not something that
    // should ever be able to block the merge if it fails.
    await setJSON(KEYS.recipes, [...remoteRecipes, ...localOnly]);
    localOnly.forEach((r) => pushRecipe(r).catch(() => {}));
  } else {
    local.forEach((r) => pushRecipe(r).catch(() => {}));
  }

  await syncSingleton(KEYS.plan, getPlan, pullPlan, pushPlan);
  await syncSingleton(KEYS.grocery, getGrocery, pullGrocery, pushGrocery);
  await syncSingleton(KEYS.settings, getSettings, pullSettings, pushSettings);
  await syncSingleton(KEYS.onboarding, getOnboarding, pullOnboarding, pushOnboarding);
  await syncProfile();
}

// Profile needs one extra step beyond syncSingleton's generic "cloud wins,
// empty cloud -> push local as the seed":
//
// 1. Supabase actually auto-creates a `profiles` row via an on-signup DB
//    trigger (see handle_new_user() in supabase/schema.sql) the instant the
//    auth user is created — so `pullProfile()` is essentially NEVER null for
//    a real account, even a brand-new one. The plain "empty cloud" case
//    below is mostly a belt-and-suspenders fallback, not the common path.
// 2. Separately, this app's own local DEFAULT_PROFILE placeholder
//    ("Samantha Cruz" — nothing in the onboarding quiz ever asks for a real
//    name) can end up PUSHED to the cloud as a real value — e.g. from a
//    signup that happened before this self-heal existed, or any other path
//    where local state got synced before being personalized. Once that's
//    sitting in the cloud, "cloud wins" alone means every future sign-in on
//    any device for that account keeps re-downloading the placeholder
//    forever — it never heals on its own.
//
// So: whenever what we're about to treat as "the profile" (remote if it
// exists, local otherwise) is still literally the placeholder name, try to
// replace it with something real from the auth identity before using it —
// regardless of whether that placeholder came from the cloud or from local.
async function syncProfile(): Promise<void> {
  const remote = await pullProfile();
  let profile = remote ?? (await getProfile());
  if (profile.name === DEFAULT_PROFILE.name) {
    const better = await profileFromAuthIdentity();
    if (better.name) profile = { ...profile, ...better };
  }
  if (profile !== remote) await pushProfile(profile);
  await setJSON(KEYS.profile, profile);
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
