import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { useMeetupsStore } from '@/store/meetupsStore';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { HeaderButton } from '@/ui/HeaderButton';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

const INACTIVE_STATUSES = new Set(['ended', 'cancelled']);
type Tab = 'active' | 'inactive';

function badgeFor(status: string, startsAt: string) {
  if (status === 'cancelled') return { tone: 'cancelled' as const, label: '취소' };
  if (status === 'active') return { tone: 'live' as const, label: '진행중' };
  if (status === 'ended') return { tone: 'ended' as const, label: '종료' };
  const isToday = new Date(startsAt).toDateString() === new Date().toDateString();
  if (isToday) return { tone: 'today' as const, label: '오늘' };
  return null;
}

export function MeetupListScreen() {
  const nav = useNavigation<any>();
  const me = useAuthStore((s) => s.profile?.id);
  const { ids, byId, loading, refresh } = useMeetupsStore();
  const [tab, setTab] = useState<Tab>('active');
  useFocusEffect(useCallback(() => {
    refresh(true);
    const interval = setInterval(() => refresh(true), 60_000);
    return () => clearInterval(interval);
  }, [refresh]));

  const all = ids.map((i) => byId[i]);
  const { active, inactive } = useMemo(() => {
    const act = all.filter((m) => !INACTIVE_STATUSES.has(m.status));
    const inact = all.filter((m) => INACTIVE_STATUSES.has(m.status));
    act.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    inact.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { active: act, inactive: inact };
  }, [all]);

  const items = tab === 'active' ? active : inactive;

  return (
    <ScreenContainer
      hasTabBar
      header={
        <Header
          title="약속"
          subtitle={`${all.length}건`}
          action={<HeaderButton icon="+" onPress={() => nav.navigate('MeetupCreate', {})} />}
        />
      }
    >
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === 'active' && s.tabOn]} onPress={() => setTab('active')}>
          <Text style={tab === 'active' ? s.tabOnText : s.tabText}>액티브 ({active.length})</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === 'inactive' && s.tabOn]} onPress={() => setTab('inactive')}>
          <Text style={tab === 'inactive' ? s.tabOnText : s.tabText}>인액티브 ({inactive.length})</Text>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? '예정된 약속이 없어요' : '종료된 약속이 없어요'}
          description="친구와 첫 약속을 만들어보세요."
          action={tab === 'active' ? <Button label="새 약속 만들기" onPress={() => nav.navigate('MeetupCreate', {})} /> : undefined}
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          data={items}
          keyExtractor={(m) => m.id}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={loading} onRefresh={() => refresh(true)} />}
          renderItem={({ item }) => {
            const b = badgeFor(item.status, item.starts_at);
            const isMine = item.creator_id === me;
            const isPending = item.my_status === 'pending';
            return (
              <Card
                variant="row"
                style={[isMine && s.mine, isPending && s.pending]}
                onPress={() => nav.navigate('MeetupDetail', { id: item.id })}
              >
                {(b || isPending) && (
                  <View style={s.badgeRow}>
                    {isPending && <Badge tone="pending">응답 대기</Badge>}
                    {b && <Badge tone={b.tone}>{b.label}</Badge>}
                  </View>
                )}
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.meta}>📍 {item.place_name} · {new Date(item.starts_at).toLocaleString()}</Text>
              </Card>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  meta:  { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
  mine:  { backgroundColor: '#FFF6CC', borderColor: colors.brandSecondary, borderWidth: 1 },
  pending: { backgroundColor: colors.surfaceSubtle, borderColor: colors.warning, borderWidth: 1, borderStyle: 'dashed' },
  badgeRow: { flexDirection: 'row', gap: spacing(1.5), marginBottom: spacing(1.5) },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing(3), marginBottom: spacing(2), gap: spacing(2) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing(2), borderRadius: radius.sm, backgroundColor: colors.ghostOverlay },
  tabOn: { backgroundColor: colors.surfaceDark },
  tabText: { color: colors.inkInverse, fontFamily: fontFamily.semibold, fontSize: fontSize.sm },
  tabOnText: { color: colors.brandSecondary, fontFamily: fontFamily.bold, fontSize: fontSize.sm },
});
