import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  isPlateSkin,
  isPosterStyle,
  type PlateSkin,
  type PosterStyle,
  SHOP_PRODUCT_IDS,
} from '@/domain/shop';
import { useUserId } from '@/features/auth/AuthProvider';
import { WEBHOOK_FOLLOW_UPS_MS, paymentsAvailable } from '@/features/subscriptions/api';
import { loadShopPrices, purchaseShopItem } from '@/features/subscriptions/revenuecat';
import { db } from '@/lib/supabase';

export const myShopKey = (uid: string) => ['my-shop', uid] as const;
export const teamSkinsKey = (teamId: string) => ['team-skins', teamId] as const;

export type MyShop = { owned: ReadonlySet<string>; equipped: PlateSkin; poster: PosterStyle };

/** What I bought (server truth, written by the RevenueCat webhook), my skin and poster style. */
export function useMyShop() {
  const uid = useUserId();
  return useQuery({
    queryKey: myShopKey(uid),
    queryFn: async (): Promise<MyShop> => {
      const [shop, profile] = await Promise.all([
        db().rpc('my_shop'),
        db().from('profiles').select('poster_style').eq('id', uid).maybeSingle(),
      ]);
      if (shop.error) throw shop.error;
      if (profile.error) throw profile.error;
      const rows = shop.data ?? [];
      const equipped = rows[0]?.equipped_skin;
      const poster = profile.data?.poster_style;
      return {
        owned: new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id))),
        equipped: isPlateSkin(equipped) ? equipped : 'classic',
        poster: isPosterStyle(poster) ? poster : 'classic',
      };
    },
  });
}

/** Skins worn by the members of a team: the bar draws them for everyone. */
export function useTeamSkins(teamId: string | undefined) {
  return useQuery({
    queryKey: teamSkinsKey(teamId ?? 'none'),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<Record<string, PlateSkin>> => {
      const { data, error } = await db().rpc('team_cosmetics', { p_team: teamId! });
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((r) => [r.user_id, isPlateSkin(r.plate_skin) ? r.plate_skin : 'classic']),
      );
    },
  });
}

export function useEquipSkin() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skin: PlateSkin) => {
      const { error } = await db().rpc('equip_plate_skin', { p_skin: skin });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myShopKey(uid) });
      qc.invalidateQueries({ queryKey: ['team-skins'] });
    },
  });
}

/** The SKIP poster style I impose on my teammates' cards. */
export function useEquipPoster() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (style: PosterStyle) => {
      const { error } = await db().rpc('equip_poster_style', { p_style: style });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: myShopKey(uid) }),
  });
}

/** Store prices (null when payments are not set up in this build). */
export function useShopPrices() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['shop-prices', uid],
    enabled: paymentsAvailable(),
    staleTime: 10 * 60_000,
    queryFn: () => loadShopPrices(uid, SHOP_PRODUCT_IDS),
  });
}

export function useBuyShopItem() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => purchaseShopItem(uid, productId),
    onSuccess: (result) => {
      if (result !== 'bought') return;
      // The store confirms before RevenueCat's webhook reaches the server: re-read a few times.
      const refresh = () => qc.invalidateQueries({ queryKey: myShopKey(uid) });
      refresh();
      for (const ms of WEBHOOK_FOLLOW_UPS_MS) setTimeout(refresh, ms);
    },
  });
}
