import { StyleSheet, View } from 'react-native';

import { ArrowUpRight } from '@/components/icons/ArrowUpRight';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  withArrow?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  withArrow = variant === 'primary',
  accessibilityHint,
}: Props) {
  const fg = variant === 'primary' ? colors.ink : colors.offWhite;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.base, styles[variant], disabled && styles.disabled]}
    >
      <View style={styles.row}>
        <Text variant="bodyStrong" color={fg} style={styles.label}>
          {label}
        </Text>
        {withArrow ? <ArrowUpRight color={fg} size={18} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(minTouch, 56),
    borderRadius: radii.button,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.card },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 17 },
});
