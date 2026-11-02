import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii } from '@/theme/tokens';

/** Quiet breathing placeholder (no generic spinner). */
export function Skeleton({ height = 64, style }: { height?: number; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { height }, animated, style]}
    >
      <View style={styles.sheen} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.glassBorder,
  },
});
