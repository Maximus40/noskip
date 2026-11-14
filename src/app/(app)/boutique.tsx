import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { ShopView } from '@/components/ShopView';
import {
  type PlateSkin,
  type PosterStyle,
  SHOP_CATALOG_VERSION,
  type ShopItem,
} from '@/domain/shop';
import { useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import {
  useBuyShopItem,
  useEquipPoster,
  useEquipSkin,
  useMyShop,
  useShopPrices,
} from '@/features/shop/api';
import { paymentsAvailable, useRestore } from '@/features/subscriptions/api';
import { toUserMessage } from '@/lib/errors';

/**
 * La boutique: one-time cosmetic purchases (premium SKIP cards imposed on teammates, plate skins
 * seen by the whole team, packs of SKIP lines for the team's Sunday cards). Never anything that changes the game.
 */
export default function ShopScreen() {
  const saveLocal = useUpdateLocalOnboarding();
  // Opening the tab clears its "new items" dot.
  useFocusEffect(
    useCallback(() => {
      saveLocal.mutate({ shopSeenVersion: SHOP_CATALOG_VERSION });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const shop = useMyShop();
  const prices = useShopPrices();
  const buy = useBuyShopItem();
  const equip = useEquipSkin();
  const equipPoster = useEquipPoster();
  const restore = useRestore();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owned = shop.data?.owned ?? new Set<string>();
  const equipped = shop.data?.equipped ?? 'classic';
  const poster = shop.data?.poster ?? 'classic';

  async function onBuy(item: ShopItem) {
    setError(null);
    setMessage(null);
    try {
      const result = await buy.mutateAsync(item.productId);
      if (result === 'bought') {
        setMessage(
          item.kind === 'pack'
            ? `${item.title} : achat validé. Ses vannes rejoignent les cartes SKIP de ta team.`
            : `${item.title} : achat validé. Ça arrive dans quelques secondes, puis touche « Équiper ».`,
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

  async function onEquipPoster(style: PosterStyle) {
    setError(null);
    try {
      await equipPoster.mutateAsync(style);
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
      poster={poster}
      prices={prices.data ?? {}}
      paymentsReady={paymentsAvailable()}
      buyBusy={buy.isPending}
      equipBusy={equip.isPending || equipPoster.isPending}
      message={message}
      error={error}
      onBuy={onBuy}
      onEquip={onEquip}
      onEquipPoster={onEquipPoster}
      onRestore={onRestore}
    />
  );
}
