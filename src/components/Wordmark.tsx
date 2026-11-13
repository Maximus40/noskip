import { Text, type TextStyle } from 'react-native';

import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { APP_NAME, APP_WORDMARK } from '../../content/brand';

type Props = {
  /** Font size in points. */
  size: number;
  color?: string;
  /** The full stop is orange by default; the SKIP poster keeps it in ink (one orange point). */
  dotColor?: string;
  style?: TextStyle;
};

/** Logo « NOXCUSE. » : Archivo Black, tight tracking, the full stop in orange (design/logo, C). */
export function Wordmark({
  size,
  color = colors.offWhite,
  dotColor = colors.accent,
  style,
}: Props) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={APP_NAME}
      maxFontSizeMultiplier={1}
      numberOfLines={1}
      style={[
        {
          fontFamily: fonts.black,
          fontSize: size,
          lineHeight: size * 1.1,
          letterSpacing: -0.05 * size,
          color,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {APP_WORDMARK}
      <Text style={{ color: dotColor }}>.</Text>
    </Text>
  );
}
