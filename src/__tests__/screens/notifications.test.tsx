import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import NotificationsStep from '@/app/(onboarding)/notifications';
import { readLocalOnboarding } from '@/features/onboarding/localStore';

const mockRegister = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
jest.mock('@/features/notifications/push', () => ({
  registerForPush: (ask: boolean) => mockRegister(ask),
}));

function renderStep() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: 0, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationsStep />
    </QueryClientProvider>,
  );
}

describe('notifications step', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    (router.replace as jest.Mock).mockReset();
  });

  it('asks the OS, then moves on whatever the answer', async () => {
    mockRegister.mockResolvedValue({ status: 'denied' });
    await renderStep();
    expect(screen.getByLabelText('Spot : Sofiane te spot : bouge à la salle !')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Activer les notifs' }));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(true));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'), { timeout: 5000 });
    expect((await readLocalOnboarding()).notificationsAsked).toBe(true);
  });

  it('"Plus tard" skips the prompt', async () => {
    await renderStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Plus tard' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'), { timeout: 5000 });
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
