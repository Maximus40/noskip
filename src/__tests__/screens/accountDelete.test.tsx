import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AccountDeleteScreen from '@/app/account-delete';

const mockDelete = jest.fn();
let mockEntitlement = { active: true, isPayer: true };

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/features/account/api', () => ({
  useDeleteAccount: () => ({ mutateAsync: mockDelete, isPending: false, error: null }),
}));
jest.mock('@/features/subscriptions/api', () => ({
  paymentsAvailable: () => true,
  useEntitlement: () => ({ data: mockEntitlement }),
}));

describe('account deletion', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    (router.replace as jest.Mock).mockReset();
  });

  it('stays locked until SUPPRIMER is typed, then deletes and leaves', async () => {
    mockDelete.mockResolvedValue(undefined);
    await render(<AccountDeleteScreen />);
    const button = screen.getByRole('button', { name: 'Supprimer définitivement' });
    await fireEvent.press(button);
    expect(mockDelete).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Tape SUPPRIMER pour confirmer'), 'supprimer');
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer définitivement' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('warns a paying player that the store subscription is not cancelled', async () => {
    await render(<AccountDeleteScreen />);
    expect(screen.getByText('Ton abonnement n’est pas résilié automatiquement.')).toBeTruthy();
    mockEntitlement = { active: true, isPayer: false };
    await render(<AccountDeleteScreen />);
    expect(screen.queryByText('Ton abonnement n’est pas résilié automatiquement.')).toBeNull();
  });
});
