import { StyleSheet, View } from 'react-native';

import { colors, minTouch, radii, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = { checked: boolean; onChange: (checked: boolean) => void; label: string };

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <PressableScale
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? (
          <Text variant="bodyStrong" color={colors.ink}>
            ✓
          </Text>
        ) : null}
      </View>
      <Text variant="bodyStrong" style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { flex: 1 },
});
