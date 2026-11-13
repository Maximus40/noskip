import { router } from 'expo-router';
import { useState } from 'react';

import { ShopView } from '@/components/ShopView';
import type { PlateSkin, ShopItem } from '@/domain/shop';
import { useBuyShopItem, useEquipSkin, useMyShop, useShopPrices } from '@/features/shop/api';
import { paymentsAvailable, useRestore } from '@/features/subscriptions/api';
import { toUserMessage } from '@/lib/errors';

/**
 * La boutique: one-time cosmetic purchases (plate skins seen by the whole team, packs of SKIP
 * lines for the team's Sunday cards). Never anything that changes the game.
 */
export default function ShopScreen() {
  const shop = useMyShop();
  const prices = useShopPrices();
  const buy = useBuyShopItem();
  const equip = useEquipSkin();
  const restore = useRestore();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owned = shop.data?.owned ?? new Set<string>();
  const equipped = shop.data?.equipped ?? 'classic';

  async function onBuy(item: ShopItem) {
    setError(null);
    setMessage(null);
    try {
      const result = await buy.mutateAsync(item.productId);
      if (result === 'bought') {
        setMessage(
          item.kind === 'skin'
            ? `${item.title} : achat validé. Il arrive dans quelques secondes, puis touche « Équiper ».`
            : `${item.title} : achat validé. Ses vannes rejoignent les cartes SKIP de ta team.`,
        );
      }
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function onEquip(skin: PlateSkin) {
    setError(null);
    try {
      await equip.mutateAsync(skin);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function onRestore() {
    setError(null);
    try {
      await restore.mutateAsync();
      await shop.refetch();
      setMessage('Achats restaurés.');
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  return (
    <ShopView
      owned={owned}
      equipped={equipped}
      prices={prices.data ?? {}}
      paymentsReady={paymentsAvailable()}
      buyBusy={buy.isPending}
      equipBusy={equip.isPending}
      message={message}
      error={error}
      onBuy={onBuy}
      onEquip={onEquip}
      onRestore={onRestore}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/lifter'))}
    />
  );
}
