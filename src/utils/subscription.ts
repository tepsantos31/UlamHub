import { Recipe, SettingsState } from '../types/models';

// NOTE: real payment verification (RevenueCat/StoreKit) is still deferred —
// `plan` remains a value the user's own account can set with no purchase
// behind it. This enforces the *expiry-date* logic honestly (access lasts
// until the period you "subscribed" for actually runs out, resubscribing
// restores it), but it's UX-level gating on the same mock subscription
// state as the rest of the paywall, not a cryptographic entitlement check.

const PERIOD_MS: Record<'monthly' | 'annual' | 'family', number> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  annual: 365 * 24 * 60 * 60 * 1000,
  family: 365 * 24 * 60 * 60 * 1000,
};

export function computeExpiryDate(plan: 'monthly' | 'annual' | 'family'): string {
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

/** Seed dishes are always free. Anything the user created, imported, or saved
 * from a shared link (all marked userAdded) requires an active subscription. */
export function canAccessRecipe(recipe: Recipe, settings: SettingsState): boolean {
  if (!recipe.userAdded) return true;
  return isSubscriptionActive(settings);
}
