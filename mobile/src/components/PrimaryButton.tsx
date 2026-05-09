import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, loading, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        s.btn,
        (loading || disabled) && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.label}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
