import React, { useState, forwardRef } from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/theme';

export const Input = forwardRef<TextInput, TextInputProps>(function Input(props, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedLight}
      {...props}
      style={[
        s.input,
        focused && s.focused,
        props.multiline && { minHeight: 80, textAlignVertical: 'top' },
        props.style,
      ]}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    />
  );
});

const s = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
  },
  focused: { borderColor: colors.brandPrimary, borderWidth: 2 },
});
