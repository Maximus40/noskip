import * as Notifications from 'expo-notifications';

import { APP_NAME } from '../../../content/brand';
import { trialReminderDay } from '@/domain/paywall';

/** Notifications allowed on this phone (the trial timeline only promises a notif if so). */
export async function canNotify(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Local reminder 2 days before the end of a free trial, as the paywall promises. Scheduled on
 * the phone at purchase time (nothing leaves it). Never throws: a missed reminder must not fail
 * the purchase.
 */
export async function scheduleTrialReminder(days: number, now = Date.now()): Promise<void> {
  if (!(await canNotify())) return;
  const day = trialReminderDay(days);
  const left = days - day;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: APP_NAME,
      body: `Ton essai gratuit se termine dans ${left} jour${left > 1 ? 's' : ''}. Rien à faire pour continuer. Pour arrêter : Réglages → Abonnement.`,
      data: { type: 'trial_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(now + day * 86_400_000),
    },
  }).catch(() => undefined);
}
