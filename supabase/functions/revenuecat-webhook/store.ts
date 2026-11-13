import type { SupabaseClient } from '@supabase/supabase-js';

import type { SubscriptionStore } from './handler.ts';

export function supabaseSubscriptionStore(db: SupabaseClient): SubscriptionStore {
  return {
    async apply(a) {
      const { data, error } = await db.rpc('svc_apply_rc_event', {
        p_event_id: a.eventId,
        p_type: a.type,
        p_user: a.userId,
        p_plan: a.plan,
        p_status: a.status,
        p_product: a.productId,
        p_expires: a.expiresAt,
        p_event_at: a.eventAt,
        p_rc_customer: a.rcCustomerId,
        p_partner: a.partnerId,
        p_team: a.teamId,
      });
      if (error) throw new Error(error.message);
      return (data ?? {}) as Record<string, unknown>;
    },
    async applyShop(a) {
      const { data, error } = await db.rpc('svc_apply_shop_event', {
        p_event_id: a.eventId,
        p_type: a.type,
        p_user: a.userId,
        p_product: a.productId,
        p_revoke: a.revoke,
        p_event_at: a.eventAt,
      });
      if (error) throw new Error(error.message);
      return (data ?? {}) as Record<string, unknown>;
    },
  };
}
