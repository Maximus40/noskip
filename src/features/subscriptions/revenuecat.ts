import { Linking, Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { planForProduct, trialDays } from '@/domain/paywall';

/** RevenueCat entitlement that unlocks the whole game. */
export const PRO_ENTITLEMENT = 'pro';
/** Offering holding the Team package (the current offering holds annual + weekly). */
export const FRIENDS_OFFERING = 'friends';

/**
 * Public SDK keys: they ship inside every app, so the production iOS key also lives in code
 * (like the Supabase publishable key) and a missing or mangled build value falls back to it.
 */
export const REVENUECAT_PUBLIC_DEFAULTS = {
  ios: 'appl_NcQNGjxxAhRHnpMpYJcPREVoHHB',
  android: null,
} as const;

/** The build value when it looks like a RevenueCat public key, otherwise the default. */
export function pickSdkKey(
  value: string | undefined,
  prefix: 'appl_' | 'goog_',
  fallback: string | null,
): string | null {
  const v = value?.trim() ?? '';
  return new RegExp(`^${prefix}[A-Za-z0-9]+$`).test(v) ? v : fallback;
}

// Expo inlines EXPO_PUBLIC_* at build time (static property access required).
const KEYS = {
  ios: pickSdkKey(
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    'appl_',
    REVENUECAT_PUBLIC_DEFAULTS.ios,
  ),
  android: pickSdkKey(
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    'goog_',
    REVENUECAT_PUBLIC_DEFAULTS.android,
  ),
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

export type PlanKey = 'annual' | 'weekly' | 'team';

export type PlanOption = {
  key: PlanKey;
  pkg: PurchasesPackage;
  priceString: string;
  price: number;
  currency: string;
  period: string | null;
  trialDays: number | null;
};

const ORDER: Record<PlanKey, number> = { annual: 0, weekly: 1, team: 2 };

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
    // A Team product misplaced in the current offering must never show up as "Annuel".
    if (planForProduct(pkg.product.identifier) !== 'individual') continue;
    if (pkg.packageType === 'ANNUAL') solo.push(toOption('annual', pkg));
    else if (pkg.packageType === 'WEEKLY') solo.push(toOption('weekly', pkg));
  }
  solo.sort((a, b) => ORDER[a.key] - ORDER[b.key]);
  const friends: PlanOption[] = [];
  for (const pkg of offerings.all[FRIENDS_OFFERING]?.availablePackages ?? []) {
    // The Pack Duo is no longer sold: any personal plan already covers up to 3 teammates.
    if (planForProduct(pkg.product.identifier) === 'team') friends.push(toOption('team', pkg));
  }
  friends.sort((a, b) => ORDER[a.key] - ORDER[b.key]);
  return { solo, friends };
}

export type PurchaseResult = 'unlocked' | 'pending' | 'cancelled';

/**
 * Buys a plan. For the Team plan, the team is passed as a subscriber attribute, which the
 * webhook reads to cover the right team.
 */
export async function purchase(
  option: PlanOption,
  target: { teamId?: string | null } = {},
): Promise<PurchaseResult> {
  const attributes: Record<string, string | null> = {};
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
/** The store's own subscription pages (fallback when the SDK cannot open its sheet). */
export const STORE_SUBSCRIPTIONS_URL = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const;

/**
 * Opens the store's "manage subscription" page. The SDK must be configured first: after a cold
 * start nothing has touched RevenueCat yet, and the sheet silently did nothing.
 */
export async function manageSubscription(userId: string): Promise<void> {
  try {
    if (await ensureRevenueCat(userId)) {
      await Purchases.showManageSubscriptions();
      return;
    }
  } catch {
    // Fall back to the store page below.
  }
  await Linking.openURL(
    Platform.OS === 'android' ? STORE_SUBSCRIPTIONS_URL.android : STORE_SUBSCRIPTIONS_URL.ios,
  );
}

/** Store prices of the shop items (one-time purchases), by product id. */
export async function loadShopPrices(
  userId: string,
  productIds: readonly string[],
): Promise<Record<string, string>> {
  if (!(await ensureRevenueCat(userId))) throw new Error('payments_unavailable');
  const products = await Purchases.getProducts(
    [...productIds],
    Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  return Object.fromEntries(products.map((p) => [p.identifier, p.priceString]));
}

/** Buys one shop item. The webhook records it on the server (shop_purchases). */
export async function purchaseShopItem(
  userId: string,
  productId: string,
): Promise<'bought' | 'cancelled'> {
  if (!(await ensureRevenueCat(userId))) throw new Error('payments_unavailable');
  const [product] = await Purchases.getProducts(
    [productId],
    Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  if (!product) throw new Error('product_unavailable');
  try {
    await Purchases.purchaseStoreProduct(product);
    return 'bought';
  } catch (err) {
    if ((err as { userCancelled?: boolean | null }).userCancelled) return 'cancelled';
    throw err;
  }
}
