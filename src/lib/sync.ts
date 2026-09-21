import { supabase, supabaseConfigured } from './supabase';
import { Recipe, PlanDay, GroceryGroup, PantryItem, SettingsState, OnboardingState, ProfileState } from '../types/models';

interface SyncContext {
  userId: string;
  scopeId: string; // household_id if in one, else the user's own id
}

// Every push/pull below is a no-op when Supabase isn't configured yet, or
// when there's no signed-in session — callers never need to check first.
async function getContext(): Promise<SyncContext | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).maybeSingle();
  const scopeId = (profile as { household_id: string | null } | null)?.household_id ?? userId;
  return { userId, scopeId };
}

async function pushScoped(table: string, column: string, value: unknown) {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase
    .from(table)
    .upsert({ scope_id: ctx.scopeId, [column]: value }, { onConflict: 'scope_id' })
    .then(() => {});
}

async function pullScoped<T>(table: string, column: string): Promise<T | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data } = await supabase.from(table).select(column).eq('scope_id', ctx.scopeId).maybeSingle();
  return (data as Record<string, T> | null)?.[column] ?? null;
}

// Personal-only tables (settings, onboarding) are keyed by owner_id, never
// shared with a household — distinct from the scope_id tables above.
async function pushPersonal(table: string, column: string, value: unknown) {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase
    .from(table)
    .upsert({ owner_id: ctx.userId, [column]: value }, { onConflict: 'owner_id' })
    .then(() => {});
}

async function pullPersonal<T>(table: string, column: string): Promise<T | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data } = await supabase.from(table).select(column).eq('owner_id', ctx.userId).maybeSingle();
  return (data as Record<string, T> | null)?.[column] ?? null;
}

// ---- recipes (multi-row collection, not a scope_id singleton) ----

export async function pushRecipe(recipe: Recipe): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const { photoAsset, ...portable } = recipe; // require() result isn't portable off-device — never sync it
  await supabase
    .from('recipes')
    .upsert(
      {
        id: recipe.id,
        owner_id: ctx.userId,
        household_id: ctx.scopeId !== ctx.userId ? ctx.scopeId : null,
        data: portable,
      },
      { onConflict: 'id,owner_id' },
    )
    .then(() => {});
}

export async function pullRecipes(): Promise<Recipe[] | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data, error } = await supabase.from('recipes').select('data');
  if (error || !data) return null;
  return data.map((row) => row.data as Recipe);
}

// ---- sharing a single recipe via a public link ----

/** Upserts the recipe (same as pushRecipe) and marks it publicly readable,
 * returning the row_id to build a share link from. Null if not signed in. */
export async function shareRecipe(recipe: Recipe): Promise<string | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { photoAsset, ...portable } = recipe;
  const { data, error } = await supabase
    .from('recipes')
    .upsert(
      {
        id: recipe.id,
        owner_id: ctx.userId,
        household_id: ctx.scopeId !== ctx.userId ? ctx.scopeId : null,
        data: portable,
        is_shared: true,
      },
      { onConflict: 'id,owner_id' },
    )
    .select('row_id')
    .single();
  if (error || !data) return null;
  return (data as { row_id: string }).row_id;
}

/** Reads a shared recipe by its row_id — works even when signed out, since
 * is_shared rows are publicly readable. Null if the link is invalid/unshared. */
export async function fetchSharedRecipe(rowId: string): Promise<Recipe | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from('recipes').select('data').eq('row_id', rowId).eq('is_shared', true).maybeSingle();
  if (error || !data) return null;
  return data.data as Recipe;
}

/** Revokes a share link — the row stays (still synced/owned as normal), it
 * just stops being publicly readable. Only the owner can do this (RLS). */
export async function unshareRecipe(rowId: string): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase.from('recipes').update({ is_shared: false }).eq('row_id', rowId).then(() => {});
}

// ---- singleton documents, shared per-household via scope_id ----

export const pushPlan = (days: PlanDay[]) => pushScoped('meal_plans', 'days', days);
export const pullPlan = () => pullScoped<PlanDay[]>('meal_plans', 'days');

export const pushGrocery = (groups: GroceryGroup[]) => pushScoped('grocery_lists', 'groups', groups);
export const pullGrocery = () => pullScoped<GroceryGroup[]>('grocery_lists', 'groups');

export const pushPantry = (items: PantryItem[]) => pushScoped('pantry', 'items', items);
export const pullPantry = () => pullScoped<PantryItem[]>('pantry', 'items');

// ---- personal-only documents (never shared with a household) ----

export const pushSettings = (settings: SettingsState) => pushPersonal('settings', 'data', settings);
export const pullSettings = () => pullPersonal<SettingsState>('settings', 'data');

export const pushOnboarding = (state: OnboardingState) => pushPersonal('onboarding', 'data', state);
export const pullOnboarding = () => pullPersonal<OnboardingState>('onboarding', 'data');

// ---- profile — backed by the `profiles` row Supabase auto-creates on sign-up ----

export async function pushProfile(profile: ProfileState): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase
    .from('profiles')
    .update({ name: profile.name, handle: profile.handle, avatar_initial: profile.avatarInitial })
    .eq('id', ctx.userId)
    .then(() => {});
}

export async function pullProfile(): Promise<ProfileState | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data } = await supabase
    .from('profiles')
    .select('name, handle, avatar_initial')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (!data) return null;
  return { name: data.name, handle: data.handle, avatarInitial: data.avatar_initial };
}
