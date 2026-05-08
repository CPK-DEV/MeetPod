# Plan 10 — Mobile: 채팅 + Realtime + 푸시 등록

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 채팅방 목록/대화 화면, 텍스트·이미지·장소 메시지 송수신(Realtime 구독 포함), 이미지 picker → signed upload → 메시지 송신, Place 메시지 카드 렌더, Expo push token 등록 엔드포인트(백엔드)와 모바일 등록 흐름을 구현한다.

**Architecture:**
- 송신은 백엔드 `POST /api/chat/rooms/{room_id}/messages`(Plan 5). 수신은 모바일이 `messages` 테이블 room_id 필터로 Realtime 구독.
- 이미지: `expo-image-picker`로 로컬 파일 선택 → 백엔드 `POST .../upload-url`로 signed URL 발급 → 모바일이 PUT으로 직접 업로드 → 반환된 path로 `kind='image'` 메시지 송신.
- Place 메시지: PlacePickerScreen(Plan 8)을 재사용. 결과를 `place_payload`로 송신.
- 푸시: `expo-notifications`로 token 획득 → 백엔드 `PUT /api/profiles/me/push-token`(이번 Plan에 추가) → `profiles.expo_push_token`에 저장. 실제 발송은 Plan 11.

**Tech Stack:** Expo, expo-image-picker, expo-notifications, react-native-maps(place 카드), Supabase Realtime, axios, Zustand.

**전제:** Plan 7/8/9 완료(MainTabs, Stack, PlacePicker 재사용). Plan 5 백엔드 라이브.

---

## File Structure

```
MeetPod/mobile/src/
├── api/
│   └── chat.ts                       # rooms, messages, upload-url
├── store/
│   └── chatStore.ts                  # rooms cache + per-room messages
├── lib/
│   └── push_registrar.ts             # expo-notifications token + 권한
├── components/
│   └── MessageBubble.tsx
├── navigation/
│   └── ChatsStack.tsx
└── screens/
    └── chats/
        ├── ChatListScreen.tsx
        └── ChatRoomScreen.tsx

MeetPod/backend/app/
├── routers/profiles.py               # Modify: PUT /me/push-token
├── services/profile_service.py       # Modify: set_push_token
└── tests/test_profiles_push.py       # 새 테스트
```

---

## Task 1: 백엔드 — push token 등록 엔드포인트

**Files:**
- Modify: `MeetPod/backend/app/services/profile_service.py`
- Modify: `MeetPod/backend/app/routers/profiles.py`
- Modify: `MeetPod/backend/app/models/profile.py`
- Create: `MeetPod/backend/tests/test_profiles_push.py`

- [ ] **Step 1: 모델 확장**

Edit `MeetPod/backend/app/models/profile.py` — 파일 끝에 추가:
```python
class PushTokenUpdate(BaseModel):
    expo_push_token: str | None
```

- [ ] **Step 2: service 함수**

Edit `MeetPod/backend/app/services/profile_service.py` — 파일 끝에 추가:
```python
def set_push_token(user_id: str, token: str | None) -> None:
    sb = get_supabase()
    sb.table("profiles").update({"expo_push_token": token}).eq("id", user_id).execute()
```

- [ ] **Step 3: 라우터에 엔드포인트**

Edit `MeetPod/backend/app/routers/profiles.py` — 임포트와 라우트 추가:
```python
from fastapi import status
from app.models.profile import PushTokenUpdate
from app.services.profile_service import set_push_token

@router.put("/me/push-token", status_code=status.HTTP_204_NO_CONTENT)
def put_push_token(body: PushTokenUpdate, user: CurrentUser = Depends(current_user)) -> None:
    set_push_token(user.id, body.expo_push_token)
```

- [ ] **Step 4: 테스트 (실패)**

