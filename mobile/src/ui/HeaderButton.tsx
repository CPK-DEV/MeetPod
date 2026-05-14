import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, fontFamily, fontSize } from '@/theme';

interface Props {
  label?: string;
  icon?: string;
  onPress: () => void;
}

export function HeaderButton({ label, icon, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, pressed && s.pressed]} hitSlop={8}>
      <Text style={s.text}>{icon ?? label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 28, height: 28, borderRadius: radius.xs,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  text: { color: colors.brandSecondary, fontFamily: fontFamily.black, fontSize: fontSize.md, lineHeight: fontSize.lg },
});
