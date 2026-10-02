import { getJSON, setJSON, KEYS } from './db';
import { RECIPE_SEED } from './seed';
import { Recipe } from '../types/models';
import { pushRecipe, uploadRecipePhoto, deleteRecipeRemote } from '../lib/sync';

const SEED_BY_ID = new Map(RECIPE_SEED.map((r) => [r.id, r]));

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
  const stored = await getJSON<Recipe[]>(KEYS.recipes, []);
  // Older app versions bundled starter dishes (Adobo, Sinigang, etc.) as the
  // default value here, and saveRecipe() baked them into storage permanently
  // the first time a user saved anything. Strip any of those bundled ids out
  // so only recipes the user actually added ever show up.
  return stored.filter((r) => !SEED_BY_ID.has(r.id)).map(migrateRecipe);
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

export async function deleteRecipe(id: string): Promise<void> {
  const all = await listRecipes();
  await setJSON(KEYS.recipes, all.filter((r) => r.id !== id));
  deleteRecipeRemote(id).catch(() => {});
}

export function makeRecipeId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  // Two recipes with the same name would otherwise collide on the same slug
  // (and overwrite each other via saveRecipe's id match) — the base-36
  // timestamp suffix keeps every id unique without needing a UUID library.
  return `${base || 'recipe'}-${Date.now().toString(36)}`;
}
