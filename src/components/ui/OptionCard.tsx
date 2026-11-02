import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, minTouch, radii, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  accessibilityLabel?: string;
};

/** Selectable flat card. Selection = orange hairline + orange dot, nothing louder. */
export function OptionCard({
  selected,
  onPress,
  title,
  subtitle,
  accessory,
  accessibilityLabel,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={styles.text}>
        <Text variant="headline">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.muted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory}
      <View style={[styles.dot, selected && styles.dotOn]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: Math.max(minTouch, 64),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selected: { borderColor: colors.accent },
  text: { flex: 1, gap: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted },
  dotOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
