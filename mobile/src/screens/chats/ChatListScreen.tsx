import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useChatStore } from '@/store/chatStore';
import { listGroups, type Group } from '@/api/groups';
import { listMeetups, type Meetup } from '@/api/meetups';

export function ChatListScreen() {
  const nav = useNavigation<any>();
  const rooms = useChatStore((s) => s.rooms);
  const refresh = useChatStore((s) => s.refreshRooms);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [meetups, setMeetups] = useState<Record<string, Meetup>>({});

  const load = useCallback(async () => {
    await refresh();
    const [gs, ms] = await Promise.all([listGroups(), listMeetups(true)]);
    setGroups(Object.fromEntries(gs.map((g) => [g.id, g])));
    setMeetups(Object.fromEntries(ms.map((m) => [m.id, m])));
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function labelFor(kind: 'group' | 'meetup', ref_id: string): { title: string; sub: string } {
    if (kind === 'group') {
      const g = groups[ref_id];
      return { title: g?.name ?? '그룹 채팅', sub: '그룹' };
    }
    const m = meetups[ref_id];
    return {
      title: m?.title ?? '약속 채팅',
      sub: m ? `약속 · ${new Date(m.starts_at).toLocaleDateString()}` : '약속',
    };
  }

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={rooms}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      renderItem={({ item }) => {
        const { title, sub } = labelFor(item.kind, item.ref_id);
        return (
          <Pressable style={s.row} onPress={() => nav.navigate('ChatRoom', { id: item.id, kind: item.kind })}>
            <Text style={s.title}>{title}</Text>
            <Text style={s.sub}>{sub}{item.archived_at ? ' · 아카이브됨' : ''}</Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text style={s.empty}>채팅방이 없어요</Text>}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#888', marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
});
