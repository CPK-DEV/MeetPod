import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { autocomplete, placeDetails, type LocationBias, type PlaceSuggestion } from '@/lib/places';
import { usePlacePickStore } from '@/store/placePickStore';
import * as Crypto from 'expo-crypto';

export function PlacePickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [bias, setBias] = useState<LocationBias | null>(null);
  const sessionToken = useMemo(() => Crypto.randomUUID(), []);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 최초 진입 시 현재 위치 1회 가져와서 검색 우선순위에 사용
  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      let granted = perm.granted;
      if (!granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        granted = req.granted;
      }
      if (!granted) return;
      try {
        const pos = await Location.getLastKnownPositionAsync()
          ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos) setBias({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch (e) {
        console.log('[place] location fetch failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try { setItems(await autocomplete(q, sessionToken, 'ko', bias)); } finally { setBusy(false); }
    }, 250);
  }, [q, sessionToken, bias]);

  async function pick(s: PlaceSuggestion) {
    const d = await placeDetails(s.place_id, sessionToken);
    usePlacePickStore.getState().set(d);
    nav.goBack();
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
