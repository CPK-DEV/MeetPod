import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      {description ? <Text style={s.desc}>{description}</Text> : null}
      {action ? <View style={s.action}>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(8), paddingTop: spacing(20) },
  title: { color: colors.inkInverse, fontFamily: fontFamily.bold, fontSize: fontSize.lg, textAlign: 'center' },
  desc:  { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center', marginTop: spacing(2) },
  action: { marginTop: spacing(6), width: '100%' },
});
