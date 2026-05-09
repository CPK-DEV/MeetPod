import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface Props { name: string; lat: number; lng: number; address?: string | null; }

export function PlaceCard({ name, lat, lng, address }: Props) {
  return (
    <View style={s.card}>
      <Text style={s.name}>{name}</Text>
      {address ? <Text style={s.addr}>{address}</Text> : null}
      <View style={s.mapWrap}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          pointerEvents="none"
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        </MapView>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden', marginVertical: 8 },
  name: { fontSize: 16, fontWeight: '600', padding: 12 },
  addr: { paddingHorizontal: 12, paddingBottom: 8, color: '#666' },
  mapWrap: { height: 140 },
});
