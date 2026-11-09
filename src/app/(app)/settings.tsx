import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ToggleRow } from '@/components/ui/ToggleRow';
import {
  isPrefOn,
  NOTIFICATION_PREFS,
  type NotificationPrefKey,
  withPref,
} from '@/domain/notifications';
import { signOut } from '@/features/auth/signIn';
import { notificationPermission, registerForPush } from '@/features/notifications/push';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import {
  type Entitlement,
  paymentsAvailable,
  useEntitlement,
  useRestore,
} from '@/features/subscriptions/api';
import { manageSubscription } from '@/features/subscriptions/revenuecat';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

type Permission = 'granted' | 'denied' | 'undetermined' | null;

/** Réglages : notifications par type, sons et vibrations, compte. */
export default function SettingsScreen() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const [permission, setPermission] = useState<Permission>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      notificationPermission().then(setPermission);
    }, []),
  );

  async function save(patch: Parameters<typeof update.mutateAsync>[0]) {
    setError(null);
    try {
      await update.mutateAsync(patch);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  const togglePref = (key: NotificationPrefKey, on: boolean) =>
    save({ notification_prefs: withPref(profile.data?.notification_prefs, key, on) as never });

  async function enablePush() {
    const result = await registerForPush(true);
    setPermission(await notificationPermission());
    if (result.status === 'denied') Linking.openSettings();
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="label" color={colors.accent}>
          Réglages
        </Text>
        <Text variant="title" accessibilityRole="header">
          Tes réglages.
        </Text>
      </View>

      {!profile.data ? (
        profile.isError ? null : (
          <View style={styles.gap}>
            <Skeleton height={320} />
            <Skeleton height={140} />
          </View>
        )
      ) : (
        <>
          <View style={styles.card}>
            <Text variant="caption" color={colors.muted}>
              Notifications
            </Text>
            {permission !== null && permission !== 'granted' ? (
              <View style={styles.notice}>
                <Text variant="body">
                  {permission === 'denied'
                    ? 'Les notifs sont coupées dans les réglages du téléphone. Ta team ne peut pas te spotter.'
                    : 'Les notifs ne sont pas encore activées.'}
                </Text>
                <Button
                  label={permission === 'denied' ? 'Ouvrir les réglages' : 'Activer les notifs'}
                  variant="secondary"
                  withArrow={false}
                  onPress={permission === 'denied' ? () => Linking.openSettings() : enablePush}
                />
              </View>
            ) : null}
            {NOTIFICATION_PREFS.map((p) => (
              <ToggleRow
                key={p.key}
                label={p.label}
                detail={p.detail}
                value={isPrefOn(profile.data?.notification_prefs, p.key)}
                disabled={update.isPending}
                onChange={(on) => togglePref(p.key, on)}
              />
            ))}
          </View>

          <SubscriptionCard onError={setError} />

          <View style={styles.card}>
            <Text variant="caption" color={colors.muted}>
              Sons et vibrations
            </Text>
            <ToggleRow
              label="Sons"
              detail="Le clang du disque, la craie du PR, le ricanement du Canap'."
              value={profile.data.sound_enabled}
              disabled={update.isPending}
              onChange={(on) => save({ sound_enabled: on })}
            />
            <ToggleRow
              label="Vibrations"
              detail="Le choc du disque qui se charge."
              value={profile.data.haptics_enabled}
              disabled={update.isPending}
              onChange={(on) => save({ haptics_enabled: on })}
            />
          </View>
        </>
      )}

      <ErrorNote message={error ?? (profile.error ? toUserMessage(profile.error) : null)} />

      <Button label="Se déconnecter" variant="ghost" withArrow={false} onPress={() => signOut()} />
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function planLine(e: Entitlement): string {
  if (!e.active) return 'Pas d’abonnement actif.';
  const until = e.expiresAt
    ? ` · jusqu’au ${new Date(e.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : '';
  if (e.offeredBy) {
    return e.source === 'team'
      ? `Offre Team de « ${e.teamName ?? 'ta team'} », offerte par ${e.offeredBy}${until}`
      : `Pack Duo offert par ${e.offeredBy}${until}`;
  }
  const names = { individual: 'NoSkip Pro', duo: 'Pack Duo', team: 'Offre Team' } as const;
  return `${e.source ? names[e.source] : 'NoSkip Pro'}${until}`;
}

function SubscriptionCard({ onError }: { onError: (m: string | null) => void }) {
  const entitlement = useEntitlement();
  const restore = useRestore();
  const canManage = paymentsAvailable() && Boolean(entitlement.data?.isPayer);

  async function onRestore() {
    onError(null);
    try {
      const ok = await restore.mutateAsync();
      if (!ok) onError('Aucun abonnement actif trouvé sur ce compte store.');
    } catch (err) {
      onError(toUserMessage(err));
    }
  }

  return (
    <View style={styles.card}>
      <Text variant="caption" color={colors.muted}>
        Abonnement
      </Text>
      <Text variant="bodyStrong">{entitlement.data ? planLine(entitlement.data) : '…'}</Text>
      {canManage ? (
        <Button
          label="Gérer mon abonnement"
          variant="secondary"
          withArrow={false}
          onPress={() => manageSubscription().catch((err) => onError(toUserMessage(err)))}
        />
      ) : null}
      {paymentsAvailable() ? (
        <Button
          label="Restaurer mes achats"
          variant="ghost"
          withArrow={false}
          disabled={restore.isPending}
          onPress={onRestore}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  gap: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  notice: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bottomSpace: { height: 96 },
});
