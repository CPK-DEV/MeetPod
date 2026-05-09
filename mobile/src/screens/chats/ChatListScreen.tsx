import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useChatStore } from '@/store/chatStore';

export function ChatListScreen() {
  const nav = useNavigation<any>();
  const rooms = useChatStore((s) => s.rooms);
  const refresh = useChatStore((s) => s.refreshRooms);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={rooms}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
      renderItem={({ item }) => (
        <Pressable style={s.row} onPress={() => nav.navigate('ChatRoom', { id: item.id, kind: item.kind })}>
          <Text style={s.title}>{item.kind === 'group' ? '그룹' : '약속'} 채팅</Text>
          <Text style={s.sub}>{item.archived_at ? '아카이브됨' : ''}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={s.empty}>채팅방이 없어요</Text>}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#888', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
});
