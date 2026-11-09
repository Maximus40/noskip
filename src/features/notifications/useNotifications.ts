import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { routeForNotification } from '@/domain/notifications';
import { useAuth } from '@/features/auth/AuthProvider';

import { registerForPush } from './push';

/** Keeps the push token fresh (start + every return to foreground), never prompts. */
export function usePushRegistration() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    registerForPush(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') registerForPush(false);
    });
    return () => sub.remove();
  }, [userId]);
}

/**
 * Opens the right screen when a notification is tapped (app running or cold start), and
 * refreshes the bar when a game notification arrives while the app is open.
 */
export function useNotificationRouting() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!last || !userId) return;
    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const route = routeForNotification(last.notification.request.content.data, userId);
    if (route) router.push(route);
    Notifications.clearLastNotificationResponse();
  }, [last, userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const type = (n.request.content.data as { type?: unknown } | undefined)?.type;
      if (typeof type !== 'string') return;
      queryClient.invalidateQueries({ queryKey: ['team-board'] });
      if (type === 'recap' || type === 'skip' || type === 'team_pr') {
        queryClient.invalidateQueries({ queryKey: ['latest-closed-week'] });
      }
    });
    return () => sub.remove();
  }, [queryClient]);
}
