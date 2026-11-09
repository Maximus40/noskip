import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
// Registers the geofence / resume background tasks before any event is delivered.
import '@/features/checkin/tasks';
import { configureNotifications } from '@/features/notifications/push';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme/tokens';
import { fontFiles } from '@/theme/typography';

SplashScreen.preventAutoHideAsync();
configureNotifications();

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
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
              >
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
                <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
                <Stack.Screen name="auth-callback" options={{ animation: 'fade' }} />
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
                <Stack.Screen name="join/[code]" />
                <Stack.Screen name="team-new" options={{ presentation: 'modal' }} />
                <Stack.Screen name="team-manage/[id]" />
                <Stack.Screen name="my-data" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="terms" />
                <Stack.Screen name="dev" />
                <Stack.Screen name="dev-gallery" />
                <Stack.Screen name="dev-poster" />
                <Stack.Screen name="dev-lifter" />
              </Stack>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
