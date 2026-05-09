import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { env } from '@/lib/env';
import type { Message } from '@/api/chat';

interface Props { msg: Message; mine: boolean; }

function imageHttpUrl(path: string) {
  // path는 'chat-images/<room>/<file>' 형식
  return `${env.SUPABASE_URL}/storage/v1/object/authenticated/${path}`;
}

export function MessageBubble({ msg, mine }: Props) {
  return (
    <View style={[s.row, mine && s.rowMine]}>
      <View style={[s.bubble, mine ? s.mine : s.theirs]}>
        {msg.kind === 'text' && <Text style={mine ? s.textMine : s.textTheirs}>{msg.body}</Text>}

        {msg.kind === 'image' && msg.image_url && (
          <Image source={{ uri: imageHttpUrl(msg.image_url) }} style={s.image} />
        )}

        {msg.kind === 'place' && msg.place_payload && (
          <Pressable onPress={() => {
            const { lat, lng, name } = msg.place_payload;
            Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(name)}@${lat},${lng}`);
          }}>
            <View style={s.place}>
              <Text style={s.placeName}>📍 {msg.place_payload.name}</Text>
              {msg.place_payload.address ? <Text style={s.placeAddr}>{msg.place_payload.address}</Text> : null}
              <View style={{ height: 100, marginTop: 6, borderRadius: 6, overflow: 'hidden' }}>
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{ latitude: msg.place_payload.lat, longitude: msg.place_payload.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  pointerEvents="none"
                >
                  <Marker coordinate={{ latitude: msg.place_payload.lat, longitude: msg.place_payload.lng }} />
                </MapView>
              </View>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: 8 },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: '#111' },
  theirs: { backgroundColor: '#eee' },
  textMine: { color: '#fff', fontSize: 15 },
  textTheirs: { color: '#111', fontSize: 15 },
  image: { width: 220, height: 220, borderRadius: 8 },
  place: { width: 240 },
  placeName: { fontSize: 14, fontWeight: '600' },
  placeAddr: { fontSize: 12, color: '#555' },
});
