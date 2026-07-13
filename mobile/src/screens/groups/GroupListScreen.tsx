import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { listGroups, type Group } from '@/api/groups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { HeaderButton } from '@/ui/HeaderButton';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function GroupListScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await listGroups()); } finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]));

  return (
    <ScreenContainer
      hasTabBar
      header={<Header title="그룹" subtitle={`${items.length}개`} action={<HeaderButton icon="+" onPress={() => nav.navigate('GroupCreate')} />} />}
    >
      {items.length === 0 ? (
        <EmptyState
          title="그룹이 없어요"
          description="친구와 자주 만나는 모임을 그룹으로 만들어보세요."
          action={<Button label="그룹 만들기" onPress={() => nav.navigate('GroupCreate')} />}
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          data={items}
          keyExtractor={(g) => g.id}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={refreshing} onRefresh={load} />}
          renderItem={({ item }) => (
            <Card variant="row" onPress={() => nav.navigate('GroupDetail', { id: item.id })}>
              <Text style={s.name}>{item.name}</Text>
              {item.description ? <Text style={s.sub}>{item.description}</Text> : null}
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  name: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  sub: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
