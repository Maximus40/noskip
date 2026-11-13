import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import RulesStep from '@/app/(onboarding)/rules';

const mockRpc = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
jest.mock('@/features/auth/AuthProvider', () => ({
  useUserId: () => 'user-1',
  // Signed-out frame: the progress counts every following step.
  useAuth: () => ({ session: null }),
}));
jest.mock('@/lib/supabase', () => ({ db: () => ({ rpc: mockRpc }) }));

function renderStep() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: 0, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RulesStep />
    </QueryClientProvider>,
  );
}

describe('team rules step', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    (router.replace as jest.Mock).mockReset();
  });

  it('requires the explicit checkbox before signing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await renderStep();
    const sign = screen.getByRole('button', { name: 'Je signe' });
    await fireEvent.press(sign);
    expect(mockRpc).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole('checkbox', { name: "J'accepte d'être chambré par le Canap' si je skip." }),
    );
    await fireEvent.press(sign);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('accept_all_team_rules'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('shows a French error when the server refuses', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_authenticated' } });
    await renderStep();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: "J'accepte d'être chambré par le Canap' si je skip." }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Je signe' }));
    expect(await screen.findByText('Ta session a expiré. Reconnecte-toi.')).toBeTruthy();
  });
});
