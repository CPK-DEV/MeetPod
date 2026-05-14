import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { colors, radius, spacing, shadows } from '@/theme';

type Variant = 'default' | 'hero' | 'row';

interface Props {
  children: ReactNode;
  variant?: Variant;
  onPress?: () => void;
  style?: ViewStyle;
}

const PADDINGS: Record<Variant, ViewStyle> = {
  default: { padding: spacing(3.5) },
  hero:    { padding: spacing(4) },
  row:     { paddingVertical: spacing(3), paddingHorizontal: spacing(3.5) },
};

export function Card({ children, variant = 'default', onPress, style }: Props) {
  const inner = <View style={[s.card, PADDINGS[variant], style]}>{children}</View>;
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => [pressed && s.pressed]}>{inner}</Pressable>
    : inner;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    marginHorizontal: spacing(3),
    marginBottom: spacing(2),
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
});
