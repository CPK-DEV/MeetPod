import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { autocomplete, placeDetails, type LocationBias, type PlaceSuggestion } from '@/lib/places';
import { usePlacePickStore } from '@/store/placePickStore';
import * as Crypto from 'expo-crypto';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Card } from '@/ui/Card';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function PlacePickerScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [bias, setBias] = useState<LocationBias | null>(null);
  const sessionToken = useMemo(() => Crypto.randomUUID(), []);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  async function pick(sg: PlaceSuggestion) {
    const d = await placeDetails(sg.place_id, sessionToken);
    usePlacePickStore.getState().set(d);
    nav.goBack();
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="장소 선택" back />}>
      <View style={{ padding: spacing(3) }}>
        <Input value={q} onChangeText={setQ} placeholder="장소 검색" autoFocus />
      </View>
      {busy && <ActivityIndicator color={colors.inkInverse} />}
      <FlatList
        data={items}
        keyExtractor={(p) => p.place_id}
        contentContainerStyle={{ paddingBottom: TABBAR_RESERVED_HEIGHT }}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => pick(item)}>
            <Text style={s.desc}>{item.description}</Text>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  desc: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.md },
});
