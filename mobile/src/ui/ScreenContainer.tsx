import React, { ReactNode } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

interface Props {
  header?: ReactNode;
  children: ReactNode;
  /** TabBar가 있는 화면이면 본문 패딩 bottom 추가됨 */
  hasTabBar?: boolean;
}

export const TABBAR_RESERVED_HEIGHT = 84;   // 다크 캡슐 + safe area 여유

export function ScreenContainer({ header, children, hasTabBar }: Props) {
  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <StatusBar barStyle="light-content" />
      {header}
      <View style={[s.body, hasTabBar && { paddingBottom: TABBAR_RESERVED_HEIGHT }]}>{children}</View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  body: { flex: 1 },
});
