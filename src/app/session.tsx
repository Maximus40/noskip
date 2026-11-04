import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { MapBackdrop } from '@/components/MapBackdrop';
import { ProgressRing } from '@/components/ProgressRing';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import {
  elapsedMs,
  formatChrono,
  MIN_SESSION_MS,
  remainingMs,
  ringProgress,
} from '@/domain/checkin';
import { useCheckinActions, useGymPoints, useVisit } from '@/features/checkin/useCheckin';
import { toUserMessage } from '@/lib/errors';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "Séance en cours": chrono + ring towards 45:00, plan B check-in/validation. */
export default function SessionScreen() {
  const visit = useVisit();
  const { gyms, names } = useGymPoints();
  const { checkIn, finish, abandon } = useCheckinActions();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await visit.refetch();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const close = (
    <PressableScale
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      style={styles.close}
    >
      <Text variant="headline" color={colors.accent}>
        ✕
      </Text>
    </PressableScale>
  );

  if (visit.isLoading) {
    return (
      <Screen>
        <Skeleton height={300} />
      </Screen>
    );
  }

  const v = visit.data;
  const gymPoint = (v && gyms.find((g) => g.id === v.gymId)) ?? gyms[0] ?? null;
  const backdrop = (
    <MapBackdrop center={gymPoint ? { lat: gymPoint.lat, lng: gymPoint.lng } : null} />
  );

  if (!v) {
    return (
      <View style={styles.fill}>
        {backdrop}
        <Screen
          background="transparent"
          footer={
            <Button label="Je suis à la salle" disabled={busy} onPress={() => run(checkIn)} />
          }
        >
          {close}
          <Text variant="label" color={colors.accent}>
            Pas de séance en cours
          </Text>
          <Text variant="display" accessibilityRole="header">
            Le Canap&apos; t&apos;attend.
          </Text>
          <Text color={colors.muted}>
            Avec le pointage auto, il n&apos;y a rien à faire : va à la salle, reste 40 minutes.
            Sinon, touche le bouton en arrivant, on vérifie ta position une fois maintenant et une
            fois dans 40 minutes.
          </Text>
          <ErrorNote message={error} />
        </Screen>
      </View>
    );
  }

  const elapsed = elapsedMs(v, now);
  const remaining = remainingMs(v, now);
  const ready = elapsed >= MIN_SESSION_MS;
  const gymName = names[v.gymId] ?? 'Ta salle';
  const auto = v.source === 'geofence';

  return (
    <View style={styles.fill}>
      {backdrop}
      <Screen
        background="transparent"
        footer={
          <>
            {ready || !auto ? (
              <Button
                label={ready ? 'Valider ma séance' : `Encore ${Math.ceil(remaining / 60_000)} min`}
                disabled={!ready || busy}
                onPress={() => run(finish)}
                accessibilityHint="On vérifie que t'es toujours à la salle"
              />
            ) : null}
            <Button
              label="Annuler la séance"
              variant="ghost"
              withArrow={false}
              disabled={busy}
              onPress={() =>
                Alert.alert('Annuler la séance ?', 'Elle ne comptera pas.', [
                  { text: 'Continuer', style: 'cancel' },
                  { text: 'Annuler', style: 'destructive', onPress: () => run(abandon) },
                ])
              }
            />
          </>
        }
      >
        {close}
        <Text variant="label" color={colors.accent}>
          {`Séance en cours · ${gymName}`}
        </Text>
        <View style={styles.ringWrap}>
          <ProgressRing size={260} stroke={12} progress={ringProgress(v, now)}>
            <Text
              variant="number"
              accessibilityLabel={`Temps sur place ${Math.floor(elapsed / 60_000)} minutes`}
              accessibilityLiveRegion="none"
            >
              {formatChrono(elapsed)}
            </Text>
            <Text variant="caption" color={colors.muted}>
              {ready ? 'Disque mérité' : 'Objectif 45:00'}
            </Text>
          </ProgressRing>
        </View>
        <GlassPanel style={styles.card}>
          <Text variant="headline">
            {auto
              ? ready
                ? 'Pars quand tu veux : on charge ton disque en sortant.'
                : 'Pointage auto : garde ton téléphone sur toi.'
              : ready
                ? 'Touche « Valider » depuis la salle.'
                : 'Reviens ici dans 40 minutes, toujours à la salle.'}
          </Text>
          <Text variant="caption" color={colors.muted}>
            Ta team te voit « à la salle ». Ni l&apos;heure, ni l&apos;adresse.
          </Text>
        </GlassPanel>
        <ErrorNote message={error} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  close: {
    alignSelf: 'flex-end',
    width: Math.max(minTouch, 50),
    height: Math.max(minTouch, 50),
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { flex: 1, backgroundColor: colors.map },
  ringWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  card: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
