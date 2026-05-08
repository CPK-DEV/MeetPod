# Plan 8 — Mobile: 약속 / Place Picker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 약속 목록·상세·생성·취소 화면, 멤버 선택 컴포넌트, Google Places autocomplete 기반 PlacePickerScreen, datetime 입력 UI, 본인 알림 설정을 구현한다. 위치 공유 화면(MeetupMap)은 Plan 9에서 다룬다.

**Architecture:**
- Plan 4 백엔드 라우터 호출. `meetupsStore`(zustand)에 목록만 캐시 + 화면 진입 시 refresh.
- PlacePickerScreen: Google Places Autocomplete REST 직접 호출(`https://maps.googleapis.com/maps/api/place/autocomplete/json`). API 키는 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` 사용.
- MemberPicker: 그룹 약속이면 `listMembers(group_id)` 결과를 default-checked 상태로 표시, 빠질 멤버 토글.
- DateTime: `@react-native-community/datetimepicker` (Expo 호환).

**Tech Stack:** Expo SDK 51, React Navigation, axios, Zustand, @react-native-community/datetimepicker, react-native-maps(상세 화면 지도 미리보기), Google Places API.

**전제:** Plan 7 완료 (네비게이션, GroupsStack 존재). Plan 4 백엔드 라이브.

---

## File Structure

```
MeetPod/mobile/src/
├── api/
│   └── meetups.ts
├── store/
│   └── meetupsStore.ts
├── lib/
│   └── places.ts                     # Google Places autocomplete + details
├── components/
│   ├── MemberPicker.tsx
│   └── PlaceCard.tsx
├── navigation/
│   └── MeetupsStack.tsx
└── screens/
    └── meetups/
        ├── MeetupListScreen.tsx
        ├── MeetupCreateScreen.tsx
        ├── MeetupDetailScreen.tsx
        └── PlacePickerScreen.tsx
```

---

## Task 1: meetups API + store

**Files:**
- Create: `MeetPod/mobile/src/api/meetups.ts`
- Create: `MeetPod/mobile/src/store/meetupsStore.ts`

- [ ] **Step 1: api/meetups.ts**

Create `MeetPod/mobile/src/api/meetups.ts`:
```ts
import { apiClient } from './client';

export interface Place {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  google_id?: string | null;
}
export interface Meetup {
  id: string;
  group_id: string | null;
  creator_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  place_name: string;
  place_lat: number;
  place_lng: number;
  place_address: string | null;
  place_google_id: string | null;
  location_share_minutes_before: number;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  created_at: string;
}
export interface Participant {
  user_id: string;
  status: string;
  joined_at: string;
}

export interface MeetupCreatePayload {
  title: string;
  starts_at: string;
  ends_at: string;
  place: Place;
  group_id?: string | null;
  participant_ids?: string[];
  location_share_minutes_before?: 10 | 20 | 30 | 60;
  self_reminder_minutes_before?: number | null;
}

export const listMeetups = (includeEnded = false) =>
  apiClient.get<Meetup[]>('/meetups', { params: { include_ended: includeEnded } }).then(r => r.data);

export const getMeetup = (id: string) =>
  apiClient.get<Meetup>(`/meetups/${id}`).then(r => r.data);

export const createMeetup = (body: MeetupCreatePayload) =>
  apiClient.post<Meetup>('/meetups', body).then(r => r.data);

export const cancelMeetup = (id: string) =>
  apiClient.post<Meetup>(`/meetups/${id}/cancel`).then(r => r.data);

export const listParticipants = (id: string) =>
  apiClient.get<Participant[]>(`/meetups/${id}/participants`).then(r => r.data);

export const upsertReminder = (mid: string, minutes_before: number) =>
  apiClient.put(`/meetups/${mid}/reminders/me`, { minutes_before });
```

- [ ] **Step 2: meetupsStore**

Create `MeetPod/mobile/src/store/meetupsStore.ts`:
```ts
import { create } from 'zustand';
import { listMeetups, type Meetup } from '@/api/meetups';

interface State {
  byId: Record<string, Meetup>;
  ids: string[];
  loading: boolean;
  refresh: (includeEnded?: boolean) => Promise<void>;
}

