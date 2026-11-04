import * as Clipboard from 'expo-clipboard';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { formatChrono, onExit } from '@/domain/checkin';
import { useAuth } from '@/features/auth/AuthProvider';
import { apply, arrive } from '@/features/checkin/engine';
import { clearVisit, readLastResult } from '@/features/checkin/storage';
import { showUnseenResult, useGymPoints, useVisit } from '@/features/checkin/useCheckin';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Developer demo mode (development builds only): simulate arriving at / leaving the gym
 * without moving. The server accepts the shortened timing only for user ids listed in the
 * DEMO_USER_IDS secret of the validate-session function (never set it in production).
 */
export default function DevScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DemoPanel />;
}

function DemoPanel() {
  const { session } = useAuth();
  const { gyms, names } = useGymPoints();
  const visit = useVisit();
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gym = gyms[0];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const note = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')} · ${line}`, ...l].slice(0, 8));

  async function run(label: string, action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      note(label);
    } catch (err) {
      setError(toUserMessage(err));
      note(`${label} → ${err instanceof Error ? err.message : 'erreur'}`);
    } finally {
      await visit.refetch();
    }
  }

  const v = visit.data;

  return (
    <Screen>
      <Text variant="label" color={colors.accent}>
        Mode démo · dev uniquement
      </Text>
      <Text variant="title">Simuler la salle.</Text>

      <View style={styles.card}>
        <Text variant="caption" color={colors.muted}>
          Salle principale
        </Text>
        <Text variant="headline">{gym ? names[gym.id] : 'Aucune salle choisie'}</Text>
        <Text variant="caption" color={colors.muted}>
          {v
            ? `Visite : ${formatChrono(now - v.enteredAt)} · ${v.source} · serveur ${v.serverOpened ? 'ouvert' : 'pas encore'}`
            : 'Aucune visite en cours'}
        </Text>
      </View>

      <Button
        label="Entrée il y a 45 min"
        variant="secondary"
        disabled={!gym}
        onPress={() =>
          run('entrée −45 min', () => arrive(gym!.id, Date.now() - 45 * 60_000, 'manual_check'))
        }
      />
      <Button
        label="Entrée maintenant"
        variant="secondary"
        disabled={!gym}
        onPress={() => run('entrée maintenant', () => arrive(gym!.id, Date.now(), 'manual_check'))}
      />
      <Button
        label="Sortie (validation démo)"
        disabled={!gym || !v}
        onPress={() =>
          run('sortie', async () => {
            await apply(onExit(v!, v!.gymId, Date.now()), { demo: true });
            await showUnseenResult();
          })
        }
      />
      <Button
        label="Réinitialiser"
        variant="ghost"
        withArrow={false}
        onPress={() =>
          run('réinitialisé', async () => {
            await apply({ kind: 'cancel', reason: 'too_short' });
            await clearVisit();
          })
        }
      />
      <Button
        label="Dernier résultat"
        variant="ghost"
        withArrow={false}
        onPress={() => run('résultat', async () => note(JSON.stringify(await readLastResult())))}
      />
      <Button
        label="Copier mon user id (DEMO_USER_IDS)"
        variant="ghost"
        withArrow={false}
        disabled={!session}
        onPress={() => run('user id copié', () => Clipboard.setStringAsync(session!.user.id))}
      />
      <ErrorNote message={error} />
      {log.map((line) => (
        <Text key={line} variant="caption" color={colors.muted}>
          {line}
        </Text>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
