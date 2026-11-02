import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { colors, minTouch, radii, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
};

/** Big expanded number with − / + glass buttons. */
export function Stepper({ label, value, onChange, min = 0, max = 30, suffix }: Props) {
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) {
      Haptics.selectionAsync().catch(() => undefined);
      onChange(clamped);
    }
  };
  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value}${suffix ? ` ${suffix}` : ''}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        set(e.nativeEvent.actionName === 'increment' ? value + 1 : value - 1)
      }
    >
      <Text variant="label" color={colors.muted}>
        {label}
      </Text>
      <View style={styles.row}>
        <RoundButton symbol="−" onPress={() => set(value - 1)} disabled={value <= min} />
        <View style={styles.valueWrap}>
          <Text variant="number">{value}</Text>
          {suffix ? (
            <Text variant="caption" color={colors.muted}>
              {suffix}
            </Text>
          ) : null}
        </View>
        <RoundButton symbol="+" onPress={() => set(value + 1)} disabled={value >= max} />
      </View>
    </View>
  );
}

function RoundButton({
  symbol,
  onPress,
  disabled,
}: {
  symbol: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[styles.round, disabled && styles.disabled]}
    >
      <Text variant="title" style={styles.symbol}>
        {symbol}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.xl,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valueWrap: { alignItems: 'center' },
  round: {
    width: Math.max(minTouch, 50),
    height: Math.max(minTouch, 50),
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { lineHeight: 30 },
  disabled: { opacity: 0.3 },
});
