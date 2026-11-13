import { Redirect, useLocalSearchParams } from 'expo-router';

import { ShopView } from '@/components/ShopView';

const PRICES = {
  'noskip.shop.skin.gold': '1,99 €',
  'noskip.shop.skin.carbon': '1,99 €',
  'noskip.shop.skin.chrome': '1,99 €',
  'noskip.shop.pack.foot': '0,99 €',
  'noskip.shop.pack.gaming': '0,99 €',
};

/**
 * Development only: the shop with sample store prices, for visual QA and the App Store review
 * screenshots. `?owned=1`: gold skin worn and Foot pack unlocked.
 */
export default function DevShop() {
  const owned = useLocalSearchParams<{ owned?: string }>().owned === '1';
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ShopView
      owned={new Set(owned ? ['noskip.shop.skin.gold', 'noskip.shop.pack.foot'] : [])}
      equipped={owned ? 'gold' : 'classic'}
      prices={PRICES}
      paymentsReady
      buyBusy={false}
      equipBusy={false}
      message={null}
      error={null}
      onBuy={() => undefined}
      onEquip={() => undefined}
      onRestore={() => undefined}
      onClose={() => undefined}
    />
  );
}