export const useMeetupsStore = create<State>((set) => ({
  byId: {},
  ids: [],
  loading: false,
  refresh: async (includeEnded = false) => {
    set({ loading: true });
    try {
      const items = await listMeetups(includeEnded);
      const byId: Record<string, Meetup> = {};
      const ids: string[] = [];
      for (const m of items) { byId[m.id] = m; ids.push(m.id); }
      set({ byId, ids });
    } finally {
      set({ loading: false });
    }
  },
}));
```

- [ ] **Step 3: typecheck + Commit**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx tsc --noEmit
git add MeetPod/mobile/src/api/meetups.ts MeetPod/mobile/src/store/meetupsStore.ts
git commit -m "feat(mobile): meetups api + store"
```

---

## Task 2: Google Places lib

**Files:**
- Create: `MeetPod/mobile/src/lib/places.ts`

- [ ] **Step 1: places.ts**

Create `MeetPod/mobile/src/lib/places.ts`:
```ts
import axios from 'axios';

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface PlaceSuggestion {
  place_id: string;
  description: string;
}
export interface PlaceDetail {
  google_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export async function autocomplete(input: string, sessionToken: string, language = 'ko'): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
    params: { input, key: KEY, sessiontoken: sessionToken, language },
  });
  return (data.predictions ?? []).map((p: any) => ({ place_id: p.place_id, description: p.description }));
}

export async function placeDetails(place_id: string, sessionToken: string, language = 'ko'): Promise<PlaceDetail> {
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params: {
      place_id, key: KEY, sessiontoken: sessionToken, language,
      fields: 'place_id,name,formatted_address,geometry/location',
    },
  });
  const r = data.result;
  return {
    google_id: r.place_id,
    name: r.name,
    address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  };
}
```

- [ ] **Step 2: Commit**

```powershell
git add MeetPod/mobile/src/lib/places.ts
git commit -m "feat(mobile): google places autocomplete + details"
```

---

## Task 3: PlacePickerScreen

**Files:**
- Create: `MeetPod/mobile/src/screens/meetups/PlacePickerScreen.tsx`

- [ ] **Step 1: 구현**

Create `MeetPod/mobile/src/screens/meetups/PlacePickerScreen.tsx`:
```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { autocomplete, placeDetails, type PlaceSuggestion } from '@/lib/places';
import * as Crypto from 'expo-crypto';

export function PlacePickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const onPick = route.params.onPick as string;            // callback name in store-style; we use nav events
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
    nav.navigate({ name: 'MeetupCreate', params: { picked: d }, merge: true });
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
```

- [ ] **Step 2: expo-crypto 설치**

Run:
```powershell
npx expo install expo-crypto
```

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/mobile/src/screens/meetups/PlacePickerScreen.tsx MeetPod/mobile/package.json
git commit -m "feat(mobile): place picker with google autocomplete"
```

---

## Task 4: MemberPicker 컴포넌트

**Files:**
- Create: `MeetPod/mobile/src/components/MemberPicker.tsx`

- [ ] **Step 1: 구현**

Create `MeetPod/mobile/src/components/MemberPicker.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { listMembers, type GroupMember } from '@/api/groups';
import { listFriends, type FriendSummary } from '@/api/friendships';
import { useAuthStore } from '@/store/authStore';

