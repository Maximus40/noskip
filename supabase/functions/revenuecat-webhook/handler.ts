import { z } from 'zod';

import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';

export type Plan = 'individual' | 'duo' | 'team';
export type SubStatus =
  'trialing' | 'active' | 'grace_period' | 'billing_issue' | 'cancelled' | 'expired';

export type ApplyArgs = {
  eventId: string;
  type: string;
  userId: string;
  plan: Plan;
  status: SubStatus;
  productId: string;
  expiresAt: string | null;
  eventAt: string;
  rcCustomerId: string;
  partnerId: string | null;
  teamId: string | null;
};

export type ShopArgs = {
  eventId: string;
  type: string;
  userId: string;
  productId: string;
  /** A refund (CANCELLATION of a one-time purchase) takes the item back. */
  revoke: boolean;
  eventAt: string;
};

export interface SubscriptionStore {
  apply(args: ApplyArgs): Promise<Record<string, unknown>>;
  /** One-time shop purchases (noskip.shop.*): never touch the subscription tables. */
  applyShop(args: ShopArgs): Promise<Record<string, unknown>>;
}

/** Shop products are one-time purchases (skins, joke packs), never subscriptions. */
export const isShopProduct = (productId: string) => productId.startsWith('noskip.shop.');

/** RevenueCat event type for a shop product → grant, revoke or nothing. */
export function shopActionFor(type: string): 'grant' | 'revoke' | null {
  if (type === 'NON_RENEWING_PURCHASE' || type === 'INITIAL_PURCHASE') return 'grant';
  if (type === 'CANCELLATION') return 'revoke';
  return null;
}

export type Deps = {
  /** Value configured in RevenueCat → Integrations → Webhooks → Authorization header. */
  authHeader: string | null;
  store: SubscriptionStore;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const attribute = z.object({ value: z.string() }).partial().passthrough();

export const eventSchema = z
  .object({
    event: z
      .object({
        id: z.string().min(1).max(200),
        type: z.string().min(1).max(60),
        app_user_id: z.string().max(200).optional(),
        original_app_user_id: z.string().max(200).optional(),
        aliases: z.array(z.string().max(200)).optional(),
        product_id: z.string().max(200).nullish(),
        new_product_id: z.string().max(200).nullish(),
        period_type: z.string().max(40).nullish(),
        expiration_at_ms: z.number().nullish(),
        event_timestamp_ms: z.number().nullish(),
        subscriber_attributes: z.record(z.string(), attribute).nullish(),
      })
      .passthrough(),
  })
  .passthrough();

/** Product ids carry the plan: noskip.pro.*, noskip.duo.*, noskip.team.* (see README). */
export function planForProduct(productId: string): Plan {
  const id = productId.toLowerCase();
  if (id.includes('team')) return 'team';
  if (id.includes('duo')) return 'duo';
  return 'individual';
}

const GRANTING = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'NON_RENEWING_PURCHASE',
]);

/** RevenueCat event type → stored status (null: nothing to store). */
export function statusFor(type: string, periodType: string | null | undefined): SubStatus | null {
  if (GRANTING.has(type)) return periodType === 'TRIAL' ? 'trialing' : 'active';
  if (type === 'CANCELLATION') return 'cancelled';
  if (type === 'BILLING_ISSUE') return 'billing_issue';
  if (type === 'EXPIRATION') return 'expired';
  return null;
}

/** Our app user id is the Supabase user uuid (Purchases.logIn); anonymous ids are skipped. */
export function pickUserId(ids: (string | undefined)[]): string | null {
  return ids.find((id): id is string => typeof id === 'string' && UUID.test(id)) ?? null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      if (!deps.authHeader) throw new HttpError(503, 'webhook_not_configured');
      const given = req.headers.get('Authorization') ?? '';
      if (!safeEqual(given, deps.authHeader)) throw new HttpError(401, 'not_authorized');

      const parsed = eventSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const e = parsed.data.event;

      const productId = e.new_product_id ?? e.product_id ?? null;
      if (productId && isShopProduct(productId)) {
        const action = shopActionFor(e.type);
        const buyer = pickUserId([e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])]);
        if (!action || !buyer) {
          log('info', 'revenuecat-webhook', 'skipped', { type: e.type, shop: true });
          return json({ skipped: action ? 'anonymous_user' : e.type });
        }
        const result = await deps.store.applyShop({
          eventId: e.id,
          type: e.type,
          userId: buyer,
          productId,
          revoke: action === 'revoke',
          eventAt: new Date(e.event_timestamp_ms ?? Date.now()).toISOString(),
        });
        log('info', 'revenuecat-webhook', 'applied', { type: e.type, ...result });
        return json(result);
      }

      const status = statusFor(e.type, e.period_type);
      if (!status || !productId) {
        // TEST, TRANSFER, SUBSCRIPTION_PAUSED…: acknowledged, nothing to store.
        log('info', 'revenuecat-webhook', 'skipped', { type: e.type });
        return json({ skipped: e.type });
      }
      const userId = pickUserId([e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])]);
      if (!userId) {
        log('warn', 'revenuecat-webhook', 'anonymous_user', { type: e.type });
        return json({ skipped: 'anonymous_user' });
      }
      const attr = (key: string) => {
        const v = e.subscriber_attributes?.[key]?.value;
        return v && UUID.test(v) ? v : null;
      };

      const result = await deps.store.apply({
        eventId: e.id,
        type: e.type,
        userId,
        plan: planForProduct(productId),
        status,
        productId,
        expiresAt: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
        eventAt: new Date(e.event_timestamp_ms ?? Date.now()).toISOString(),
        rcCustomerId: e.original_app_user_id ?? userId,
        partnerId: attr('noskip_duo_partner'),
        teamId: attr('noskip_team_id'),
      });
      log('info', 'revenuecat-webhook', 'applied', { type: e.type, ...result });
      return json(result);
    } catch (err) {
      return errorResponse(err, 'revenuecat-webhook');
    }
  };
}
