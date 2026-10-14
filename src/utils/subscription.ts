import { Recipe, SettingsState } from '../types/models';

// NOTE: real payment verification (RevenueCat/StoreKit) is still deferred —
// `plan` remains a value the user's own account can set with no purchase
// behind it. This enforces the *expiry-date* logic honestly (access lasts
// until the period you "subscribed" for actually runs out, resubscribing
// restores it), but it's UX-level gating on the same mock subscription
// state as the rest of the paywall, not a cryptographic entitlement check.

const PERIOD_MS: Record<'monthly' | 'annual', number> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  annual: 365 * 24 * 60 * 60 * 1000,
};

export function computeExpiryDate(plan: 'monthly' | 'annual'): string {
  return new Date(Date.now() + PERIOD_MS[plan]).toISOString();
}

/** True if there's a plan and its paid-through date hasn't passed yet. A
 * plan with no expiry date at all is treated as active (shouldn't happen
 * for anything set after this feature shipped, but don't lock out old data). */
export function isSubscriptionActive(settings: SettingsState): boolean {
  if (!settings.plan) return false;
  if (!settings.planExpiresAt) return true;
  return Date.now() < new Date(settings.planExpiresAt).getTime();
}

// Free tier: the built-in starter dishes are always free, and a free user's
// own recipes (created, imported, or saved from a share) are fully usable up
// to a flat cap — no separate content-lock beyond that. Subscribing removes
// the cap entirely. `saveRecipe` prepends new entries, so array order is
// most-recent-first — capping to the front of that order means a downgrade
// from a former subscription keeps your 20 *most recent* recipes usable
// rather than an arbitrary/oldest set.
export const FREE_RECIPE_CAP = 20;

/** Seed dishes are always free. A user-added recipe is accessible if the
 * account is subscribed, or if it falls within the free cap. `allRecipes`
 * should be the caller's full local recipe list (for ordering); omitting it
 * is treated conservatively as "not within the cap" for any user-added recipe. */
export function canAccessRecipe(recipe: Recipe, settings: SettingsState, allRecipes: Recipe[] = []): boolean {
  if (!recipe.userAdded) return true;
  if (isSubscriptionActive(settings)) return true;
  const ownOrdered = allRecipes.filter((r) => r.userAdded);
  const idx = ownOrdered.findIndex((r) => r.id === recipe.id);
  return idx >= 0 && idx < FREE_RECIPE_CAP;
}

/** Whether a free (or subscribed) account can save one more recipe — via
 * manual entry, link/photo import, leftover invention, or saving a share. */
export function canAddRecipe(settings: SettingsState, allRecipes: Recipe[]): boolean {
  if (isSubscriptionActive(settings)) return true;
  return allRecipes.filter((r) => r.userAdded).length < FREE_RECIPE_CAP;
}

// AI-backed imports (link or photo extraction) are the one free-tier action
// that actually costs money per use, unlike the flat recipe-count cap above
// — so they get their own rolling weekly quota instead of just riding on
// FREE_RECIPE_CAP. Manual entry is never metered here.
export const FREE_IMPORT_WEEKLY_CAP = 5;
const IMPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The caller's current usage window, rolled forward to a fresh empty one
 * if 7 days have passed since it started. Doesn't persist anything itself
 * — callers that need the reset to stick should save the result. */
function currentImportWindow(settings: SettingsState): { weekStart: string; count: number } {
  const usage = settings.importUsage;
  if (!usage || Date.now() - new Date(usage.weekStart).getTime() >= IMPORT_WINDOW_MS) {
    return { weekStart: new Date().toISOString(), count: 0 };
  }
  return usage;
}

/** Whether a free (or subscribed) account can run one more AI import
 * (link/photo extraction) right now. */
export function canImportRecipe(settings: SettingsState): boolean {
  if (isSubscriptionActive(settings)) return true;
  return currentImportWindow(settings).count < FREE_IMPORT_WEEKLY_CAP;
}

/** Returns settings with one import counted against the free weekly quota.
 * No-op (returns `settings` unchanged) once subscribed. Caller is
 * responsible for persisting the result via `setSettings`. */
export function recordImportUsage(settings: SettingsState): SettingsState {
  if (isSubscriptionActive(settings)) return settings;
  const usage = currentImportWindow(settings);
  return { ...settings, importUsage: { weekStart: usage.weekStart, count: usage.count + 1 } };
}