interface Props {
  mode: 'group' | 'friends';
  groupId?: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function MemberPicker({ mode, groupId, selectedIds, onChange }: Props) {
  const me = useAuthStore((s) => s.profile?.id);
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    (async () => {
      if (mode === 'group' && groupId) {
        const ms = await listMembers(groupId);
        const others = ms.filter((m) => m.user_id !== me).map((m) => ({ id: m.user_id, label: m.user_id }));
        setItems(others);
        // group 약속: 기본 전체 선택
        if (selectedIds.size === 0) onChange(new Set(others.map((o) => o.id)));
      } else {
        const fs = await listFriends();
        setItems(fs.map((f) => ({ id: f.id, label: f.handle ? `@${f.handle} (${f.display_name})` : f.display_name })));
      }
    })();
  }, [mode, groupId, me]);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => {
        const checked = selectedIds.has(item.id);
        return (
          <Pressable style={s.row} onPress={() => toggle(item.id)}>
            <Text style={s.box}>{checked ? '☑' : '☐'}</Text>
            <Text style={s.label}>{item.label}</Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text style={s.empty}>{mode === 'friends' ? '친구가 없어요' : '다른 멤버가 없어요'}</Text>}
    />
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  box: { fontSize: 22, marginRight: 12 },
  label: { fontSize: 16 },
  empty: { color: '#999', textAlign: 'center', padding: 24 },
});
```

- [ ] **Step 2: Commit**

```powershell
git add MeetPod/mobile/src/components/MemberPicker.tsx
git commit -m "feat(mobile): member picker (group default-checked / friends)"
```

---

## Task 5: MeetupCreateScreen + datetime + share window + reminder

**Files:**
- Create: `MeetPod/mobile/src/screens/meetups/MeetupCreateScreen.tsx`

- [ ] **Step 1: 의존성 설치**

Run:
```powershell
npx expo install @react-native-community/datetimepicker
```

- [ ] **Step 2: 화면**

Create `MeetPod/mobile/src/screens/meetups/MeetupCreateScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createMeetup, type MeetupCreatePayload, type Place } from '@/api/meetups';
import { MemberPicker } from '@/components/MemberPicker';
import { PrimaryButton } from '@/components/PrimaryButton';

const SHARE_OPTIONS = [10, 20, 30, 60] as const;
const REMINDER_OPTIONS = [10, 30, 60, 120] as const;

