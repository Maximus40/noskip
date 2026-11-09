import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LifterCard } from '@/components/LifterCard';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { jokerState } from '@/domain/progression';
import { type LifterCardData, useDeclareJoker, useLifterCard } from '@/features/progression/api';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

/** Ma carte de lifter + joker blessure. */
export default function LifterScreen() {
  const card = useLifterCard();
  useFocusEffect(
    useCallback(() => {
      card.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="label" color={colors.accent}>
          Carte de lifter
        </Text>
      </View>
      {card.data ? (
        <LifterCard card={card.data} footer={<JokerCard card={card.data} />} />
      ) : card.isError ? null : (
        <View style={styles.loading} accessibilityLabel="Chargement de ta carte">
          <Skeleton height={190} />
          <Skeleton height={150} />
          <Skeleton height={90} />
        </View>
      )}
      <ErrorNote message={card.error ? toUserMessage(card.error) : null} />
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function JokerCard({ card }: { card: LifterCardData }) {
  const declare = useDeclareJoker();
  const [error, setError] = useState<string | null>(null);
  const state = jokerState(card);

  function confirm() {
    Alert.alert(
      'Joker blessure',
      'Cette semaine ne comptera pas : pas de carte SKIP et ta série est protégée. Un seul joker par mois, et ta team le verra.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Activer le joker',
          onPress: async () => {
            setError(null);
            try {
              await declare.mutateAsync();
            } catch (err) {
              setError(toUserMessage(err));
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.joker}>
      <Text variant="caption" color={colors.muted}>
        Joker blessure · 1 par mois
      </Text>
      {state === 'active' ? (
        <Text variant="bodyStrong" accessibilityLiveRegion="polite">
          Joker actif cette semaine. Pas de carte SKIP, ta série est protégée. Soigne-toi.
        </Text>
      ) : state === 'used' ? (
        <Text variant="body" color="#C9CACE">
          Joker du mois déjà utilisé. Le prochain arrive le 1er.
        </Text>
      ) : (
        <>
          <Text variant="body" color="#C9CACE">
            Blessé ? Déclare-le avant dimanche 20 h : pas de carte SKIP cette semaine, série
            préservée.
          </Text>
          <Button
            label="Déclarer un joker"
            variant="secondary"
            withArrow={false}
            disabled={declare.isPending}
            onPress={confirm}
            accessibilityHint="Demande une confirmation avant d'activer le joker de la semaine"
          />
        </>
      )}
      <ErrorNote message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  loading: { gap: spacing.md },
  joker: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bottomSpace: { height: 96 },
});
