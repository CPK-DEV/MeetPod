import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/theme';

type Variant = 'primary' | 'ghostOnOrange' | 'dangerOnSurface' | 'dark';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const VARIANTS: Record<Variant, { bg: string; fg: string }> = {
  primary:          { bg: colors.brandSecondary, fg: colors.ink },
  ghostOnOrange:    { bg: colors.ghostOverlay,   fg: colors.inkInverse },
  dangerOnSurface:  { bg: colors.surface,        fg: colors.danger },
  dark:             { bg: colors.surfaceDark,    fg: colors.brandSecondary },
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: v.bg },
        isDisabled && s.disabled,
        pressed && s.pressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={v.fg} />
        : <Text style={[s.label, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
});
