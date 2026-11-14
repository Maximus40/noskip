import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { Text } from '@/components/ui/Text';

/**
 * One line of a poster title: never wraps in the middle of a word. If the font renders wider
 * than planned (iOS vs web metrics, long pseudo), the line shrinks to fit instead.
 */
export function FitLine({ style, children }: { style: StyleProp<TextStyle>; children: ReactNode }) {
  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {children}
    </Text>
  );
}
