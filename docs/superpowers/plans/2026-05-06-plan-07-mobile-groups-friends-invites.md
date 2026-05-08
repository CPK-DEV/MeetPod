# Plan 7 — Mobile: 그룹 / 친구 / 초대 딥링크

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 그룹 목록/생성/상세/멤버 관리 화면, 친구 목록 화면, 초대 코드 생성/공유 화면, `meetpod://invite/{code}` 딥링크 수신 후 InviteAcceptScreen을 구현한다.

**Architecture:**
- API 모듈: `api/groups.ts`, `api/friendships.ts`, `api/invites.ts`. Plan 3 라우터 그대로 호출.
- 상태: 단순 화면 로컬 state + `useFocusEffect`로 리프레시 (Zustand 캐시는 chat/meetups에서만 도입).
- 딥링크: `expo-linking` config. `meetpod://invite/abcd1234` 또는 `https://<frontend-fallback>/invite/abcd1234` (FRONTEND_URL Universal Link)을 InviteAccept으로 라우팅. 미인증 사용자는 로그인 후 자동 처리되도록 `pendingInviteCode`를 zustand에 보관.
- 초대 공유: `expo-sharing` 미사용, `Share` API + 클립보드.

**Tech Stack:** Expo SDK 51, React Navigation 6, axios, Zustand, expo-linking, expo-clipboard, react-native `Share`, `react-native-qrcode-svg`(코드 표시용).

**전제:** Plan 6 완료 (네비게이션, authStore, apiClient). Plan 3 백엔드 라이브.

---

## File Structure

```
MeetPod/mobile/src/
├── api/
│   ├── groups.ts
│   ├── friendships.ts
│   └── invites.ts
├── store/
│   └── inviteStore.ts                   # pendingInviteCode
├── lib/
│   └── deep_link.ts                     # linking config + invite parser
├── navigation/
│   ├── MainTabs.tsx                     # Modify: GroupsTab → GroupsStack
│   ├── GroupsStack.tsx
│   └── FriendsStack.tsx (Me 탭에서 분기 진입)
└── screens/
    ├── groups/
    │   ├── GroupListScreen.tsx
    │   ├── GroupDetailScreen.tsx
    │   ├── GroupCreateScreen.tsx
    │   ├── GroupMembersScreen.tsx
    │   └── GroupInviteScreen.tsx
    ├── friends/
    │   ├── FriendListScreen.tsx
    │   └── FriendInviteScreen.tsx
    └── invites/
        └── InviteAcceptScreen.tsx
```

---

## Task 1: API 모듈 (groups/friendships/invites)

**Files:**
- Create: `MeetPod/mobile/src/api/groups.ts`
- Create: `MeetPod/mobile/src/api/friendships.ts`
- Create: `MeetPod/mobile/src/api/invites.ts`

- [ ] **Step 1: groups.ts**

Create `MeetPod/mobile/src/api/groups.ts`:
```ts
import { apiClient } from './client';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  created_at: string;
}
export interface GroupMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

export const listGroups = () => apiClient.get<Group[]>('/groups').then(r => r.data);
export const getGroup = (id: string) => apiClient.get<Group>(`/groups/${id}`).then(r => r.data);
export const createGroup = (name: string, description?: string) =>
  apiClient.post<Group>('/groups', { name, description: description ?? null }).then(r => r.data);
export const updateGroup = (id: string, patch: Partial<Pick<Group,'name'|'description'|'avatar_url'>>) =>
  apiClient.patch<Group>(`/groups/${id}`, patch).then(r => r.data);
export const listMembers = (id: string) =>
  apiClient.get<GroupMember[]>(`/groups/${id}/members`).then(r => r.data);
export const setMemberRole = (gid: string, uid: string, role: 'admin'|'member') =>
  apiClient.patch(`/groups/${gid}/members/${uid}/role`, { role });
export const kickMember = (gid: string, uid: string) =>
  apiClient.delete(`/groups/${gid}/members/${uid}`);
export const transferOwner = (gid: string, newOwnerId: string) =>
  apiClient.post(`/groups/${gid}/transfer`, { new_owner_id: newOwnerId });
```

- [ ] **Step 2: friendships.ts**

Create `MeetPod/mobile/src/api/friendships.ts`:
```ts
import { apiClient } from './client';

export interface FriendSummary {
  id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
}

export const listFriends = () =>
  apiClient.get<FriendSummary[]>('/friendships').then(r => r.data);
```

