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

const mockHasPro = { data: false };

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { weekly_goal: 3 } }),
}));
jest.mock('@/features/subscriptions/trialReminder', () => ({
  canNotify: () => Promise.resolve(true),
  scheduleTrialReminder: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/features/subscriptions/api', () => ({
  paymentsAvailable: () => true,
  setDevProBypass: jest.fn(),
  useHasPro: () => mockHasPro,
  usePlans: () => ({
    isLoading: false,
    error: null,
    data: {
      solo: [
        option('annual', 59.99, '59,99 €', 'P1Y', 7),
        option('weekly', 4.99, '4,99 €', 'P1W', 3),
      ],
      friends: [option('team', 149.99, '149,99 €', 'P1Y', null)],
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
    mockHasPro.data = false;
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

  it('says the plan covers the teammates', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByText('Un pote paie, toute la team joue')).toBeTruthy();
    expect(
      screen.getByText('Ton abonnement couvre aussi Karim : ça ne lui coûte rien.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Pack Duo/)).toBeNull();
  });

  it('the Team plan covers the shown team', async () => {
    mockBuy.mockResolvedValue('unlocked');
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Plus de 4 joueurs ?' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Team, 149,99 €/an' }));
    await fireEvent.press(screen.getByRole('button', { name: "C'EST PARTI" }));
    await waitFor(() => expect(mockBuy).toHaveBeenCalled());
    expect(mockBuy.mock.calls[0][0]).toMatchObject({ teamId: 'team-1' });
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

  it('hard paywall has no way out; a player who already has access can close it', async () => {
    await render(<PaywallScreen />);
    expect(screen.queryByRole('link', { name: 'Fermer' })).toBeNull();
    mockHasPro.data = true;
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Fermer' }));
    expect(router.back).toHaveBeenCalled();
  });
});
