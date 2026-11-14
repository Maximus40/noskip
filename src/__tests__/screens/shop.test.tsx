import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ShopScreen from '@/app/(app)/boutique';

const mockBuy = jest.fn();
const mockEquip = jest.fn();
const mockEquipPoster = jest.fn();
let mockShop = { owned: new Set<string>(), equipped: 'classic', poster: 'classic' };

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}));
jest.mock('@/features/onboarding/localStore', () => ({
  useUpdateLocalOnboarding: () => ({ mutate: jest.fn() }),
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
      'noskip.shop.poster.gold': '1,99 €',
      'noskip.shop.poster.redcard': '1,99 €',
      'noskip.shop.poster.gameover': '1,99 €',
      'noskip.shop.poster.wanted': '1,99 €',
      'noskip.shop.poster.news': '1,99 €',
      'noskip.shop.poster.warrior': '1,99 €',
      'noskip.shop.poster.magazine': '1,99 €',
      'noskip.shop.poster.neon': '1,99 €',
      'noskip.shop.poster.zen': '1,99 €',
      'noskip.shop.poster.all': '4,99 €',
    },
  }),
  useBuyShopItem: () => ({ mutateAsync: mockBuy, isPending: false }),
  useEquipSkin: () => ({ mutateAsync: mockEquip, isPending: false }),
  useEquipPoster: () => ({ mutateAsync: mockEquipPoster, isPending: false }),
}));
jest.mock('@/features/subscriptions/api', () => ({
  paymentsAvailable: () => true,
  useRestore: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

describe('shop', () => {
  beforeEach(() => {
    mockBuy.mockReset();
    mockEquip.mockReset();
    mockEquipPoster.mockReset();
    mockShop = { owned: new Set<string>(), equipped: 'classic', poster: 'classic' };
  });

  it('sells cosmetics only, with store prices, and buys the chosen item', async () => {
    mockBuy.mockResolvedValue('bought');
    await render(<ShopScreen />);
    expect(screen.getByText('DU STYLE. ZÉRO TRICHE.')).toBeTruthy();
    expect(screen.getByText(/rien ne s’achète pour gagner/)).toBeTruthy();
    // The 9 premium cards come first, then the skins.
    const goldPrice = screen.getAllByRole('button', { name: '1,99 €' })[9];
    await fireEvent.press(goldPrice);
    await waitFor(() => expect(mockBuy).toHaveBeenCalledWith('noskip.shop.skin.gold'));
    expect(await screen.findByText(/Disques Or : achat validé/)).toBeTruthy();
  });

  it('an owned skin can be worn, a worn one shows « Équipé », an owned pack is unlocked', async () => {
    mockShop = {
      owned: new Set(['noskip.shop.skin.gold', 'noskip.shop.skin.carbon', 'noskip.shop.pack.foot']),
      equipped: 'gold',
      poster: 'classic',
    };
    await render(<ShopScreen />);
    expect(screen.getByText('Équipé')).toBeTruthy();
    expect(screen.getByText('Débloqué pour ta team')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Équiper' })[1]);
    expect(mockEquip).toHaveBeenCalledWith('carbon');
  });

  it('sells premium SKIP cards one by one or as a pack of five', async () => {
    mockBuy.mockResolvedValue('bought');
    await render(<ShopScreen />);
    expect(screen.getByText('Cartes SKIP premium')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '1,99 €' })).toHaveLength(12);
    await fireEvent.press(screen.getByRole('button', { name: '4,99 €' }));
    await waitFor(() => expect(mockBuy).toHaveBeenCalledWith('noskip.shop.poster.all'));
  });

  it('with the pack, any card can be equipped, the worn one shows « Équipée »', async () => {
    mockShop = {
      owned: new Set(['noskip.shop.poster.all']),
      equipped: 'classic',
      poster: 'wanted',
    };
    await render(<ShopScreen />);
    expect(screen.getByText('Équipée')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '4,99 €' })).toBeNull();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Équiper' })[0]);
    expect(mockEquipPoster).toHaveBeenCalledWith('gold');
    await fireEvent.press(screen.getByRole('button', { name: 'Remettre la carte classique' }));
    expect(mockEquipPoster).toHaveBeenCalledWith('classic');
  });
});
