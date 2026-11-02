import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, glass, radii } from '@/theme/tokens';

type Props = {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Frosted glass panel: blurred backdrop + translucent fill + hairline border. */
export function GlassPanel({ children, radius = radii.glass, style }: Props) {
  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]}>
      <BlurView
        intensity={glass.blurIntensity}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.fill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.glassBorder,
  },
  fill: { backgroundColor: colors.glass },
});
