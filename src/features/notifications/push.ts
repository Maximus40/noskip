import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { db } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

const TOKEN_KEY = 'noskip.push.token.v1';

export type PushRegistration =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: 'web' | 'simulator' | 'no_project_id' }
  | { status: 'error'; message: string };

/** Foreground behaviour + Android channel. Called once at startup. */
export function configureNotifications(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'NoSkip',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: colors.accent,
    }).catch(() => undefined);
  }
}

/** EAS project id: required by Expo to issue push tokens (set once the EAS project exists). */
export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Gets the Expo push token and saves it for the signed-in player.
 * `ask`: show the OS prompt if not decided yet (onboarding step 9 / settings), otherwise only
 * refresh silently (app start, back to foreground).
 */
export async function registerForPush(ask: boolean): Promise<PushRegistration> {
  if (Platform.OS === 'web') return { status: 'unavailable', reason: 'web' };
  if (!Device.isDevice) return { status: 'unavailable', reason: 'simulator' };
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) {
      ({ status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      }));
    }
    if (status !== 'granted') return { status: 'denied' };
    const projectId = easProjectId();
    if (!projectId) return { status: 'unavailable', reason: 'no_project_id' };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await db().rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw error;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return { status: 'registered', token };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'unknown' };
  }
}

/** On sign-out: this phone must stop receiving the player's notifications. */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await db().from('push_tokens').delete().eq('token', token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best effort: the server also drops tokens Expo reports as unregistered.
  }
}