export function MeetupCreateScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialGroupId = route.params?.group_id ?? null;

  const [title, setTitle] = useState('');
  const [starts, setStarts] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [ends, setEnds] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [showStartsPicker, setShowStartsPicker] = useState(false);
  const [showEndsPicker, setShowEndsPicker] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [share, setShare] = useState<typeof SHARE_OPTIONS[number]>(20);
  const [reminder, setReminder] = useState<number | null>(30);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (route.params?.picked) {
      const p = route.params.picked;
      setPlace({ name: p.name, lat: p.lat, lng: p.lng, address: p.address, google_id: p.google_id });
    }
  }, [route.params?.picked]);

  async function submit() {
    if (!title.trim()) return Alert.alert('제목을 입력하세요');
    if (!place) return Alert.alert('장소를 선택하세요');
    if (ends <= starts) return Alert.alert('종료 시간이 시작 시간 이후여야 합니다');

    const body: MeetupCreatePayload = {
      title: title.trim(),
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      place,
      group_id: initialGroupId,
      participant_ids: Array.from(participants),
      location_share_minutes_before: share,
      self_reminder_minutes_before: reminder ?? null,
    };
    setBusy(true);
    try {
      const m = await createMeetup(body);
      nav.replace('MeetupDetail', { id: m.id });
    } catch (e: any) {
      Alert.alert('생성 실패', e.response?.data?.detail ?? e.message);
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.label}>제목</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={120} />

      <Text style={s.label}>시작</Text>
      <Pressable style={s.input} onPress={() => setShowStartsPicker(true)}><Text>{starts.toLocaleString()}</Text></Pressable>
      {showStartsPicker && (
        <DateTimePicker value={starts} mode="datetime" onChange={(_, d) => { setShowStartsPicker(Platform.OS === 'ios'); if (d) setStarts(d); }} />
      )}

      <Text style={s.label}>종료</Text>
      <Pressable style={s.input} onPress={() => setShowEndsPicker(true)}><Text>{ends.toLocaleString()}</Text></Pressable>
      {showEndsPicker && (
        <DateTimePicker value={ends} mode="datetime" onChange={(_, d) => { setShowEndsPicker(Platform.OS === 'ios'); if (d) setEnds(d); }} />
      )}

      <Text style={s.label}>장소</Text>
      <Pressable style={s.input} onPress={() => nav.navigate('PlacePicker')}>
        <Text>{place ? place.name : '장소 선택'}</Text>
      </Pressable>

      <Text style={s.label}>위치 공유 시작 (분 전)</Text>
      <View style={s.chips}>
        {SHARE_OPTIONS.map((n) => (
          <Pressable key={n} style={[s.chip, share === n && s.chipOn]} onPress={() => setShare(n)}>
            <Text style={share === n ? s.chipOnText : s.chipText}>{n}분</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>내 알림 (분 전, 선택)</Text>
      <View style={s.chips}>
        <Pressable style={[s.chip, reminder === null && s.chipOn]} onPress={() => setReminder(null)}>
          <Text style={reminder === null ? s.chipOnText : s.chipText}>없음</Text>
        </Pressable>
        {REMINDER_OPTIONS.map((n) => (
          <Pressable key={n} style={[s.chip, reminder === n && s.chipOn]} onPress={() => setReminder(n)}>
            <Text style={reminder === n ? s.chipOnText : s.chipText}>{n}분</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>{initialGroupId ? '그룹 멤버' : '친구'}</Text>
      <View style={{ height: 200 }}>
        <MemberPicker
          mode={initialGroupId ? 'group' : 'friends'}
          groupId={initialGroupId ?? undefined}
          selectedIds={participants}
          onChange={setParticipants}
        />
      </View>

      <PrimaryButton label="만들기" onPress={submit} loading={busy} />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  label: { fontSize: 14, color: '#444', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginVertical: 4 },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { color: '#333' },
  chipOnText: { color: '#fff' },
});
```

- [ ] **Step 3: typecheck + Commit**

Run:
```powershell
npx tsc --noEmit
git add MeetPod/mobile/src/screens/meetups/MeetupCreateScreen.tsx MeetPod/mobile/package.json
git commit -m "feat(mobile): meetup create screen (datetime, place, share, reminder, members)"
```

---

## Task 6: MeetupListScreen + MeetupDetailScreen + Stack

**Files:**
- Create: `MeetPod/mobile/src/screens/meetups/MeetupListScreen.tsx`
- Create: `MeetPod/mobile/src/screens/meetups/MeetupDetailScreen.tsx`
- Create: `MeetPod/mobile/src/components/PlaceCard.tsx`
- Create: `MeetPod/mobile/src/navigation/MeetupsStack.tsx`
- Modify: `MeetPod/mobile/src/navigation/MainTabs.tsx`

- [ ] **Step 1: PlaceCard**

Create `MeetPod/mobile/src/components/PlaceCard.tsx`:
```tsx
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
```

Run:
```powershell
npx expo install react-native-maps
```

- [ ] **Step 2: MeetupListScreen**

Create `MeetPod/mobile/src/screens/meetups/MeetupListScreen.tsx`:
```tsx
import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useMeetupsStore } from '@/store/meetupsStore';
import { PrimaryButton } from '@/components/PrimaryButton';

export function MeetupListScreen() {
  const nav = useNavigation<any>();
  const { ids, byId, loading, refresh } = useMeetupsStore();
  useFocusEffect(useCallback(() => { refresh(false); }, [refresh]));

  return (
    <View style={s.root}>
      <FlatList
        data={ids.map((i) => byId[i])}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(false)} />}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => nav.navigate('MeetupDetail', { id: item.id })}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.sub}>{new Date(item.starts_at).toLocaleString()}</Text>
            <Text style={s.sub}>{item.place_name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.empty}>예정된 약속이 없어요</Text>}
      />
      <View style={s.footer}>
        <PrimaryButton label="새 약속" onPress={() => nav.navigate('MeetupCreate', {})} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 17, fontWeight: '600' },
  sub: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
  footer: { padding: 16 },
});
```

- [ ] **Step 3: MeetupDetailScreen**

Create `MeetPod/mobile/src/screens/meetups/MeetupDetailScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { cancelMeetup, getMeetup, listParticipants, type Meetup, type Participant } from '@/api/meetups';
import { PlaceCard } from '@/components/PlaceCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/authStore';