- [ ] **Step 3: invites.ts**

Create `MeetPod/mobile/src/api/invites.ts`:
```ts
import { apiClient } from './client';

export interface Invite {
  code: string;
  inviter_id: string;
  kind: 'friend' | 'group';
  target_group_id: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
}
export interface AcceptResult {
  kind: 'friend' | 'group';
  inviter_id: string;
  group_id: string | null;
}

export const createInvite = (kind: 'friend' | 'group', target_group_id?: string) =>
  apiClient.post<Invite>('/invites', { kind, target_group_id: target_group_id ?? null }).then(r => r.data);

export const acceptInvite = (code: string) =>
  apiClient.post<AcceptResult>(`/invites/${code}/accept`).then(r => r.data);
```

- [ ] **Step 4: typecheck + Commit**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx tsc --noEmit
git add MeetPod/mobile/src/api/groups.ts MeetPod/mobile/src/api/friendships.ts MeetPod/mobile/src/api/invites.ts
git commit -m "feat(mobile): api modules for groups/friendships/invites"
```

---

## Task 2: 딥링크 설정 + inviteStore

**Files:**
- Create: `MeetPod/mobile/src/lib/deep_link.ts`
- Create: `MeetPod/mobile/src/store/inviteStore.ts`

- [ ] **Step 1: deep_link.ts**

Create `MeetPod/mobile/src/lib/deep_link.ts`:
```ts
import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: [Linking.createURL('/'), 'meetpod://'],
  config: {
    screens: {
      InviteAccept: 'invite/:code',
      // 후속 plan에서 추가:
      // MeetupDetail: 'meetup/:id',
    },
  },
};

export function parseInviteCode(url: string): string | null {
  const m = url.match(/invite\/([A-Za-z0-9_-]{6,16})/);
  return m ? m[1] : null;
}
```

- [ ] **Step 2: inviteStore.ts**

Create `MeetPod/mobile/src/store/inviteStore.ts`:
```ts
import { create } from 'zustand';

interface InviteState {
  pendingCode: string | null;
  setPending: (c: string | null) => void;
  consume: () => string | null;
}

export const useInviteStore = create<InviteState>((set, get) => ({
  pendingCode: null,
  setPending: (c) => set({ pendingCode: c }),
  consume: () => {
    const c = get().pendingCode;
    set({ pendingCode: null });
    return c;
  },
}));
```

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/mobile/src/lib/deep_link.ts MeetPod/mobile/src/store/inviteStore.ts
git commit -m "feat(mobile): deep link config + pending invite store"
```

---

## Task 3: GroupsStack + 화면 5개

**Files:**
- Create: `MeetPod/mobile/src/navigation/GroupsStack.tsx`
- Create: `MeetPod/mobile/src/screens/groups/*.tsx` (5개)
- Modify: `MeetPod/mobile/src/navigation/MainTabs.tsx`

- [ ] **Step 1: GroupListScreen**

Create `MeetPod/mobile/src/screens/groups/GroupListScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { listGroups, type Group } from '@/api/groups';
import { PrimaryButton } from '@/components/PrimaryButton';

export function GroupListScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await listGroups()); } finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.root}>
      <FlatList
        data={items}
        keyExtractor={(g) => g.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => nav.navigate('GroupDetail', { id: item.id })}>
            <Text style={s.name}>{item.name}</Text>
            {item.description ? <Text style={s.sub}>{item.description}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.empty}>아직 그룹이 없어요</Text>}
      />
      <View style={s.footer}>
        <PrimaryButton label="그룹 만들기" onPress={() => nav.navigate('GroupCreate')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontSize: 18, fontWeight: '600' },
  sub: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
  footer: { padding: 16 },
});
```

- [ ] **Step 2: GroupCreateScreen**

Create `MeetPod/mobile/src/screens/groups/GroupCreateScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createGroup } from '@/api/groups';
import { PrimaryButton } from '@/components/PrimaryButton';

export function GroupCreateScreen() {
  const nav = useNavigation<any>();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) { Alert.alert('이름을 입력하세요'); return; }
    setBusy(true);
    try {
      const g = await createGroup(name.trim(), desc.trim() || undefined);
      nav.replace('GroupDetail', { id: g.id });
    } catch (e: any) {
      Alert.alert('생성 실패', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <TextInput style={s.input} placeholder="그룹 이름" value={name} onChangeText={setName} maxLength={80} />
      <TextInput style={[s.input, { height: 100 }]} placeholder="설명 (선택)" value={desc} onChangeText={setDesc} multiline />
      <PrimaryButton label="만들기" onPress={submit} loading={busy} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex:1, padding: 16, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
});
```

