import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onlineManager } from '@tanstack/react-query';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/theme/tokens';

/** A small glass strip on top of every screen while the phone is offline. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  useEffect(() => onlineManager.subscribe(setOnline), []);
  if (online) return null;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInUp.duration(200)}
      exiting={reduced ? undefined : FadeOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
      pointerEvents="none"
    >
      <View
        style={styles.pill}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <View style={styles.dot} />
        <Text variant="caption">
          Pas de réseau. Tes séances sont gardées et partiront au retour.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(30,31,35,0.94)',
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
