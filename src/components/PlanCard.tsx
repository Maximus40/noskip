import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { periodSuffix, perWeekLabel, trialLabel } from '@/domain/paywall';
import type { PlanOption } from '@/features/subscriptions/revenuecat';
import { colors, radii, spacing } from '@/theme/tokens';

/** One plan of the paywall: selectable flat card, price from the store, trial in orange. */
export function PlanCard({
  option,
  selected,
  onPress,
  detail,
}: {
  option: Pick<PlanOption, 'key' | 'priceString' | 'price' | 'currency' | 'period' | 'trialDays'>;
  selected: boolean;
  onPress: () => void;
  detail?: string;
}) {
  const names = { annual: 'Annuel', weekly: 'Hebdo', team: 'Team' } as const;
  const trial = trialLabel(option.trialDays);
  const price = `${option.priceString}${periodSuffix(option.period)}`;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${names[option.key]}, ${price}${trial ? `, ${trial}` : ''}`}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <View style={styles.planHead}>
        <Text variant="headline">{names[option.key]}</Text>
        {option.key === 'annual' ? (
          <View style={styles.badge}>
            <Text variant="label" color={colors.ink}>
              Meilleure offre
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="title" style={styles.price}>
        {price}
      </Text>
      {option.key === 'annual' ? (
        <Text variant="caption" color={colors.offWhite}>
          {perWeekLabel(option.price, option.currency)}
        </Text>
      ) : null}
      {detail ? (
        <Text variant="caption" color={colors.muted}>
          {detail}
        </Text>
      ) : null}
      {trial ? (
        <Text variant="caption" color={colors.accent}>
          {trial}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  plan: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.lg,
    gap: 4,
  },
  planSelected: { borderColor: colors.accent, backgroundColor: colors.cardAlt },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  price: { fontSize: 24, lineHeight: 28 },
});