- [ ] **Step 3: GroupDetailScreen**

Create `MeetPod/mobile/src/screens/groups/GroupDetailScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { getGroup, type Group } from '@/api/groups';
import { PrimaryButton } from '@/components/PrimaryButton';

export function GroupDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params;
  const [g, setG] = useState<Group | null>(null);

  useFocusEffect(useCallback(() => { getGroup(id).then(setG); }, [id]));

  if (!g) return <View style={s.root}><Text>로딩중...</Text></View>;
  return (
    <View style={s.root}>
      <Text style={s.name}>{g.name}</Text>
      {g.description ? <Text style={s.sub}>{g.description}</Text> : null}
      <View style={{ height: 24 }} />
      <Pressable style={s.row} onPress={() => nav.navigate('GroupMembers', { id: g.id })}>
        <Text style={s.rowLabel}>멤버</Text>
      </Pressable>
      <Pressable style={s.row} onPress={() => nav.navigate('GroupInvite', { id: g.id })}>
        <Text style={s.rowLabel}>초대 링크 만들기</Text>
      </Pressable>
      <View style={{ height: 24 }} />
      <PrimaryButton label="이 그룹으로 약속 만들기" onPress={() => nav.navigate('Meetups', { screen: 'MeetupCreate', params: { group_id: g.id } })} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#fff' },
  name: { fontSize: 24, fontWeight: '700' },
  sub: { color: '#666', marginTop: 8 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: '#eee' },
  rowLabel: { fontSize: 16 },
});
```

- [ ] **Step 4: GroupMembersScreen**

Create `MeetPod/mobile/src/screens/groups/GroupMembersScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { listMembers, kickMember, setMemberRole, type GroupMember } from '@/api/groups';
import { useAuthStore } from '@/store/authStore';

export function GroupMembersScreen() {
  const { id } = (useRoute<any>()).params;
  const [items, setItems] = useState<GroupMember[]>([]);
  const me = useAuthStore((s) => s.profile?.id);

  const load = useCallback(() => { listMembers(id).then(setItems); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myRole = items.find((m) => m.user_id === me)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  function actions(m: GroupMember) {
    if (!canManage || m.user_id === me) return;
    Alert.alert('멤버 관리', m.user_id, [
      m.role === 'admin'
        ? { text: '일반 멤버로', onPress: async () => { await setMemberRole(id, m.user_id, 'member'); load(); } }
        : { text: '관리자 지정', onPress: async () => { await setMemberRole(id, m.user_id, 'admin'); load(); } },
      { text: '추방', style: 'destructive', onPress: async () => { await kickMember(id, m.user_id); load(); } },
      { text: '취소', style: 'cancel' },
    ]);
  }

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={items}
      keyExtractor={(m) => m.user_id}
      renderItem={({ item }) => (
        <Pressable style={s.row} onPress={() => actions(item)}>
          <Text style={s.uid}>{item.user_id}</Text>
          <Text style={s.role}>{item.role}</Text>
        </Pressable>
      )}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 14, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  uid: { fontSize: 14, color: '#222' },
  role: { fontSize: 14, color: '#666' },
});
```

- [ ] **Step 5: GroupInviteScreen + QR**

Run:
```powershell
npm install react-native-qrcode-svg react-native-svg
npx expo install react-native-svg
```

Create `MeetPod/mobile/src/screens/groups/GroupInviteScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useRoute } from '@react-navigation/native';
import { createInvite, type Invite } from '@/api/invites';
import { PrimaryButton } from '@/components/PrimaryButton';

function inviteUrl(code: string) { return `meetpod://invite/${code}`; }

