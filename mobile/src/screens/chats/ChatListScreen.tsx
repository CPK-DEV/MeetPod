import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useChatStore } from '@/store/chatStore';
import { type ChatRoom } from '@/api/chat';
import { listGroups, type Group } from '@/api/groups';
import { listMeetups, type Meetup } from '@/api/meetups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Avatar } from '@/ui/Avatar';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

const INACTIVE_STATUSES = new Set(['ended', 'cancelled']);
type Tab = 'active' | 'inactive';

export function ChatListScreen() {
  const nav = useNavigation<any>();
  const rooms = useChatStore((s) => s.rooms);
  const refresh = useChatStore((s) => s.refreshRooms);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [meetups, setMeetups] = useState<Record<string, Meetup>>({});
  const [tab, setTab] = useState<Tab>('active');

  const load = useCallback(async () => {
    await refresh();
    const [gs, ms] = await Promise.all([listGroups(), listMeetups(true)]);
    setGroups(Object.fromEntries(gs.map((g) => [g.id, g])));
    setMeetups(Object.fromEntries(ms.map((m) => [m.id, m])));
  }, [refresh]);
  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]));

  function labelFor(kind: 'group' | 'meetup', ref_id: string) {
    if (kind === 'group') {
      const g = groups[ref_id];
      return { title: g?.name ?? '그룹 채팅', sub: '그룹' };
    }
    const m = meetups[ref_id];
    return { title: m?.title ?? '약속 채팅', sub: m ? `약속 · ${new Date(m.starts_at).toLocaleDateString()}` : '약속' };
  }

  function effectiveDate(room: ChatRoom): number {
    if (room.kind === 'meetup') {
      const m = meetups[room.ref_id];
      return m ? new Date(m.starts_at).getTime() : new Date(room.created_at).getTime();
    }
    return new Date(room.created_at).getTime();
  }

  const { active, inactive } = useMemo(() => {
    const act: ChatRoom[] = [];
    const inact: ChatRoom[] = [];
    for (const r of rooms) {
      const isInactiveMeetup = r.kind === 'meetup' && INACTIVE_STATUSES.has(meetups[r.ref_id]?.status ?? '');
      (isInactiveMeetup ? inact : act).push(r);
    }
    act.sort((a, b) => effectiveDate(a) - effectiveDate(b));
    inact.sort((a, b) => effectiveDate(b) - effectiveDate(a));
    return { active: act, inactive: inact };
  }, [rooms, meetups]);

  const items = tab === 'active' ? active : inactive;

  return (
    <ScreenContainer hasTabBar header={<Header title="채팅" subtitle={`${rooms.length}개`} />}>
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === 'active' && s.tabOn]} onPress={() => setTab('active')}>
          <Text style={tab === 'active' ? s.tabOnText : s.tabText}>활성 ({active.length})</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === 'inactive' && s.tabOn]} onPress={() => setTab('inactive')}>
          <Text style={tab === 'inactive' ? s.tabOnText : s.tabText}>인액티브 ({inactive.length})</Text>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? '채팅방이 없어요' : '종료된 약속 채팅이 없어요'}
          description="그룹·약속을 만들면 자동으로 채팅방이 생겨요."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={false} onRefresh={load} />}
          renderItem={({ item }) => {
            const { title, sub } = labelFor(item.kind, item.ref_id);
            return (
              <Card variant="row" onPress={() => nav.navigate('ChatRoom', { id: item.id, kind: item.kind, ref_id: item.ref_id })}>
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
  tabs: { flexDirection: 'row', paddingHorizontal: spacing(3), marginBottom: spacing(2), gap: spacing(2) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing(2), borderRadius: radius.sm, backgroundColor: colors.ghostOverlay },
  tabOn: { backgroundColor: colors.surfaceDark },
  tabText: { color: colors.inkInverse, fontFamily: fontFamily.semibold, fontSize: fontSize.sm },
  tabOnText: { color: colors.brandSecondary, fontFamily: fontFamily.bold, fontSize: fontSize.sm },
});
