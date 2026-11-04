import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, glass } from '@/theme/tokens';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  size?: 'regular' | 'main';
  accent?: boolean;
};

/** Round frosted-glass button (50 px, central one 70 px). */
export function RoundGlassButton({
  onPress,
  accessibilityLabel,
  children,
  size = 'regular',
  accent,
}: Props) {
  const d = size === 'main' ? glass.roundButtonMain : glass.roundButton;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <GlassPanel
        radius={d / 2}
        style={[styles.base, { width: d, height: d }, accent && styles.accent]}
      >
        {children}
      </GlassPanel>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  accent: { borderColor: colors.accent, borderWidth: 1.5 },
});
