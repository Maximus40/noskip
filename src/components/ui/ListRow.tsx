import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, minTouch, radii, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityHint?: string;
};

/** Flat dark row. No generic icon per row: leading slot is for an avatar or a plate swatch. */
export function ListRow({ title, subtitle, onPress, leading, trailing, accessibilityHint }: Props) {
  const content = (
    <>
      {leading}
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.muted} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Math.max(minTouch, 64),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, gap: 2 },
});
