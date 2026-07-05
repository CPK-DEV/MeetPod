import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { usePlacePickStore } from '@/store/placePickStore';
import { sendImage, sendPlace, sendText, type Message } from '@/api/chat';
import { MessageBubble } from '@/components/MessageBubble';
import { ScreenContainer } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

const EMPTY_MESSAGES: Message[] = [];

export function ChatRoomScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { id: roomId } = route.params;
  const me = useAuthStore((s) => s.profile?.id) ?? '';
  const messages = useChatStore((s) => s.messages[roomId] ?? EMPTY_MESSAGES);
  const load = useChatStore((s) => s.loadMessages);
  const pushIncoming = useChatStore((s) => s.pushIncoming);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => { load(roomId); }, [roomId]);

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


  useFocusEffect(useCallback(() => {
    const p = usePlacePickStore.getState().consume();
    if (p) {
      sendPlace(roomId, { name: p.name, lat: p.lat, lng: p.lng, address: p.address, google_id: p.google_id })
        .catch((e) => Alert.alert('전송 실패', e.message));
    }
  }, [roomId]));

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText('');
    try { await sendText(roomId, t); } catch (e: any) { Alert.alert('전송 실패', e.message); }
  }

  async function pickAndSendImage() {
    if (uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
    const objectKey = `${roomId}/${Date.now()}.${ext}`;
    const contentType = asset.mimeType ?? `image/${ext}`;
    setUploading(true);
    try {
      const ab = await (await fetch(asset.uri)).arrayBuffer();
      const { error } = await supabase.storage.from('chat-images').upload(objectKey, ab, { contentType, upsert: false });
      if (error) throw error;
      await sendImage(roomId, `chat-images/${objectKey}`);
    } catch (e: any) {
      Alert.alert('업로드 실패', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="대화" back />}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble msg={item} mine={item.sender_id === me} />}
          ListEmptyComponent={<Text style={s.empty}>첫 메시지를 보내보세요</Text>}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: spacing(2) }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={s.inputRow}>
          <Pressable style={[s.iconBtn, uploading && s.iconBtnDisabled]} onPress={pickAndSendImage} disabled={uploading}>
            <Text style={s.iconTxt}>{uploading ? '⏳' : '🖼'}</Text>
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => nav.navigate('PlacePicker')}><Text style={s.iconTxt}>📍</Text></Pressable>
          <Input style={s.textInput} value={text} onChangeText={setText} placeholder="메시지" multiline />
          <Pressable style={s.sendBtn} onPress={send}><Text style={s.sendTxt}>전송</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  empty: { textAlign: 'center', marginTop: 64, color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.base },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing(2), backgroundColor: colors.brandPrimaryDark },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: spacing(1) },
  iconBtnDisabled: { opacity: 0.4 },
  iconTxt: { fontSize: 20 },
  textInput: { flex: 1, marginRight: spacing(2), maxHeight: 100 },
  sendBtn: { backgroundColor: colors.brandSecondary, borderRadius: radius.xs, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5) },
  sendTxt: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.sm },
});
