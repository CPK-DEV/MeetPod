import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { listMembers, kickMember, setMemberRole, type GroupMember } from '@/api/groups';
import { useAuthStore } from '@/store/authStore';

export function GroupMembersScreen() {
  const { id } = (useRoute<any>()).params;
  const [items, setItems] = useState<GroupMember[]>([]);
  const me = useAuthStore((s) => s.profile?.id);

  const load = useCallback(() => { listMembers(id).then(setItems); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myRole = items.find((m) => m.user_id === me)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  function actions(m: GroupMember) {
    if (!canManage || m.user_id === me) return;
    Alert.alert('멤버 관리', m.user_id, [
      m.role === 'admin'
        ? { text: '일반 멤버로', onPress: async () => { await setMemberRole(id, m.user_id, 'member'); load(); } }
        : { text: '관리자 지정', onPress: async () => { await setMemberRole(id, m.user_id, 'admin'); load(); } },
      { text: '추방', style: 'destructive', onPress: async () => { await kickMember(id, m.user_id); load(); } },
      { text: '취소', style: 'cancel' },
    ]);
  }

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={items}
      keyExtractor={(m) => m.user_id}
      renderItem={({ item }) => (
        <Pressable style={s.row} onPress={() => actions(item)}>
          <Text style={s.uid}>{item.user_id}</Text>
          <Text style={s.role}>{item.role}</Text>
        </Pressable>
      )}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 14, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  uid: { fontSize: 14, color: '#222' },
  role: { fontSize: 14, color: '#666' },
});
