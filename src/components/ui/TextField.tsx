import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, minTouch, radii, spacing } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label" color={colors.muted}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#6C6D72"
        selectionColor={colors.accent}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, error ? styles.invalid : null, style]}
      />
      {error ? (
        <Text variant="caption" color={colors.accent} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    minHeight: Math.max(minTouch, 56),
    borderRadius: radii.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    color: colors.offWhite,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  focused: { borderColor: colors.glassBorder },
  invalid: { borderColor: colors.accent },
});