Create `MeetPod/backend/tests/test_profiles_push.py`:
```python
from unittest.mock import patch


def test_put_push_token(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.set_push_token") as m:
            r = client.put("/api/profiles/me/push-token", json={"expo_push_token": "ExponentPushToken[abc]"})
    assert r.status_code == 204
    m.assert_called_with("u1", "ExponentPushToken[abc]")


def test_put_push_token_null(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.set_push_token") as m:
            r = client.put("/api/profiles/me/push-token", json={"expo_push_token": None})
    assert r.status_code == 204
    m.assert_called_with("u1", None)
```

- [ ] **Step 5: 통과 확인**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
pytest tests/test_profiles_push.py -v
```
Expected: 2 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/models/profile.py MeetPod/backend/app/services/profile_service.py MeetPod/backend/app/routers/profiles.py MeetPod/backend/tests/test_profiles_push.py
git commit -m "feat(backend): PUT /api/profiles/me/push-token"
```

---

## Task 2: 모바일 chat API + store

**Files:**
- Create: `MeetPod/mobile/src/api/chat.ts`
- Create: `MeetPod/mobile/src/store/chatStore.ts`

- [ ] **Step 1: api/chat.ts**

Create `MeetPod/mobile/src/api/chat.ts`:
```ts
import { apiClient } from './client';

export interface ChatRoom {
  id: string;
  kind: 'group' | 'meetup';
  ref_id: string;
  archived_at: string | null;
  created_at: string;
}
export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  kind: 'text' | 'image' | 'place';
  body: string | null;
  image_url: string | null;
  place_payload: any | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}
export interface UploadUrlResponse {
  object_key: string;
  signed_url: string;
  public_path: string;
  expires_in: number;
}

export const listRooms = () => apiClient.get<ChatRoom[]>('/chat/rooms').then(r => r.data);
export const listMessages = (roomId: string, before?: string, limit = 50) =>
  apiClient.get<Message[]>(`/chat/rooms/${roomId}/messages`, { params: { before, limit } }).then(r => r.data);

export const sendText = (roomId: string, body: string) =>
  apiClient.post<Message>(`/chat/rooms/${roomId}/messages`, { kind: 'text', body }).then(r => r.data);
export const sendImage = (roomId: string, imageUrl: string) =>
  apiClient.post<Message>(`/chat/rooms/${roomId}/messages`, { kind: 'image', image_url: imageUrl }).then(r => r.data);
export const sendPlace = (roomId: string, place_payload: any) =>
  apiClient.post<Message>(`/chat/rooms/${roomId}/messages`, { kind: 'place', place_payload }).then(r => r.data);

export const createUploadUrl = (roomId: string, ext: string) =>
  apiClient.post<UploadUrlResponse>(`/chat/rooms/${roomId}/upload-url`, { ext }).then(r => r.data);

export const setPushToken = (token: string | null) =>
  apiClient.put('/profiles/me/push-token', { expo_push_token: token });
```

- [ ] **Step 2: chatStore.ts**

Create `MeetPod/mobile/src/store/chatStore.ts`:
```ts
import { create } from 'zustand';
import { listMessages, listRooms, type ChatRoom, type Message } from '@/api/chat';

interface State {
  rooms: ChatRoom[];
  messages: Record<string, Message[]>;        // roomId → 최신순 정렬(asc)
  refreshRooms: () => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  pushIncoming: (m: Message) => void;
  appendOptimistic: (m: Message) => void;
}

export const useChatStore = create<State>((set, get) => ({
  rooms: [],
  messages: {},

  refreshRooms: async () => {
    const rooms = await listRooms();
    set({ rooms });
  },

  loadMessages: async (roomId) => {
    const desc = await listMessages(roomId);
    const asc = [...desc].reverse();
    set((s) => ({ messages: { ...s.messages, [roomId]: asc } }));
  },

  pushIncoming: (m) => {
    const list = get().messages[m.room_id] ?? [];
    if (list.some((x) => x.id === m.id)) return;
    set((s) => ({ messages: { ...s.messages, [m.room_id]: [...list, m] } }));
  },

  appendOptimistic: (m) => {
    set((s) => ({ messages: { ...s.messages, [m.room_id]: [...(s.messages[m.room_id] ?? []), m] } }));
  },
}));
```

