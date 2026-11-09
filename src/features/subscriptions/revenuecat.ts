import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { planForProduct, trialDays } from '@/domain/paywall';

/** RevenueCat entitlement that unlocks the whole game. */
export const PRO_ENTITLEMENT = 'pro';
/** Offering holding the Pack Duo and Team packages (the current offering holds annual + weekly). */
export const FRIENDS_OFFERING = 'friends';

// Public SDK keys (they ship in the app). Expo inlines EXPO_PUBLIC_* at build time.
const KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || null,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim() || null,
};

export function revenueCatKey(): string | null {
  if (Platform.OS === 'ios') return KEYS.ios;
  if (Platform.OS === 'android') return KEYS.android;
  return null;
}

let configuredUser: string | null = null;

/**
 * Configures RevenueCat for the signed-in player (app user id = Supabase user id, so the
 * webhook knows who paid). Returns false when payments are not available in this build.
 */
export async function ensureRevenueCat(userId: string): Promise<boolean> {
  const key = revenueCatKey();
  if (!key) return false;
  if (configuredUser === null) {
    Purchases.configure({ apiKey: key, appUserID: userId });
    configuredUser = userId;
  } else if (configuredUser !== userId) {
    await Purchases.logIn(userId);
    configuredUser = userId;
  }
  return true;
}

/** On sign-out: the next player must not inherit this one's purchases. */
export async function resetRevenueCat(): Promise<void> {
  if (configuredUser === null) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous.
  }
  configuredUser = null;
}

export function isProActive(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT]?.isActive);
}

export async function revenueCatHasPro(userId: string): Promise<boolean> {
  if (!(await ensureRevenueCat(userId))) return false;
  return isProActive(await Purchases.getCustomerInfo());
}

export type PlanKey = 'annual' | 'weekly' | 'duo' | 'team';

export type PlanOption = {
  key: PlanKey;
  pkg: PurchasesPackage;
  priceString: string;
  price: number;
  currency: string;
  period: string | null;
  trialDays: number | null;
};

const ORDER: Record<PlanKey, number> = { annual: 0, weekly: 1, duo: 0, team: 1 };

function toOption(key: PlanKey, pkg: PurchasesPackage): PlanOption {
  const p = pkg.product;
  const iosTrial =
    p.introPrice && p.introPrice.price === 0
      ? { unit: p.introPrice.periodUnit, count: p.introPrice.periodNumberOfUnits }
      : null;
  const free = p.defaultOption?.freePhase?.billingPeriod;
  const androidTrial = free ? { unit: String(free.unit), count: free.value } : null;
  return {
    key,
    pkg,
    priceString: p.priceString,
    price: p.price,
    currency: p.currencyCode,
    period: p.subscriptionPeriod,
    trialDays: trialDays(iosTrial ?? androidTrial),
  };
}

/** Plans from the offerings configured in RevenueCat (prices change without an app update). */
export async function loadPlans(
  userId: string,
): Promise<{ solo: PlanOption[]; friends: PlanOption[] }> {
  if (!(await ensureRevenueCat(userId))) throw new Error('payments_unavailable');
  const offerings = await Purchases.getOfferings();
  const solo: PlanOption[] = [];
  for (const pkg of offerings.current?.availablePackages ?? []) {
    if (pkg.packageType === 'ANNUAL') solo.push(toOption('annual', pkg));
    else if (pkg.packageType === 'WEEKLY') solo.push(toOption('weekly', pkg));
  }
  solo.sort((a, b) => ORDER[a.key] - ORDER[b.key]);
  const friends: PlanOption[] = [];
  for (const pkg of offerings.all[FRIENDS_OFFERING]?.availablePackages ?? []) {
    const plan = planForProduct(pkg.product.identifier);
    if (plan === 'duo' || plan === 'team') friends.push(toOption(plan, pkg));
  }
  friends.sort((a, b) => ORDER[a.key] - ORDER[b.key]);
  return { solo, friends };
}

export type PurchaseResult = 'unlocked' | 'pending' | 'cancelled';

/**
 * Buys a plan. The Duo partner / the Team are passed as subscriber attributes, which the
 * webhook reads to grant Pro to the right people.
 */
export async function purchase(
  option: PlanOption,
  target: { partnerId?: string | null; teamId?: string | null } = {},
): Promise<PurchaseResult> {
  const attributes: Record<string, string | null> = {};
  if (option.key === 'duo') attributes.noskip_duo_partner = target.partnerId ?? null;
  if (option.key === 'team') attributes.noskip_team_id = target.teamId ?? null;
  if (Object.keys(attributes).length) await Purchases.setAttributes(attributes);
  try {
    const { customerInfo } = await Purchases.purchasePackage(option.pkg);
    return isProActive(customerInfo) ? 'unlocked' : 'pending';
  } catch (err) {
    if ((err as { userCancelled?: boolean | null }).userCancelled) return 'cancelled';
    throw err;
  }
}

export async function restore(userId: string): Promise<boolean> {
  if (!(await ensureRevenueCat(userId))) throw new Error('payments_unavailable');
  return isProActive(await Purchases.restorePurchases());
}

/** Opens the store's subscription management page. */
export async function manageSubscription(): Promise<void> {
  await Purchases.showManageSubscriptions();
}
