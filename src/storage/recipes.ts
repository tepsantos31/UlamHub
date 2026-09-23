import { getJSON, setJSON, KEYS } from './db';
import { RECIPE_SEED } from './seed';
import { Recipe } from '../types/models';
import { pushRecipe, uploadRecipePhoto } from '../lib/sync';

const SEED_BY_ID = new Map(RECIPE_SEED.map((r) => [r.id, r]));

// Bundled dish photos are build-time assets, not user data — a phone that already
// has recipes saved from an earlier session (before photos existed) would otherwise
// keep showing the old cached copy forever, since AsyncStorage always wins over the
// current RECIPE_SEED once something's been written. Always trust the current code's
// photoAsset for known seed dishes instead of whatever got persisted historically.
function withSeedPhoto(recipe: Recipe): Recipe {
  const seed = SEED_BY_ID.get(recipe.id);
  if (seed?.photoAsset && recipe.photoAsset !== seed.photoAsset) {
    return { ...recipe, photoAsset: seed.photoAsset };
  }
  return recipe;
}

// Older saved recipes (before the Filipino -> multi-cuisine rebrand) were
// persisted with `region` as the primary field and `sawsawan`/`aat` instead
// of `saucePairings`/`flavorBalance`. Normalize on read so a device with
// pre-rebrand data doesn't crash screens that expect the new shape.
function migrateRecipe(recipe: any): Recipe {
  return {
    ...recipe,
    country: recipe.country ?? recipe.region ?? 'Filipino',
    saucePairings: recipe.saucePairings ?? recipe.sawsawan ?? [],
    flavorBalance: recipe.flavorBalance ?? recipe.aat ?? [],
  };
}

export async function listRecipes(): Promise<Recipe[]> {
  const stored = await getJSON<Recipe[]>(KEYS.recipes, RECIPE_SEED);
  return stored.map(migrateRecipe).map(withSeedPhoto);
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const all = await listRecipes();
  return all.find((r) => r.id === id);
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const all = await listRecipes();
  const idx = all.findIndex((r) => r.id === recipe.id);
  const next = idx >= 0 ? all.map((r, i) => (i === idx ? recipe : r)) : [recipe, ...all];
  await setJSON(KEYS.recipes, next);
  pushRecipe(recipe).catch(() => {});
  // A freshly picked/AI-generated photo is still a local file:/data: URI at
  // this point — upload it in the background and re-save once it has a real
  // URL, so crew members, share links, and a future reinstall can all see
  // it. No-ops (and doesn't recurse) once photoUri is already a real URL.
  uploadRecipePhoto(recipe)
    .then((publicUrl) => {
      if (publicUrl) saveRecipe({ ...recipe, photoUri: publicUrl });
    })
    .catch(() => {});
}

export function makeRecipeId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base || 'recipe'}-${Date.now().toString(36)}`;
}
