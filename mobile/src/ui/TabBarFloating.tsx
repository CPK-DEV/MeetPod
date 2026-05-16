import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, fontFamily, spacing, shadows } from '@/theme';

const TABS: Record<string, { icon: string; label: string }> = {
  Meetups: { icon: '📅', label: '약속' },
  Groups:  { icon: '👥', label: '그룹' },
  Chats:   { icon: '💬', label: '채팅' },
  Me:      { icon: '🙂', label: '나' },
};

export function TabBarFloating({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { bottom: Math.max(insets.bottom, 8) + 4 }]}>
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name as any);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={[s.tab, focused && s.tabActive]}>
              <Text style={[s.icon, focused && s.iconActive]}>{TABS[route.name]?.icon ?? '•'}</Text>
              <Text style={[s.label, focused && s.labelActive]}>{TABS[route.name]?.label ?? route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', left: spacing(3), right: spacing(3),
    ...shadows.floatingTabbar,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    padding: spacing(1.25),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(1.75),
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.brandSecondary },
  icon: { fontSize: 17, color: 'rgba(255,255,255,0.6)' },
  iconActive: { color: colors.ink },
  label: { fontFamily: fontFamily.semibold, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  labelActive: { color: colors.ink },
});
