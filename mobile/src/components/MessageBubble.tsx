import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Linking, Modal, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/api/chat';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props { msg: Message; mine: boolean; }

const BUCKET = 'chat-images';
const { width: screenW, height: screenH } = Dimensions.get('window');

function useSignedImage(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    const key = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path;
    let cancelled = false;
    supabase.storage.from(BUCKET).createSignedUrl(key, 3600).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        console.log('[signedUrl] error', error);
        return;
      }
      setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function ImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={s.viewerBackdrop} onPress={onClose}>
        <Image source={{ uri }} style={{ width: screenW, height: screenH }} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}

export function MessageBubble({ msg, mine }: Props) {
  const signedUrl = useSignedImage(msg.kind === 'image' ? msg.image_url : null);
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <View style={[s.row, mine && s.rowMine]}>
      <View style={[s.bubble, mine ? s.mine : s.theirs]}>
        {msg.kind === 'text' && <Text style={mine ? s.textMine : s.textTheirs}>{msg.body}</Text>}

        {msg.kind === 'image' && (
          signedUrl
            ? <>
                <Pressable onPress={() => setViewerOpen(true)}>
                  <Image source={{ uri: signedUrl }} style={s.image} resizeMode="cover" />
                </Pressable>
                {viewerOpen && <ImageViewer uri={signedUrl} onClose={() => setViewerOpen(false)} />}
              </>
            : <View style={[s.image, s.imageLoading]}><Text style={s.loadingText}>로딩...</Text></View>
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
  row: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: spacing(2) },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: radius.xs, paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  mine: { backgroundColor: colors.brandSecondary },
  theirs: { backgroundColor: colors.surface },
  textMine: { color: colors.ink, fontFamily: fontFamily.semibold, fontSize: fontSize.base },
  textTheirs: { color: colors.ink, fontFamily: fontFamily.regular, fontSize: fontSize.base },
  image: { width: 220, height: 220, borderRadius: radius.xs },
  imageLoading: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  place: { width: 240 },
  placeName: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.base },
  placeAddr: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm },
});
