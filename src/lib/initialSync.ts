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
import { getSettings, getProfile } from '../storage/settings';
import { getOnboarding } from '../storage/onboarding';
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
  await syncSingleton(KEYS.profile, getProfile, pullProfile, pushProfile);
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
