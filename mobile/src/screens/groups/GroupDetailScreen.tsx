import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { getGroup, type Group } from '@/api/groups';
import { listRooms } from '@/api/chat';
import { PrimaryButton } from '@/components/PrimaryButton';

export function GroupDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params;
  const [g, setG] = useState<Group | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    getGroup(id).then(setG);
    listRooms().then((rooms) => {
      const r = rooms.find((x) => x.kind === 'group' && x.ref_id === id);
      setRoomId(r?.id ?? null);
    });
  }, [id]));

  if (!g) return <View style={s.root}><Text>로딩중...</Text></View>;
  return (
    <View style={s.root}>
      <Text style={s.name}>{g.name}</Text>
      {g.description ? <Text style={s.sub}>{g.description}</Text> : null}
      <View style={{ height: 24 }} />
      <Pressable style={s.row} onPress={() => nav.navigate('GroupMembers', { id: g.id })}>
        <Text style={s.rowLabel}>멤버</Text>
      </Pressable>
      <Pressable style={s.row} onPress={() => nav.navigate('GroupInvite', { id: g.id })}>
        <Text style={s.rowLabel}>초대 링크 만들기</Text>
      </Pressable>
      {roomId && (
        <Pressable style={s.row} onPress={() => nav.navigate('Chats', { screen: 'ChatRoom', params: { id: roomId, kind: 'group' } })}>
          <Text style={s.rowLabel}>그룹 채팅 열기</Text>
        </Pressable>
      )}
      <View style={{ height: 24 }} />
      <PrimaryButton label="이 그룹으로 약속 만들기" onPress={() => nav.navigate('Meetups', { screen: 'MeetupCreate', params: { group_id: g.id } })} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#fff' },
  name: { fontSize: 24, fontWeight: '700' },
  sub: { color: '#666', marginTop: 8 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: '#eee' },
  rowLabel: { fontSize: 16 },
});
