import { Redirect, useLocalSearchParams } from 'expo-router';

import { ShopView } from '@/components/ShopView';

const PRICES = {
  'noskip.shop.skin.gold': '1,99 €',
  'noskip.shop.skin.carbon': '1,99 €',
  'noskip.shop.skin.chrome': '1,99 €',
  'noskip.shop.pack.foot': '0,99 €',
  'noskip.shop.pack.gaming': '0,99 €',
  'noskip.shop.poster.gold': '1,99 €',
  'noskip.shop.poster.redcard': '1,99 €',
  'noskip.shop.poster.gameover': '1,99 €',
  'noskip.shop.poster.wanted': '1,99 €',
  'noskip.shop.poster.news': '1,99 €',
  'noskip.shop.poster.all': '4,99 €',
};

/**
 * Development only: the shop with sample store prices, for visual QA and the App Store review
 * screenshots. `?owned=1`: gold skin worn, Foot pack unlocked, Game Over card equipped.
 */
export default function DevShop() {
  const owned = useLocalSearchParams<{ owned?: string }>().owned === '1';
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ShopView
      owned={
        new Set(
          owned
            ? ['noskip.shop.skin.gold', 'noskip.shop.pack.foot', 'noskip.shop.poster.gameover']
            : [],
        )
      }
      equipped={owned ? 'gold' : 'classic'}
      poster={owned ? 'gameover' : 'classic'}
      prices={PRICES}
      paymentsReady
      buyBusy={false}
      equipBusy={false}
      message={null}
      error={null}
      onBuy={() => undefined}
      onEquip={() => undefined}
      onEquipPoster={() => undefined}
      onRestore={() => undefined}
      onClose={() => undefined}
    />
  );
}
