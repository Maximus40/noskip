import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import HookStep from '@/app/(onboarding)/hook';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: 0, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HookStep />
    </QueryClientProvider>,
  );
}

describe('onboarding hook step', () => {
  it('reacts to the answers and stores them on the device', async () => {
    await renderWithClient();
    expect(screen.getByText("7 séances offertes au Canap'. Ça s'arrête là.")).toBeTruthy();

    const done = screen.getByRole('adjustable', { name: 'Faites' });
    await fireEvent(done, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText("6 séances offertes au Canap'. Ça s'arrête là.")).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: "C'est parti" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'), { timeout: 5000 });
    const stored = JSON.parse((await AsyncStorage.getItem('noskip.onboarding.v1')) ?? '{}');
    expect(stored.hook).toEqual({ planned: 12, done: 6 });
  });

  it('shows how many steps are left', async () => {
    await renderWithClient();
    expect(screen.getByRole('progressbar', { name: 'Encore 10 étapes' })).toBeTruthy();
  });
});