export function GroupInviteScreen() {
  const { id } = (useRoute<any>()).params;
  const [inv, setInv] = useState<Invite | null>(null);

  useEffect(() => { createInvite('group', id).then(setInv).catch((e) => Alert.alert('실패', e.message)); }, [id]);

  if (!inv) return <View style={s.root}><Text>발급 중...</Text></View>;
  const url = inviteUrl(inv.code);

  return (
    <View style={s.root}>
      <Text style={s.code}>{inv.code}</Text>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <QRCode value={url} size={200} />
      </View>
      <Text style={s.sub}>만료: {new Date(inv.expires_at).toLocaleString()}</Text>
      <Text style={s.sub}>잔여: {inv.max_uses - inv.used_count}회</Text>
      <View style={{ height: 24 }} />
      <PrimaryButton label="링크 복사" onPress={async () => { await Clipboard.setStringAsync(url); Alert.alert('복사됨'); }} />
      <PrimaryButton label="공유" onPress={() => Share.share({ message: `MeetPod 그룹 초대: ${url}` })} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff' },
  code: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: 4 },
  sub: { color: '#666', textAlign: 'center' },
});
```

- [ ] **Step 6: GroupsStack**

Create `MeetPod/mobile/src/navigation/GroupsStack.tsx`:
```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GroupListScreen } from '@/screens/groups/GroupListScreen';
import { GroupCreateScreen } from '@/screens/groups/GroupCreateScreen';
import { GroupDetailScreen } from '@/screens/groups/GroupDetailScreen';
import { GroupMembersScreen } from '@/screens/groups/GroupMembersScreen';
import { GroupInviteScreen } from '@/screens/groups/GroupInviteScreen';

const S = createNativeStackNavigator();

export function GroupsStack() {
  return (
    <S.Navigator>
      <S.Screen name="GroupList" component={GroupListScreen} options={{ title: '그룹' }} />
      <S.Screen name="GroupCreate" component={GroupCreateScreen} options={{ title: '그룹 만들기' }} />
      <S.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: '' }} />
      <S.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: '멤버' }} />
      <S.Screen name="GroupInvite" component={GroupInviteScreen} options={{ title: '초대' }} />
    </S.Navigator>
  );
}
```

- [ ] **Step 7: MainTabs에 GroupsStack 연결**

Edit `MeetPod/mobile/src/navigation/MainTabs.tsx` — `GroupsPlaceholder` 임포트를 제거하고 다음으로 교체:
```tsx
import { GroupsStack } from './GroupsStack';
// ...
<Tab.Screen name="Groups" component={GroupsStack} options={{ headerShown: false }} />
```

- [ ] **Step 8: Commit**

```powershell
git add MeetPod/mobile/src/screens/groups MeetPod/mobile/src/navigation/GroupsStack.tsx MeetPod/mobile/src/navigation/MainTabs.tsx MeetPod/mobile/package.json MeetPod/mobile/package-lock.json
git commit -m "feat(mobile): groups stack (list/create/detail/members/invite)"
```

---

## Task 4: 친구 화면 (Me 탭에 진입)

**Files:**
- Create: `MeetPod/mobile/src/screens/friends/FriendListScreen.tsx`
- Create: `MeetPod/mobile/src/screens/friends/FriendInviteScreen.tsx`
- Modify: `MeetPod/mobile/src/screens/placeholders/MePlaceholder.tsx` → 실제 MeScreen으로 대체
- Create: `MeetPod/mobile/src/navigation/MeStack.tsx`

- [ ] **Step 1: MeScreen (placeholder 대체)**

Replace `MeetPod/mobile/src/screens/placeholders/MePlaceholder.tsx` 내용 → 별도 파일 작성. 새로 만들기:

Create `MeetPod/mobile/src/screens/me/MeScreen.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { PrimaryButton } from '@/components/PrimaryButton';

export function MeScreen() {
  const nav = useNavigation<any>();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={s.root}>
      <Text style={s.name}>{profile?.display_name}</Text>
      <Text style={s.handle}>@{profile?.handle}</Text>
      <View style={{ height: 24 }} />
      <Pressable style={s.row} onPress={() => nav.navigate('FriendList')}>
        <Text style={s.rowLabel}>친구 목록</Text>
      </Pressable>
      <Pressable style={s.row} onPress={() => nav.navigate('FriendInvite')}>
        <Text style={s.rowLabel}>친구 초대</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="로그아웃" onPress={signOut} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#fff' },
  name: { fontSize: 24, fontWeight: '700' },
  handle: { fontSize: 16, color: '#666', marginTop: 4 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#eee' },
  rowLabel: { fontSize: 16 },
});
```

- [ ] **Step 2: FriendListScreen**

Create `MeetPod/mobile/src/screens/friends/FriendListScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listFriends, type FriendSummary } from '@/api/friendships';