export function MeetupDetailScreen() {
  const { id } = (useRoute<any>()).params;
  const nav = useNavigation<any>();
  const me = useAuthStore((s) => s.profile?.id);
  const [m, setM] = useState<Meetup | null>(null);
  const [parts, setParts] = useState<Participant[]>([]);

  useFocusEffect(useCallback(() => {
    getMeetup(id).then(setM);
    listParticipants(id).then(setParts);
  }, [id]));

  if (!m) return <View style={s.root}><Text>로딩중...</Text></View>;
  const isCreator = m.creator_id === me;
  const editable = m.status === 'scheduled' && isCreator;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>{m.title}</Text>
      <Text style={s.meta}>상태: {m.status}</Text>
      <Text style={s.meta}>{new Date(m.starts_at).toLocaleString()} ~ {new Date(m.ends_at).toLocaleString()}</Text>
      <Text style={s.meta}>위치 공유: {m.location_share_minutes_before}분 전 시작</Text>

      <PlaceCard name={m.place_name} lat={m.place_lat} lng={m.place_lng} address={m.place_address ?? undefined} />

      <Text style={s.section}>참여자 ({parts.length})</Text>
      {parts.map((p) => <Text key={p.user_id} style={s.part}>{p.user_id}{p.user_id === m.creator_id ? ' · 주최' : ''}</Text>)}

      <View style={{ height: 16 }} />
      {m.status === 'active' || m.status === 'scheduled' ? (
        <PrimaryButton label="실시간 위치 보기" onPress={() => nav.navigate('MeetupMap', { id: m.id })} />
      ) : null}
      {editable ? (
        <PrimaryButton
          label="약속 취소"
          onPress={() => Alert.alert('취소', '정말 취소할까요?', [
            { text: '취소', style: 'cancel' },
            { text: '확인', style: 'destructive', onPress: async () => { const updated = await cancelMeetup(id); setM(updated); } },
          ])}
        />
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700' },
  meta: { color: '#555', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  part: { paddingVertical: 4 },
});
```

- [ ] **Step 4: MeetupsStack + MainTabs**

Create `MeetPod/mobile/src/navigation/MeetupsStack.tsx`:
```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MeetupListScreen } from '@/screens/meetups/MeetupListScreen';
import { MeetupCreateScreen } from '@/screens/meetups/MeetupCreateScreen';
import { MeetupDetailScreen } from '@/screens/meetups/MeetupDetailScreen';
import { PlacePickerScreen } from '@/screens/meetups/PlacePickerScreen';
// MeetupMapScreen은 Plan 9에서 추가

const S = createNativeStackNavigator();

export function MeetupsStack() {
  return (
    <S.Navigator>
      <S.Screen name="MeetupList" component={MeetupListScreen} options={{ title: '약속' }} />
      <S.Screen name="MeetupCreate" component={MeetupCreateScreen} options={{ title: '새 약속' }} />
      <S.Screen name="MeetupDetail" component={MeetupDetailScreen} options={{ title: '' }} />
      <S.Screen name="PlacePicker" component={PlacePickerScreen} options={{ title: '장소 선택' }} />
    </S.Navigator>
  );
}
```

Edit `MeetPod/mobile/src/navigation/MainTabs.tsx` — `MeetupsPlaceholder` 임포트 제거 후:
```tsx
import { MeetupsStack } from './MeetupsStack';
// ...
<Tab.Screen name="Meetups" component={MeetupsStack} options={{ headerShown: false }} />
```

- [ ] **Step 5: typecheck + 라이브 검증**

Run:
```powershell
npx tsc --noEmit
npm start
```
Expected:
1. Meetups 탭 → "새 약속" → 제목/시간/장소(검색)/공유창/알림/멤버 입력
2. Place Picker에서 "강남" 검색 → 결과 → 선택 → MeetupCreate로 복귀, place 채워짐
3. 만들기 → MeetupDetail로 이동, 참여자/지도 카드 표시
4. 백엔드에 `POST /api/meetups`, `GET /api/meetups/{id}`, `GET .../participants` 200

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/mobile/src/screens/meetups MeetPod/mobile/src/components/PlaceCard.tsx MeetPod/mobile/src/navigation/MeetupsStack.tsx MeetPod/mobile/src/navigation/MainTabs.tsx MeetPod/mobile/package.json
git commit -m "feat(mobile): meetup list/detail screens + place card + stack wiring"
```

---

## Self-Review Notes

§6.3 약속 생성 — 그룹/1회성, 멤버 default-checked, place picker, share 창 10/20/30/60, 본인 reminder ✓
약속 상세에서 cancel(creator만) ✓
MeetupMap 진입 단추는 노출, 화면 자체는 Plan 9 ✓

**제외:** 약속 수정 화면 — MVP 범위. 필요 시 후속.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
