import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { Screen } from './Screen';
import { Text } from './Text';

type Props = {
  label: string;
  title: string;
  phase: number;
  children?: ReactNode;
  footer?: ReactNode;
};

/**
 * Navigation scaffold used while a screen is not yet implemented.
 * Every usage is tracked in CLAUDE.md › Avancement and removed by its phase.
 */
export function ScreenShell({ label, title, phase, children, footer }: Props) {
  return (
    <Screen footer={footer}>
      <Text variant="label" color={colors.accent}>
        {label}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="caption" color={colors.muted}>
        {`Écran livré en phase ${phase}.`}
      </Text>
      {children}
    </Screen>
  );
}
