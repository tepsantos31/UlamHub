import { Platform } from 'react-native';
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
    await setSettings({ ...settings, plan, planExpiresAt: entitlement.expirationDate ?? undefined });
  } else if (settings.plan) {
    // RevenueCat says nothing is active any more (expired/refunded/cancelled
    // and lapsed) — clear the locally-cached plan rather than trusting stale data.
    await setSettings({ ...settings, plan: null, planExpiresAt: undefined });
  }
}
