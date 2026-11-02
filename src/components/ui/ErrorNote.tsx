import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { Text } from './Text';

/** Inline, human error message (never a raw error). */
export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.dot} />
      <Text variant="caption" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.button,
    padding: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  text: { flex: 1 },
});
