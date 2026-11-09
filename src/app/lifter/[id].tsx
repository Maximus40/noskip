import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LifterCard } from '@/components/LifterCard';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useLifterCard } from '@/features/progression/api';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';

/** A teammate's lifter card (readable only by people who share a team with them). */
export default function TeammateCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useLifterCard(id);
  return (
    <Screen
      footer={
        <Button
          label="Retour"
          variant="ghost"
          withArrow={false}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/team'))}
        />
      }
    >
      <Text variant="label" color={colors.accent}>
        Carte de lifter
      </Text>
      {card.data ? (
        <LifterCard card={card.data} />
      ) : card.isError ? null : (
        <View style={styles.loading} accessibilityLabel="Chargement de la carte">
          <Skeleton height={190} />
          <Skeleton height={150} />
        </View>
      )}
      <ErrorNote message={card.error ? toUserMessage(card.error) : null} />
    </Screen>
  );
}

const styles = StyleSheet.create({ loading: { gap: spacing.md } });
