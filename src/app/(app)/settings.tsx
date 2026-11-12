import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { ListRow } from '@/components/ui/ListRow';
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
import {
  LIFTER_TITLES,
  useMyGyms,
  useProfile,
  useRemoveGym,
  useUpdateProfile,
} from '@/features/profile/api';
import {
  paymentsAvailable,
  setDevProBypass,
  type Entitlement,
  useEntitlement,
  useRestore,
} from '@/features/subscriptions/api';
import { manageSubscription } from '@/features/subscriptions/revenuecat';
import { toUserMessage } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { colors, radii, spacing } from '@/theme/tokens';
import { APP_NAME } from '../../../content/brand';

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
          <GameCard onError={setError} />

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

      <View style={styles.card}>
        <Text variant="caption" color={colors.muted}>
          Tes données
        </Text>
        <ListRow
          title="Ce qu’on stocke"
          subtitle="Et ce qu’on ne stocke jamais : ta position."
          onPress={() => router.push('/my-data')}
        />
        <ListRow title="Politique de confidentialité" onPress={() => router.push('/privacy')} />
        <ListRow title="Conditions d’utilisation" onPress={() => router.push('/terms')} />
      </View>

      <Button label="Se déconnecter" variant="ghost" withArrow={false} onPress={() => signOut()} />
      <Button
        label="Supprimer mon compte"
        variant="ghost"
        withArrow={false}
        onPress={() => router.push('/account-delete')}
      />
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

/** Ta carte, ton objectif, tes salles. */
function GameCard({ onError }: { onError: (m: string | null) => void }) {
  const profile = useProfile();
  const gyms = useMyGyms();
  const removeGym = useRemoveGym();
  const p = profile.data;
  if (!p) return null;
  const title = LIFTER_TITLES.find((t) => t.value === p.title)?.label ?? '';
  const pending =
    p.pending_weekly_goal && p.goal_effective_from
      ? ` · ${p.pending_weekly_goal} à partir du ${new Date(`${p.goal_effective_from}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
      : '';
  const list = (gyms.data ?? []).map((g) => ({
    primary: g.is_primary,
    gym: g.gym as unknown as { id: string; name: string } | null,
  }));

  async function remove(id: string) {
    onError(null);
    try {
      await removeGym.mutateAsync(id);
    } catch (err) {
      onError(toUserMessage(err));
    }
  }

  return (
    <View style={styles.card}>
      <Text variant="caption" color={colors.muted}>
        Toi
      </Text>
      <ListRow
        title={p.pseudo ?? 'Ta carte'}
        subtitle={`${title} · Modifier pseudo, photo, titre`}
        onPress={() => router.push({ pathname: '/lifter-card', params: { edit: '1' } })}
      />
      <ListRow
        title={`${p.weekly_goal} séances par semaine`}
        subtitle={`Objectif${pending || ' · un changement compte à partir de lundi'}`}
        onPress={() => router.push({ pathname: '/goal', params: { edit: '1' } })}
      />
      <Text variant="caption" color={colors.muted} style={styles.subhead}>
        Tes salles
      </Text>
      {list.map(({ primary, gym }) =>
        gym ? (
          <ListRow
            key={gym.id}
            title={gym.name}
            subtitle={primary ? 'Salle principale' : 'Salle en plus'}
            trailing={
              primary ? undefined : (
                <Button
                  label="Retirer"
                  variant="ghost"
                  withArrow={false}
                  disabled={removeGym.isPending}
                  onPress={() => remove(gym.id)}
                />
              )
            }
          />
        ) : null,
      )}
      {list.length < 3 ? (
        <Button
          label="Ajouter une salle"
          variant="secondary"
          withArrow={false}
          onPress={() => router.push({ pathname: '/gym', params: { edit: '1' } })}
        />
      ) : null}
    </View>
  );
}

function planLine(e: Entitlement): string {
  if (!e.active) return 'Pas d’abonnement actif.';
  const until = e.expiresAt
    ? ` · jusqu’au ${new Date(e.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : '';
  if (e.offeredBy) {
    if (e.source === 'team') {
      return `Offre Team de « ${e.teamName ?? 'ta team'} », offerte par ${e.offeredBy}${until}`;
    }
    if (e.source === 'duo') return `Pack Duo offert par ${e.offeredBy}${until}`;
    return `Offert par ${e.offeredBy}, dont l’abonnement couvre « ${e.teamName ?? 'ta team'} »${until}`;
  }
  const names = { individual: `${APP_NAME} Pro`, duo: 'Pack Duo', team: 'Offre Team' } as const;
  const covers =
    e.source !== 'team' && e.teamName
      ? ` · couvre aussi tes potes de « ${e.teamName} » (jusqu’à 4 joueurs)`
      : '';
  return `${e.source ? names[e.source] : `${APP_NAME} Pro`}${until}${covers}`;
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
      {paymentsAvailable() && entitlement.data && !entitlement.data.isPayer ? (
        <Button
          label="Voir les offres"
          variant="secondary"
          withArrow={false}
          onPress={() => router.push('/paywall')}
        />
      ) : null}
      {__DEV__ ? (
        <Button
          label="Réactiver l’écran de paiement (dev)"
          variant="ghost"
          withArrow={false}
          onPress={async () => {
            await setDevProBypass(false);
            await queryClient.invalidateQueries();
            router.replace('/');
          }}
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
  subhead: { marginTop: spacing.sm },
});