- [ ] **Step 3: typecheck + Commit**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx tsc --noEmit
git add MeetPod/mobile/src/api/chat.ts MeetPod/mobile/src/store/chatStore.ts
git commit -m "feat(mobile): chat api + store"
```

---

## Task 3: MessageBubble + ChatListScreen

**Files:**
- Create: `MeetPod/mobile/src/components/MessageBubble.tsx`
- Create: `MeetPod/mobile/src/screens/chats/ChatListScreen.tsx`

- [ ] **Step 1: MessageBubble**

Create `MeetPod/mobile/src/components/MessageBubble.tsx`:
```tsx
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
```

- [ ] **Step 2: ChatListScreen**

Create `MeetPod/mobile/src/screens/chats/ChatListScreen.tsx`:
```tsx
import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useChatStore } from '@/store/chatStore';

export function ChatListScreen() {
  const nav = useNavigation<any>();
  const rooms = useChatStore((s) => s.rooms);
  const refresh = useChatStore((s) => s.refreshRooms);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={rooms}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
      renderItem={({ item }) => (
        <Pressable style={s.row} onPress={() => nav.navigate('ChatRoom', { id: item.id, kind: item.kind })}>
          <Text style={s.title}>{item.kind === 'group' ? '그룹' : '약속'} 채팅</Text>
          <Text style={s.sub}>{item.archived_at ? '아카이브됨' : ''}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={s.empty}>채팅방이 없어요</Text>}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#888', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
});
```

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/mobile/src/components/MessageBubble.tsx MeetPod/mobile/src/screens/chats/ChatListScreen.tsx
git commit -m "feat(mobile): chat list + message bubble (text/image/place)"
```

---

## Task 4: ChatRoomScreen (Realtime + 송신)

**Files:**
- Create: `MeetPod/mobile/src/screens/chats/ChatRoomScreen.tsx`

- [ ] **Step 1: 의존성**

Run:
```powershell
npx expo install expo-image-picker
```

- [ ] **Step 2: 화면**

Create `MeetPod/mobile/src/screens/chats/ChatRoomScreen.tsx`:
```tsx
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
```

- [ ] **Step 3: PlacePickerScreen이 ChatRoom 호출도 지원하도록**

Plan 8의 PlacePickerScreen은 `nav.navigate({ name: 'MeetupCreate', merge: true })`로 고정. 채팅에서도 사용 가능하도록 변경:

Edit `MeetPod/mobile/src/screens/meetups/PlacePickerScreen.tsx` — `pick` 함수를 다음으로 교체:
```ts
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
```

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/mobile/src/screens/chats/ChatRoomScreen.tsx MeetPod/mobile/src/screens/meetups/PlacePickerScreen.tsx MeetPod/mobile/package.json
git commit -m "feat(mobile): chat room with realtime + image/place send"
```

---

## Task 5: ChatsStack + MainTabs 연결

**Files:**
- Create: `MeetPod/mobile/src/navigation/ChatsStack.tsx`
- Modify: `MeetPod/mobile/src/navigation/MainTabs.tsx`

- [ ] **Step 1: Stack**

Create `MeetPod/mobile/src/navigation/ChatsStack.tsx`:
```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatListScreen } from '@/screens/chats/ChatListScreen';
import { ChatRoomScreen } from '@/screens/chats/ChatRoomScreen';
import { PlacePickerScreen } from '@/screens/meetups/PlacePickerScreen';

const S = createNativeStackNavigator();

export function ChatsStack() {
  return (
    <S.Navigator>
      <S.Screen name="ChatList" component={ChatListScreen} options={{ title: '채팅' }} />
      <S.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: '대화' }} />
      <S.Screen name="PlacePicker" component={PlacePickerScreen} options={{ title: '장소 공유' }} />
    </S.Navigator>
  );
}
```

- [ ] **Step 2: MainTabs 교체**

Edit `MeetPod/mobile/src/navigation/MainTabs.tsx` — `ChatsPlaceholder` 임포트 제거:
```tsx
import { ChatsStack } from './ChatsStack';
// ...
<Tab.Screen name="Chats" component={ChatsStack} options={{ headerShown: false }} />
```

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/mobile/src/navigation/ChatsStack.tsx MeetPod/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): wire chats stack into main tabs"
```