export function FriendListScreen() {
  const [items, setItems] = useState<FriendSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setRefreshing(true); try { setItems(await listFriends()); } finally { setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={items}
      keyExtractor={(f) => f.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      renderItem={({ item }) => (
        <View style={s.row}>
          <Text style={s.name}>{item.display_name}</Text>
          {item.handle ? <Text style={s.handle}>@{item.handle}</Text> : null}
        </View>
      )}
      ListEmptyComponent={<Text style={s.empty}>아직 친구가 없어요</Text>}
    />
  );
}
const s = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  handle: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 64, color: '#999' },
});
```

- [ ] **Step 3: FriendInviteScreen**

Create `MeetPod/mobile/src/screens/friends/FriendInviteScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { createInvite, type Invite } from '@/api/invites';
import { PrimaryButton } from '@/components/PrimaryButton';

export function FriendInviteScreen() {
  const [inv, setInv] = useState<Invite | null>(null);
  useEffect(() => { createInvite('friend').then(setInv).catch((e) => Alert.alert('실패', e.message)); }, []);
  if (!inv) return <View style={s.root}><Text>발급 중...</Text></View>;
  const url = `meetpod://invite/${inv.code}`;

  return (
    <View style={s.root}>
      <Text style={s.code}>{inv.code}</Text>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <QRCode value={url} size={200} />
      </View>
      <Text style={s.sub}>만료: {new Date(inv.expires_at).toLocaleString()}</Text>
      <PrimaryButton label="링크 복사" onPress={async () => { await Clipboard.setStringAsync(url); Alert.alert('복사됨'); }} />
      <PrimaryButton label="공유" onPress={() => Share.share({ message: `MeetPod 친구 초대: ${url}` })} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff' },
  code: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: 4 },
  sub: { color: '#666', textAlign: 'center' },
});
```

- [ ] **Step 4: MeStack + MainTabs 연결**

Create `MeetPod/mobile/src/navigation/MeStack.tsx`:
```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MeScreen } from '@/screens/me/MeScreen';
import { FriendListScreen } from '@/screens/friends/FriendListScreen';
import { FriendInviteScreen } from '@/screens/friends/FriendInviteScreen';

const S = createNativeStackNavigator();

export function MeStack() {
  return (
    <S.Navigator>
      <S.Screen name="Me" component={MeScreen} options={{ title: '내 정보' }} />
      <S.Screen name="FriendList" component={FriendListScreen} options={{ title: '친구' }} />
      <S.Screen name="FriendInvite" component={FriendInviteScreen} options={{ title: '친구 초대' }} />
    </S.Navigator>
  );
}
```

Edit `MeetPod/mobile/src/navigation/MainTabs.tsx` — `MePlaceholder` 임포트 제거 후:
```tsx
import { MeStack } from './MeStack';
// ...
<Tab.Screen name="Me" component={MeStack} options={{ headerShown: false }} />
```

`MePlaceholder.tsx` 삭제는 안전을 위해 유지(미사용). 또는 직접 제거.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/mobile/src/screens/me MeetPod/mobile/src/screens/friends MeetPod/mobile/src/navigation/MeStack.tsx MeetPod/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): me + friends screens, friend invite"
```

---

## Task 5: InviteAcceptScreen + 딥링크 연결

**Files:**
- Create: `MeetPod/mobile/src/screens/invites/InviteAcceptScreen.tsx`
- Modify: `MeetPod/mobile/src/navigation/RootNavigator.tsx`
- Modify: `MeetPod/mobile/src/navigation/MainTabs.tsx` (또는 별도 modal stack)

- [ ] **Step 1: InviteAcceptScreen**

Create `MeetPod/mobile/src/screens/invites/InviteAcceptScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { acceptInvite, type AcceptResult } from '@/api/invites';
import { PrimaryButton } from '@/components/PrimaryButton';

export function InviteAcceptScreen() {
  const nav = useNavigation<any>();
  const code = (useRoute<any>()).params.code as string;
  const [state, setState] = useState<{ status: 'pending'|'done'|'error', result?: AcceptResult, error?: string }>({ status: 'pending' });

  useEffect(() => {
    acceptInvite(code)
      .then((r) => setState({ status: 'done', result: r }))
      .catch((e) => setState({ status: 'error', error: e.response?.data?.detail ?? e.message }));
  }, [code]);

  if (state.status === 'pending') {
    return <View style={s.root}><ActivityIndicator size="large" /><Text style={s.label}>초대 처리 중...</Text></View>;
  }
  if (state.status === 'error') {
    return (
      <View style={s.root}>
        <Text style={s.title}>초대를 사용할 수 없어요</Text>
        <Text style={s.sub}>{state.error}</Text>
        <PrimaryButton label="홈으로" onPress={() => nav.replace('MainTabs')} />
      </View>
    );
  }
  const r = state.result!;
  return (
    <View style={s.root}>
      <Text style={s.title}>{r.kind === 'friend' ? '친구가 추가됐어요' : '그룹에 참여했어요'}</Text>
      <PrimaryButton
        label={r.kind === 'group' ? '그룹 보기' : '확인'}
        onPress={() => {
          if (r.kind === 'group' && r.group_id) {
            nav.replace('MainTabs', { screen: 'Groups', params: { screen: 'GroupDetail', params: { id: r.group_id } } });
          } else {
            nav.replace('MainTabs');
          }
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  sub: { color: '#666', textAlign: 'center', marginBottom: 24 },
  label: { marginTop: 12, color: '#666' },
});
```

