import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import PaywallScreen from '@/app/paywall';

const mockBuy = jest.fn();
const mockRestore = jest.fn();

const option = (
  key: string,
  price: number,
  priceString: string,
  period: string,
  trialDays: number | null,
) => ({
  key,
  pkg: {},
  price,
  priceString,
  currency: 'EUR',
  period,
  trialDays,
});

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/features/subscriptions/api', () => ({
  paymentsAvailable: () => true,
  setDevProBypass: jest.fn(),
  usePlans: () => ({
    isLoading: false,
    error: null,
    data: {
      solo: [
        option('annual', 59.99, '59,99 €', 'P1Y', 7),
        option('weekly', 4.99, '4,99 €', 'P1W', 3),
      ],
      friends: [
        option('duo', 89.99, '89,99 €', 'P1Y', null),
        option('team', 149.99, '149,99 €', 'P1Y', null),
      ],
    },
  }),
  usePurchase: () => ({ mutateAsync: mockBuy, isPending: false }),
  useRestore: () => ({ mutateAsync: mockRestore, isPending: false }),
}));
jest.mock('@/features/teams/api', () => ({
  useMyTeams: () => ({ data: [{ id: 'team-1', name: 'Les Déchaînés' }] }),
  useTeamBoard: () => ({
    data: [
      { user_id: 'me', pseudo: 'Sofiane', is_me: true },
      { user_id: 'karim', pseudo: 'Karim', is_me: false },
    ],
  }),
}));
jest.mock('@/features/teams/useBarState', () => ({
  useBarState: () => ({ kg: 40, plates: [], players: [], shaky: false, pr: false }),
}));

describe('paywall', () => {
  beforeEach(() => {
    mockBuy.mockReset();
    mockRestore.mockReset();
    (router.replace as jest.Mock).mockReset();
  });

  it('annual by default, with the weekly price and the trial', async () => {
    await render(<PaywallScreen />);
    expect(
      screen.getByRole('radio', { name: 'Annuel, 59,99 €/an, 7 jours gratuits' }).props
        .accessibilityState,
    ).toEqual({ checked: true });
    expect(screen.getByText('Soit 1,15 € par semaine')).toBeTruthy();
    expect(screen.getByText('Meilleure offre')).toBeTruthy();
    expect(
      screen.getByText(/^7 jours gratuits, puis 59,99 €\/an\. Renouvellement automatique/),
    ).toBeTruthy();
    expect(screen.queryByText(/sans payer/)).toBeNull();
  });

  it('buys the selected plan and unlocks the app', async () => {
    mockBuy.mockResolvedValue('unlocked');
    await render(<PaywallScreen />);
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Hebdo, 4,99 €/semaine, 3 jours gratuits' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: "COMMENCER L'ESSAI GRATUIT" }));
    await waitFor(() => expect(mockBuy).toHaveBeenCalled());
    expect(mockBuy.mock.calls[0][0].option.key).toBe('weekly');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('Pack Duo is offered to the chosen teammate', async () => {
    mockBuy.mockResolvedValue('unlocked');
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Avec tes potes' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Pack Duo, 89,99 €/an' }));
    expect(screen.getByRole('radio', { name: 'Offrir à Karim' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'PASSER EN MODE NOSKIP' }));
    await waitFor(() => expect(mockBuy).toHaveBeenCalled());
    expect(mockBuy.mock.calls[0][0]).toMatchObject({ partnerId: 'karim', teamId: null });
  });

  it('a cancelled purchase stays on the paywall; restore explains when nothing is found', async () => {
    mockBuy.mockResolvedValue('cancelled');
    mockRestore.mockResolvedValue(false);
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByRole('button', { name: "COMMENCER L'ESSAI GRATUIT" }));
    await waitFor(() => expect(mockBuy).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link', { name: 'Restaurer mes achats' }));
    await waitFor(() =>
      expect(screen.getByText('Aucun abonnement actif trouvé sur ce compte store.')).toBeTruthy(),
    );
  });
});