---

## Task 6: 푸시 토큰 등록

**Files:**
- Create: `MeetPod/mobile/src/lib/push_registrar.ts`
- Modify: `MeetPod/mobile/src/store/authStore.ts`
- Modify: `MeetPod/mobile/app.json`

- [ ] **Step 1: 의존성 + plugin**

Run:
```powershell
npx expo install expo-notifications expo-device
```

Edit `MeetPod/mobile/app.json` — `plugins` 배열에 추가:
```json
["expo-notifications", { "icon": "./assets/icon.png", "color": "#111111" }]
```

- [ ] **Step 2: push_registrar.ts**

Create `MeetPod/mobile/src/lib/push_registrar.ts`:
```ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { setPushToken } from '@/api/chat';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPush(): Promise<string | null> {
  if (!Device.isDevice) return null;        // 시뮬레이터 미지원
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = (await import('expo-constants')).default.expoConfig?.extra?.eas?.projectId
    ?? (await import('expo-constants')).default.easConfig?.projectId;
  const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await setPushToken(t.data);
  return t.data;
}

export async function unregisterPush() {
  await setPushToken(null);
}
```

- [ ] **Step 3: authStore에 등록 호출 추가**

Edit `MeetPod/mobile/src/store/authStore.ts` — `hydrateAfterAuth` 마지막 `set({ profile: me, ... })` 직전에 동적 import로 호출(순환 import 회피):
```ts
    if (me.handle) {
      try {
        const { registerPush } = await import('@/lib/push_registrar');
        await registerPush();
      } catch {}
    }
```

`signOut` 함수 시작 부분에:
```ts
    try {
      const { unregisterPush } = await import('@/lib/push_registrar');
      await unregisterPush();
    } catch {}
```

- [ ] **Step 4: 라이브 검증**

실기기에서 로그인 → 권한 prompt → 승인 → DB 확인(Studio):
```sql
SELECT id, expo_push_token FROM profiles WHERE id='<my-uuid>';
```
Expected: `ExponentPushToken[...]` 형식 문자열 저장.

로그아웃 → 토큰이 NULL로 갱신.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/mobile/src/lib/push_registrar.ts MeetPod/mobile/src/store/authStore.ts MeetPod/mobile/app.json MeetPod/mobile/package.json
git commit -m "feat(mobile): expo push token registration on auth ready"
```

---

## Task 7: 라이브 채팅 검증

- [ ] **Step 1: 두 디바이스에서 그룹 채팅**

alice/bob 디바이스 각각 로그인 → Chats 탭 → 같은 그룹 룸 진입.
- alice가 텍스트 송신 → bob 화면에 즉시 표시 (Realtime).
- bob이 이미지 송신 (앨범에서 선택) → 업로드 → alice 화면에 이미지 carousel 표시.
- bob이 PlacePicker로 "스타벅스 강남R점" 선택 → place 카드가 alice 화면에 렌더, 탭 시 Google Maps 열림.

- [ ] **Step 2: Commit**

```powershell
git commit --allow-empty -m "chore(mobile): plan-10 verified end-to-end (chat + push token)"
```

---

## Self-Review Notes

§6.6 채팅 송수신 분담 정확히 구현(송=백엔드, 수=Realtime) ✓
이미지 업로드: signed URL → PUT → 메시지 송신 ✓
Place 메시지 카드 + 외부 지도 진입 ✓
푸시 토큰 등록 — 발송 워커는 Plan 11 ✓

**제외:** 메시지 수정/삭제 UI(API는 백엔드에 존재 — 후속), 읽음 표시.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
