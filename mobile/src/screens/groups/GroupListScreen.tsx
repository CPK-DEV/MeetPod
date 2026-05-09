import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { listGroups, type Group } from '@/api/groups';
import { PrimaryButton } from '@/components/PrimaryButton';

export function GroupListScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await listGroups()); } finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.root}>
      <FlatList
        data={items}
        keyExtractor={(g) => g.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => nav.navigate('GroupDetail', { id: item.id })}>
            <Text style={s.name}>{item.name}</Text>
            {item.description ? <Text style={s.sub}>{item.description}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.empty}>아직 그룹이 없어요</Text>}
      />
      <View style={s.footer}>
        <PrimaryButton label="그룹 만들기" onPress={() => nav.navigate('GroupCreate')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontSize: 18, fontWeight: '600' },
  sub: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
  footer: { padding: 16 },
});
