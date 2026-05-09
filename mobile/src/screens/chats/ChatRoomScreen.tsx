import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import {
  createUploadUrl, sendImage, sendPlace, sendText, type Message,
} from '@/api/chat';
import { MessageBubble } from '@/components/MessageBubble';

export function ChatRoomScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { id: roomId } = route.params;
  const me = useAuthStore((s) => s.profile?.id) ?? '';
  const messages = useChatStore((s) => s.messages[roomId] ?? []);
  const load = useChatStore((s) => s.loadMessages);
  const pushIncoming = useChatStore((s) => s.pushIncoming);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => { load(roomId); }, [roomId]);

  // Realtime 구독
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => pushIncoming(payload.new as Message),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, pushIncoming]);

  // 새 메시지 도착 시 스크롤
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  // place 메시지: PlacePicker에서 돌아올 때 처리
  useEffect(() => {
    const picked = route.params?.picked;
    if (picked) {
      sendPlace(roomId, { name: picked.name, lat: picked.lat, lng: picked.lng, address: picked.address, google_id: picked.google_id })
        .catch((e) => Alert.alert('전송 실패', e.message));
      nav.setParams({ picked: undefined });
    }
  }, [route.params?.picked]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await sendText(roomId, t);
    } catch (e: any) {
      Alert.alert('전송 실패', e.message);
    }
  }

  async function pickAndSendImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
    try {
      const u = await createUploadUrl(roomId, ext);
      const blob = await (await fetch(asset.uri)).blob();
      await axios.put(u.signed_url, blob, { headers: { 'Content-Type': asset.mimeType ?? `image/${ext}` } });
      await sendImage(roomId, u.public_path);
    } catch (e: any) {
      Alert.alert('업로드 실패', e.message);
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble msg={item} mine={item.sender_id === me} />}
        ListEmptyComponent={<Text style={s.empty}>첫 메시지를 보내보세요</Text>}
      />
      <View style={s.inputRow}>
        <Pressable style={s.iconBtn} onPress={pickAndSendImage}><Text>🖼</Text></Pressable>
        <Pressable style={s.iconBtn} onPress={() => nav.navigate('PlacePicker')}><Text>📍</Text></Pressable>
        <TextInput style={s.input} value={text} onChangeText={setText} placeholder="메시지" multiline />
        <Pressable style={s.sendBtn} onPress={send}><Text style={{ color: '#fff' }}>전송</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1, borderColor: '#eee' },
  iconBtn: { padding: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, maxHeight: 120 },
  sendBtn: { backgroundColor: '#111', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 6 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
});
