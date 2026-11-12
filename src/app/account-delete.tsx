import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDeleteAccount } from '@/features/account/api';
import {
  paymentsAvailable,
  useEntitlement,
  useManageSubscription,
} from '@/features/subscriptions/api';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

const GONE = [
  'Ton profil, ta photo, ta carte de lifter et tes trophées.',
  'Tes séances, tes salles, tes jokers, tes spots et tes cartes SKIP.',
  'Ta place dans tes teams : si tu les as créées, elles passent au plus ancien pote ; si personne d’autre n’y est, elles disparaissent.',
  'Tes réglages et l’enregistrement de ce téléphone pour les notifications.',
] as const;

/** Suppression du compte (exigence App Store) : définitive, confirmée en tapant SUPPRIMER. */
export default function AccountDeleteScreen() {
  const manage = useManageSubscription();
  const [typed, setTyped] = useState('');
  const remove = useDeleteAccount();
  const entitlement = useEntitlement();
  const payer = Boolean(entitlement.data?.active && entitlement.data.isPayer);
  const ready = typed.trim().toUpperCase() === 'SUPPRIMER';

  async function onDelete() {
    try {
      await remove.mutateAsync();
      router.replace('/');
    } catch {
      // Shown below.
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={remove.isPending ? 'Suppression…' : 'Supprimer définitivement'}
            disabled={!ready || remove.isPending}
            onPress={onDelete}
            accessibilityHint="Efface ton compte et toutes tes données, sans retour possible"
          />
          <Button
            label="Annuler"
            variant="ghost"
            withArrow={false}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          />
        </>
      }
    >
      <View style={styles.head}>
        <Text variant="label" color={colors.accent}>
          Compte
        </Text>
        <Text variant="title" accessibilityRole="header">
          Supprimer ton compte.
        </Text>
        <Text variant="body" color={colors.muted}>
          C’est définitif. Le Canap’ gagne par forfait.
        </Text>
      </View>

      <View style={styles.card}>
        <Text variant="caption" color={colors.muted}>
          Ce qui sera effacé
        </Text>
        {GONE.map((line) => (
          <View key={line} style={styles.row}>
            <View style={styles.dot} />
            <Text variant="body" style={styles.flex}>
              {line}
            </Text>
          </View>
        ))}
      </View>

      {payer ? (
        <View style={styles.card}>
          <Text variant="bodyStrong">Ton abonnement n’est pas résilié automatiquement.</Text>
          <Text variant="body" color={colors.muted}>
            Le paiement passe par ton compte App Store ou Google Play : résilie-le là-bas, sinon il
            continuera d’être prélevé.
          </Text>
          {paymentsAvailable() ? (
            <Button
              label="Gérer mon abonnement"
              variant="secondary"
              withArrow={false}
              onPress={() => manage().catch(() => undefined)}
            />
          ) : null}
        </View>
      ) : null}

      <TextField
        label="Tape SUPPRIMER pour confirmer"
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityHint="Écris le mot SUPPRIMER en majuscules"
      />
      <ErrorNote message={remove.error ? toUserMessage(remove.error) : null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 9 },
  flex: { flex: 1 },
});
