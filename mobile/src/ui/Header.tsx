import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}

export function Header({ title, subtitle, back, action }: Props) {
  const nav = useNavigation<any>();
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {back && (
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={s.backBtn}>
            <Text style={s.back}>‹</Text>
          </Pressable>
        )}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <View style={s.actionWrap}>{action}</View>
      </View>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.brandPrimaryDark,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3.5),
    paddingBottom: spacing(3),
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  back: { color: colors.inkInverse, fontSize: 28, fontFamily: fontFamily.regular, lineHeight: 30 },
  title: { flex: 1, color: colors.inkInverse, fontFamily: fontFamily.black, fontSize: fontSize['2xl'] },
  actionWrap: { marginLeft: spacing(2) },
  sub: { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
