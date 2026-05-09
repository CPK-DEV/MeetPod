import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { PrimaryButton } from '@/components/PrimaryButton';

export function MeScreen() {
  const nav = useNavigation<any>();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={s.root}>
      <Text style={s.name}>{profile?.display_name}</Text>
      <Text style={s.handle}>@{profile?.handle}</Text>
      <View style={{ height: 24 }} />
      <Pressable style={s.row} onPress={() => nav.navigate('FriendList')}>
        <Text style={s.rowLabel}>친구 목록</Text>
      </Pressable>
      <Pressable style={s.row} onPress={() => nav.navigate('FriendInvite')}>
        <Text style={s.rowLabel}>친구 초대</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="로그아웃" onPress={signOut} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#fff' },
  name: { fontSize: 24, fontWeight: '700' },
  handle: { fontSize: 16, color: '#666', marginTop: 4 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#eee' },
  rowLabel: { fontSize: 16 },
});