- [ ] **Step 2: RootNavigator를 NavigationContainer level에서 InviteAccept 처리**

Edit `MeetPod/mobile/src/navigation/RootNavigator.tsx` — 전체 교체:
```tsx
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { useAuthStore } from '@/store/authStore';
import { useInviteStore } from '@/store/inviteStore';
import { supabase } from '@/lib/supabase';
import { linking, parseInviteCode } from '@/lib/deep_link';
import * as Linking from 'expo-linking';
import { InviteAcceptScreen } from '@/screens/invites/InviteAcceptScreen';

const Root = createNativeStackNavigator();

function MainOrInviteStack() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Screen name="MainTabs" component={MainTabs} />
      <Root.Screen name="InviteAccept" component={InviteAcceptScreen} options={{ presentation: 'modal', headerShown: true, title: '초대' }} />
    </Root.Navigator>
  );
}

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.initFromStored);
  const hydrate = useAuthStore((s) => s.hydrateAfterAuth);
  const setPending = useInviteStore((s) => s.setPending);

  useEffect(() => {
    init();
    const sub = supabase.auth.onAuthStateChange((_e, sess) => { if (sess) hydrate(sess); });
    Linking.getInitialURL().then((u) => { if (u) { const c = parseInviteCode(u); if (c) setPending(c); } });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      const c = parseInviteCode(url);
      if (c) setPending(c);
    });
    return () => { sub.data.subscription.unsubscribe(); linkSub.remove(); };
  }, []);

  if (status === 'unknown') return <View style={{ flex:1, justifyContent:'center' }}><ActivityIndicator /></View>;
  return (
    <NavigationContainer linking={linking}>
      {status === 'ready' ? <MainOrInviteStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: ready 진입 시 pendingCode 자동 처리**

Edit `MeetPod/mobile/src/navigation/MainTabs.tsx` — 컴포넌트 함수 본문 시작 부분에 navigation hook으로 처리:
```tsx
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useInviteStore } from '@/store/inviteStore';
// ... Tab 정의 위
export function MainTabs() {
  const nav = useNavigation<any>();
  const consume = useInviteStore((s) => s.consume);
  useEffect(() => {
    const code = consume();
    if (code) nav.navigate('InviteAccept', { code });
  }, []);
  return (
    <Tab.Navigator>
      {/* 기존 Tab.Screen들 그대로 */}
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: 라이브 검증**

`expo start` → 디바이스/시뮬레이터에서:
1. 다른 사용자 계정에서 그룹 초대 코드 발급 후 url(`meetpod://invite/<code>`) 받기
2. iOS: Safari에서 `meetpod://invite/<code>` 클릭, 또는 macOS에서 `xcrun simctl openurl booted meetpod://invite/<code>`
3. Android: `adb shell am start -a android.intent.action.VIEW -d "meetpod://invite/<code>"`

Expected: 인증된 상태면 InviteAccept 모달 → "그룹 보기" → 해당 GroupDetail 진입.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/mobile/src/screens/invites MeetPod/mobile/src/navigation/RootNavigator.tsx MeetPod/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): invite accept screen + deep link wiring"
```

---

## Self-Review Notes

§6.2 친구 추가 흐름 모두 구현 (코드 발급 + QR + 공유 + 딥링크 수락) ✓
그룹 멤버 관리(역할/추방/초대) ✓
미인증 상태에서 딥링크 수신 시 pendingCode 보관 → 로그인 완료 후 자동 처리 ✓

**제외:** 핸들 기반 친구 검색(스펙 §2 명시 제외), 친구 끊기.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
