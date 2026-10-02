import { Linking, Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { getSettings, setSettings } from '../storage/settings';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;

// The entitlement identifier configured in the RevenueCat dashboard —
// everything below checks this one entitlement, regardless of which product
// (monthly/annual) unlocked it.
const ENTITLEMENT_ID = 'premium';

export const purchasesConfigured = !!apiKey;

if (!purchasesConfigured) {
  console.warn(
    '⚠️  EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY are not set — the paywall falls back to a local mock subscription (no real purchase) until they are.',
  );
}

let configured = false;

/** Starts the RevenueCat SDK — safe to call multiple times, a no-op after
 * the first. Call once at app startup, before anything else here. */
export function initPurchases() {
  if (!purchasesConfigured || configured || !apiKey) return;
  Purchases.configure({ apiKey });
  configured = true;
}

/** Links purchases to this account so they carry across reinstalls/devices —
 * call right after a Supabase sign-in. */
export async function loginPurchases(userId: string) {
  if (!purchasesConfigured) return;
  await Purchases.logIn(userId);
  await syncEntitlementToSettings();
}

/** Call on sign-out so a later sign-in with a different account doesn't
 * inherit this device's cached RevenueCat identity. */
export async function logoutPurchases() {
  if (!purchasesConfigured) return;
  await Purchases.logOut().catch(() => {});
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!purchasesConfigured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

// "P7D" -> "7-day", "P1W" -> "1-week", "P3M" -> "3-month", "P1Y" -> "1-year".
// Store-configured periods only ever use one unit + one number, so this
// simple regex covers every real case without a full ISO 8601 parser.
const PERIOD_UNIT_WORDS: Record<string, string> = { D: 'day', W: 'week', M: 'month', Y: 'year' };
function isoPeriodToTrialLength(iso: string): string | null {
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return null;
  return `${m[1]}-${PERIOD_UNIT_WORDS[m[2]]}`;
}

/** Whether this specific package actually has a free trial attached in the
 * store, and if so, how long it is — e.g. "7-day". Null for a package with
 * no trial, or one that only has a discounted (not free) introductory price.
 * iOS reports this on `introPrice`; Android reports it on the default
 * subscription option's `freePhase`. Checking the real package is the only
 * way to know — a trial is configured per-product in App Store Connect /
 * Play Console, not something the app can assume exists. */
export function describeFreeTrial(pkg: PurchasesPackage): string | null {
  const introPrice = pkg.product.introPrice;
  if (introPrice && introPrice.price === 0) {
    return isoPeriodToTrialLength(introPrice.period);
  }
  const freePhase = pkg.product.defaultOption?.freePhase;
  if (freePhase?.billingPeriod) {
    return isoPeriodToTrialLength(freePhase.billingPeriod.iso8601);
  }
  return null;
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  await applyEntitlement(customerInfo);
  return customerInfo;
}

export async function restore(): Promise<CustomerInfo> {
  const customerInfo = await Purchases.restorePurchases();
  await applyEntitlement(customerInfo);
  return customerInfo;
}

/** Re-reads entitlement status from RevenueCat and writes it into local
 * settings, so every existing `isSubscriptionActive(settings)` check across
 * the app keeps working unchanged — RevenueCat is just what now keeps that
 * flag honest instead of it being fully self-reported. Call on app launch
 * and whenever the Paywall/Profile screen comes into focus. */
export async function syncEntitlementToSettings(): Promise<void> {
  if (!purchasesConfigured) return;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    await applyEntitlement(customerInfo);
  } catch {
    // Offline or not yet configured server-side — leave local settings as they are.
  }
}

async function applyEntitlement(customerInfo: CustomerInfo): Promise<void> {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
  const settings = await getSettings();
  if (entitlement) {
    const plan: 'monthly' | 'annual' = entitlement.productIdentifier.toLowerCase().includes('annual') ? 'annual' : 'monthly';
    // willRenew is false once the user cancels through the App Store/Play
    // Store — the entitlement stays active (and stays in this branch) until
    // its expirationDate actually passes, which is what keeps features
    // unlocked through the end of the period they already paid for.
    await setSettings({ ...settings, plan, planExpiresAt: entitlement.expirationDate ?? undefined, planCancelled: !entitlement.willRenew });
  } else if (settings.plan) {
    // RevenueCat says nothing is active any more (expired/refunded/cancelled
    // and lapsed) — clear the locally-cached plan rather than trusting stale data.
    await setSettings({ ...settings, plan: null, planExpiresAt: undefined, planCancelled: false });
  }
}

/** Real subscriptions can only be cancelled through the platform's own
 * subscription management UI — neither the app nor RevenueCat can cancel an
 * App Store/Play Store subscription directly. This just opens that screen;
 * syncEntitlementToSettings() picks up the resulting willRenew change next
 * time it runs (e.g. when the Profile screen refocuses). */
export function openSubscriptionManagement(): Promise<void> {
  const url = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
  return Linking.openURL(url);
}

/** Demo-mode only (no RevenueCat keys configured) — there's no real store
 * subscription to cancel, so this just flags the mock one as non-renewing.
 * Deliberately leaves plan/planExpiresAt untouched: access continues exactly
 * as a real cancellation would, through the end of the current period. */
export async function cancelDemoSubscription(): Promise<void> {
  const settings = await getSettings();
  await setSettings({ ...settings, planCancelled: true });
}
