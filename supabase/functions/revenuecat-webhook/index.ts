// revenuecat-webhook: RevenueCat → subscriptions / team_subscriptions (Pro, Team) and the shop
// (one-time purchases noskip.shop.* → shop_purchases).
// Authenticated with the Authorization header configured in RevenueCat (secret
// REVENUECAT_WEBHOOK_AUTH); deployed without JWT verification. Idempotent per event id.
import { adminClient, requireEnv } from '../_shared/auth.ts';
import { createHandler } from './handler.ts';
import { supabaseSubscriptionStore } from './store.ts';

const db = adminClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

Deno.serve(
  createHandler({
    authHeader: Deno.env.get('REVENUECAT_WEBHOOK_AUTH')?.trim() || null,
    store: supabaseSubscriptionStore(db),
  }),
);
