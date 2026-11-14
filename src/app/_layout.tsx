import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
// Registers the geofence / resume background tasks before any event is delivered.
import '@/features/checkin/tasks';
import { configureNotifications } from '@/features/notifications/push';
import { wireOnlineManager } from '@/lib/network';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme/tokens';
import { fontFiles } from '@/theme/typography';

SplashScreen.preventAutoHideAsync();
configureNotifications();
wireOnlineManager();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.offWhite,
    border: colors.glassBorder,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style="light" />
              <RootStack />
              <OfflineBanner />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Screens that need a signed-in player sit behind Stack.Protected: when the session ends
 * (sign-out, account deletion), they unmount and the router goes back to the gate (index)
 * instead of rendering once without a session. Kept open while the session is loading, so a
 * cold start on a deep link is not bounced.
 */
function RootStack() {
  const { session, loading } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth-callback" options={{ animation: 'fade' }} />
      <Stack.Screen name="join/[code]" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="legal-notice" />
      <Stack.Screen name="dev-gallery" />
      <Stack.Screen name="dev-poster" />
      <Stack.Screen name="dev-lifter" />
      <Stack.Screen name="dev-paywall" />
      <Stack.Screen name="dev-welcome" />
      <Stack.Screen name="dev-tutorial" />
      <Stack.Screen name="dev-skins" />
      <Stack.Screen name="dev-shop" />
      <Stack.Screen name="dev-posters" />
      <Stack.Screen name="dev-promo" />
      <Stack.Protected guard={loading || session !== null}>
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        <Stack.Screen name="session" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="plate-loaded"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="skip/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="recap/[weekId]" />
        <Stack.Screen name="history" />
        <Stack.Screen name="lifter/[id]" />
        <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
        <Stack.Screen name="team-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="team-manage/[id]" />
        <Stack.Screen name="my-data" />
        <Stack.Screen name="account-delete" />
        <Stack.Screen name="dev" />
      </Stack.Protected>
    </Stack>
  );
}
