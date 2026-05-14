import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listFriends, type FriendSummary } from '@/api/friendships';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Avatar } from '@/ui/Avatar';
import { EmptyState } from '@/ui/EmptyState';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function FriendListScreen() {
  const [items, setItems] = useState<FriendSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setRefreshing(true); try { setItems(await listFriends()); } finally { setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScreenContainer hasTabBar header={<Header title="친구" subtitle={`${items.length}명`} back />}>
      {items.length === 0 ? (
        <EmptyState title="친구가 없어요" description="초대 링크를 보내 친구를 추가하세요." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={refreshing} onRefresh={load} />}
          renderItem={({ item }) => (
            <Card variant="row">
              <View style={s.row}>
                <Avatar userId={item.id} name={item.display_name} uri={item.avatar_url} size={40} />
                <View style={{ marginLeft: spacing(3), flex: 1 }}>
                  <Text style={s.name}>{item.display_name}</Text>
                  {item.handle ? <Text style={s.handle}>@{item.handle}</Text> : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  handle: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(0.5) },
});
