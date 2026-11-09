import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

/** Online unless the OS says the network or the internet is down (unknown counts as online). */
export function isOnline(state: { isConnected?: boolean; isInternetReachable?: boolean }): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Feeds the OS network state to TanStack Query: queries pause offline and refetch as soon as
 * the connection comes back (instead of failing one after the other).
 */
export function wireOnlineManager(): void {
  if (Platform.OS === 'web') return;
  onlineManager.setEventListener((setOnline) => {
    Network.getNetworkStateAsync()
      .then((s) => setOnline(isOnline(s)))
      .catch(() => undefined);
    const sub = Network.addNetworkStateListener((s) => setOnline(isOnline(s)));
    return () => sub.remove();
  });
}
