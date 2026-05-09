import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { autocomplete, placeDetails, type PlaceSuggestion } from '@/lib/places';
import * as Crypto from 'expo-crypto';

export function PlacePickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionToken = useMemo(() => Crypto.randomUUID(), []);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try { setItems(await autocomplete(q, sessionToken)); } finally { setBusy(false); }
    }, 250);
  }, [q, sessionToken]);

  async function pick(s: PlaceSuggestion) {
    const d = await placeDetails(s.place_id, sessionToken);
    nav.goBack();
    setTimeout(() => {
      // 직전 화면이 받을 수 있도록 setParams 사용 — 안전하게 양쪽 화면 모두 처리
      const parent = nav.getState();
      const prev = parent.routes[parent.index - 1];
      if (prev) nav.navigate({ name: prev.name, params: { picked: d }, merge: true } as any);
    }, 0);
  }

  return (
    <View style={s.root}>
      <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="장소 검색" autoFocus />
      {busy ? <ActivityIndicator /> : null}
      <FlatList
        data={items}
        keyExtractor={(p) => p.place_id}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => pick(item)}>
            <Text style={s.desc}>{item.description}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 12, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },
  row: { padding: 14, borderBottomWidth: 1, borderColor: '#eee' },
  desc: { fontSize: 15 },
});
