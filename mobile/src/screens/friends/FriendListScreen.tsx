import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listFriends, type FriendSummary } from '@/api/friendships';

export function FriendListScreen() {
  const [items, setItems] = useState<FriendSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setRefreshing(true); try { setItems(await listFriends()); } finally { setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={items}
      keyExtractor={(f) => f.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      renderItem={({ item }) => (
        <View style={s.row}>
          <Text style={s.name}>{item.display_name}</Text>
          {item.handle ? <Text style={s.handle}>@{item.handle}</Text> : null}
        </View>
      )}
      ListEmptyComponent={<Text style={s.empty}>아직 친구가 없어요</Text>}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  handle: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
});
