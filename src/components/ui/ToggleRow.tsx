import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, minTouch, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/** A settings row with NoSkip's own switch: orange when on, knob slides (fade if reduced). */
export function ToggleRow({ label, detail, value, onChange, disabled }: Props) {
  const reduced = useReducedMotion();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = reduced ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: 160 });
  }, [reduced, value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));

  return (
    <PressableScale
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? (
          <Text variant="caption" color={colors.muted}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <Animated.View style={[styles.knob, value && styles.knobOn, knob]} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: Math.max(minTouch, 56),
    paddingVertical: spacing.xs,
  },
  disabled: { opacity: 0.5 },
  text: { flex: 1, gap: 2 },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  trackOn: { backgroundColor: colors.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.muted },
  knobOn: { backgroundColor: colors.ink },
});
