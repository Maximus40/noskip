import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors } from '@/theme/tokens';
import { textVariants, type TextVariant } from '@/theme/typography';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: string;
};

export function Text({ variant = 'body', color = colors.offWhite, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[textVariants[variant], { color }, style]} />;
}
