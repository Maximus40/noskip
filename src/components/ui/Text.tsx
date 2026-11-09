import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors } from '@/theme/tokens';
import { textVariants, type TextVariant } from '@/theme/typography';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: string;
};

/**
 * Dynamic Type / font scale: body text grows up to 1.6×, giant display figures up to 1.2× so the
 * bar, the kilos and the poster keep their layout.
 */
const MAX_SCALE: Record<TextVariant, number> = {
  display: 1.2,
  number: 1.2,
  poster: 1,
  title: 1.3,
  headline: 1.5,
  body: 1.6,
  bodyStrong: 1.6,
  caption: 1.6,
  label: 1.4,
};

export function Text({ variant = 'body', color = colors.offWhite, style, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[textVariants[variant], { color }, style]}
    />
  );
}
