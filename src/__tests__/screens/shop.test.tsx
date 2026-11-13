import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ShopScreen from '@/app/shop';

const mockBuy = jest.fn();
const mockEquip = jest.fn();
let mockShop = { owned: new Set<string>(), equipped: 'classic' };

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/features/shop/api', () => ({
  useMyShop: () => ({ data: mockShop, refetch: jest.fn() }),
  useShopPrices: () => ({
    data: {
      'noskip.shop.skin.gold': '1,99 €',
      'noskip.shop.skin.carbon': '1,99 €',
      'noskip.shop.skin.chrome': '1,99 €',
      'noskip.shop.pack.foot': '0,99 €',
      'noskip.shop.pack.gaming': '0,99 €',
    },
  }),
  useBuyShopItem: () => ({ mutateAsync: mockBuy, isPending: false }),
  useEquipSkin: () => ({ mutateAsync: mockEquip, isPending: false }),
}));
jest.mock('@/features/subscriptions/api', () => ({
  paymentsAvailable: () => true,
  useRestore: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

describe('shop', () => {
  beforeEach(() => {
    mockBuy.mockReset();
    mockEquip.mockReset();
    mockShop = { owned: new Set<string>(), equipped: 'classic' };
  });

  it('sells cosmetics only, with store prices, and buys the chosen item', async () => {
    mockBuy.mockResolvedValue('bought');
    await render(<ShopScreen />);
    expect(screen.getByText('DU STYLE. ZÉRO TRICHE.')).toBeTruthy();
    expect(screen.getByText(/rien ne s’achète pour gagner/)).toBeTruthy();
    const goldPrice = screen.getAllByRole('button', { name: '1,99 €' })[0];
    await fireEvent.press(goldPrice);
    await waitFor(() => expect(mockBuy).toHaveBeenCalledWith('noskip.shop.skin.gold'));
    expect(await screen.findByText(/Disques Or : achat validé/)).toBeTruthy();
  });

  it('an owned skin can be worn, a worn one shows « Équipé », an owned pack is unlocked', async () => {
    mockShop = {
      owned: new Set(['noskip.shop.skin.gold', 'noskip.shop.skin.carbon', 'noskip.shop.pack.foot']),
      equipped: 'gold',
    };
    await render(<ShopScreen />);
    expect(screen.getByText('Équipé')).toBeTruthy();
    expect(screen.getByText('Débloqué pour ta team')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Équiper' })[1]);
    expect(mockEquip).toHaveBeenCalledWith('carbon');
  });
});
