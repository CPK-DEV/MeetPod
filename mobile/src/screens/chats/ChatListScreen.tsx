import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useChatStore } from '@/store/chatStore';
import { listGroups, type Group } from '@/api/groups';
import { listMeetups, type Meetup } from '@/api/meetups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Avatar } from '@/ui/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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

  function labelFor(kind: 'group' | 'meetup', ref_id: string) {
    if (kind === 'group') {
      const g = groups[ref_id];
      return { title: g?.name ?? '그룹 채팅', sub: '그룹' };
    }
    const m = meetups[ref_id];
    return { title: m?.title ?? '약속 채팅', sub: m ? `약속 · ${new Date(m.starts_at).toLocaleDateString()}` : '약속' };
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="채팅" subtitle={`${rooms.length}개`} />}>
      {rooms.length === 0 ? (
        <EmptyState title="채팅방이 없어요" description="그룹·약속을 만들면 자동으로 채팅방이 생겨요." />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={false} onRefresh={load} />}
          renderItem={({ item }) => {
            const { title, sub } = labelFor(item.kind, item.ref_id);
            return (
              <Card variant="row" onPress={() => nav.navigate('ChatRoom', { id: item.id, kind: item.kind })}>
                <View style={s.row}>
                  <Avatar userId={item.id} name={title} size={40} />
                  <View style={{ marginLeft: spacing(3), flex: 1 }}>
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.sub}>{sub}{item.archived_at ? ' · 아카이브됨' : ''}</Text>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  sub: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(0.5) },
});
