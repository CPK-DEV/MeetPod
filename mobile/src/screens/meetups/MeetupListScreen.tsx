import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useMeetupsStore } from '@/store/meetupsStore';
import { PrimaryButton } from '@/components/PrimaryButton';

export function MeetupListScreen() {
  const nav = useNavigation<any>();
  const { ids, byId, loading, refresh } = useMeetupsStore();
  useFocusEffect(useCallback(() => { refresh(false); }, [refresh]));

  return (
    <View style={s.root}>
      <FlatList
        data={ids.map((i) => byId[i])}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(false)} />}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => nav.navigate('MeetupDetail', { id: item.id })}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.sub}>{new Date(item.starts_at).toLocaleString()}</Text>
            <Text style={s.sub}>{item.place_name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.empty}>예정된 약속이 없어요</Text>}
      />
      <View style={s.footer}>
        <PrimaryButton label="새 약속" onPress={() => nav.navigate('MeetupCreate', {})} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 17, fontWeight: '600' },
  sub: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
  footer: { padding: 16 },
});
