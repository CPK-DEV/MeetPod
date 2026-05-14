import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props { name: string; lat: number; lng: number; address?: string | null; }

export function PlaceCard({ name, lat, lng, address }: Props) {
  return (
    <View style={s.card}>
      <View style={s.info}>
        <Text style={s.name}>📍 {name}</Text>
        {address ? <Text style={s.addr}>{address}</Text> : null}
      </View>
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
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xs,
    marginHorizontal: spacing(3), marginBottom: spacing(2),
    overflow: 'hidden',
  },
  info: { padding: spacing(3.5) },
  name: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  addr: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
  mapWrap: { height: 110 },
});
