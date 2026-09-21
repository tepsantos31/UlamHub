import { getJSON, setJSON, KEYS } from './db';
import { RECIPE_SEED } from './seed';
import { Recipe } from '../types/models';
import { pushRecipe } from '../lib/sync';

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

export async function listRecipes(): Promise<Recipe[]> {
  const stored = await getJSON<Recipe[]>(KEYS.recipes, RECIPE_SEED);
  return stored.map(withSeedPhoto);
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
}

export function makeRecipeId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base || 'recipe'}-${Date.now().toString(36)}`;
}
