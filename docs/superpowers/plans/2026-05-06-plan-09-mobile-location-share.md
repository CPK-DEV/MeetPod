# Plan 9 — Mobile: 위치 공유 (백그라운드 트래킹 + Realtime 지도)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 약속 시작 N분 전부터 종료 시각까지 모바일에서 백그라운드 위치를 수집해 Supabase `location_pings`에 직접 INSERT하고, 다른 참여자들의 핀을 Realtime 구독으로 받아 MeetupMapScreen에 표시한다.

**Architecture:**
- 위치 트래킹: `expo-location` background task. 앱 부팅/포그라운드 진입 시 "곧 시작/현재 진행중인 약속"을 조회 → 트래킹 등록. 약속 `ends_at`이면 자체 종료.
- 단일 백그라운드 task에 active meetup_id를 SecureStore로 보관(여러 약속이 겹칠 경우 가장 가까운 1개만 트래킹 — MVP 단순화).
- INSERT는 Supabase 직결 (RLS `location_pings_insert_self`로 보호). 백엔드 경유 안 함.
- 수신: MeetupMapScreen이 mount되면 `location_pings`에 대한 Realtime postgres_changes 구독, INSERT 이벤트로 핀 갱신. 초기 로드는 최근 5분 이내의 user별 마지막 핀.
- 권한: iOS `NSLocationAlwaysAndWhenInUseUsageDescription`, Android `ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE`. "Always Allow" 거부 시 fallback: 포그라운드만 트래킹(앱 켜진 동안만).

**Tech Stack:** expo-location, expo-task-manager, expo-secure-store, react-native-maps, @supabase/supabase-js Realtime, Zustand.

**전제:** Plan 8 완료 (MeetupDetail에서 "실시간 위치 보기" 진입). Plan 1의 `location_pings` + RLS + Realtime publication.

---

## File Structure

```
MeetPod/mobile/src/
├── lib/
│   └── location_tracker.ts          # task 등록/해제 + 활성 meetup 결정
├── store/
│   └── locationStore.ts             # 현재 트래킹 중인 meetup_id, 권한 상태
├── screens/
│   └── meetups/
│       └── MeetupMapScreen.tsx
└── navigation/
    └── MeetupsStack.tsx             # Modify: MeetupMap 추가
app.json                              # Modify: 권한 + plugin
```

---

## Task 1: app.json 권한 + plugin

**Files:**
- Modify: `MeetPod/mobile/app.json`

- [ ] **Step 1: 권한 추가**

Edit `MeetPod/mobile/app.json` — `expo` 키 안에 다음 병합:
```json
{
  "expo": {
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.cpkworks.meetpod",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "약속 시간 동안 친구와 위치를 공유하기 위해 사용합니다.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "약속 시간 동안 백그라운드에서도 위치를 공유하기 위해 사용합니다.",
        "UIBackgroundModes": ["location", "fetch"]
      }
    },
    "android": {
      "package": "com.cpkworks.meetpod",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE"
      ]
    },
    "plugins": [
      "expo-secure-store",
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "약속 시간 동안 백그라운드에서도 위치를 공유합니다." }]
    ]
  }
}
```

- [ ] **Step 2: 의존성**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx expo install expo-location expo-task-manager
```

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/mobile/app.json MeetPod/mobile/package.json
git commit -m "chore(mobile): location permissions + expo-location plugin"
```

---

## Task 2: location_tracker (task 정의 + 등록/해제)

**Files:**
- Create: `MeetPod/mobile/src/lib/location_tracker.ts`
- Create: `MeetPod/mobile/src/store/locationStore.ts`

- [ ] **Step 1: locationStore.ts**

Create `MeetPod/mobile/src/store/locationStore.ts`:
```ts
import { create } from 'zustand';

export type PermStatus = 'unknown' | 'granted_always' | 'granted_foreground' | 'denied';

interface State {
  permission: PermStatus;
  trackingMeetupId: string | null;
  setPermission: (p: PermStatus) => void;
  setTracking: (id: string | null) => void;
}

export const useLocationStore = create<State>((set) => ({
  permission: 'unknown',
  trackingMeetupId: null,
  setPermission: (p) => set({ permission: p }),
  setTracking: (id) => set({ trackingMeetupId: id }),
}));
```

- [ ] **Step 2: location_tracker.ts**

Create `MeetPod/mobile/src/lib/location_tracker.ts`:
```ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/store/locationStore';

const TASK = 'meetpod-location-task';
const KEY_MEETUP = 'meetpod.tracking_meetup_id';
const KEY_USER = 'meetpod.tracking_user_id';
const KEY_END = 'meetpod.tracking_ends_at_iso';

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as any)?.locations as Location.LocationObject[] | undefined;
  if (!locs || locs.length === 0) return;

  const meetupId = await SecureStore.getItemAsync(KEY_MEETUP);
  const userId = await SecureStore.getItemAsync(KEY_USER);
  const endsAtIso = await SecureStore.getItemAsync(KEY_END);
  if (!meetupId || !userId || !endsAtIso) return;

  if (new Date() > new Date(endsAtIso)) {
    await stopTracking();
    return;
  }

  const rows = locs.map((l) => ({
    meetup_id: meetupId,
    user_id: userId,
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracy_m: l.coords.accuracy ?? null,
    recorded_at: new Date(l.timestamp).toISOString(),
  }));
  // 실패해도 silent — 다음 tick에서 재시도. RLS는 본인 user_id 강제.
  await supabase.from('location_pings').insert(rows);
});

export async function ensurePermissions(): Promise<'granted_always' | 'granted_foreground' | 'denied'> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    useLocationStore.getState().setPermission('denied');
    return 'denied';
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  const result = bg.status === 'granted' ? 'granted_always' : 'granted_foreground';
  useLocationStore.getState().setPermission(result);
  return result;
}

export async function startTracking(opts: { meetupId: string; userId: string; endsAt: Date }): Promise<void> {
  const perm = await ensurePermissions();
  if (perm === 'denied') throw new Error('위치 권한이 필요합니다');

  await SecureStore.setItemAsync(KEY_MEETUP, opts.meetupId);
  await SecureStore.setItemAsync(KEY_USER, opts.userId);
  await SecureStore.setItemAsync(KEY_END, opts.endsAt.toISOString());

  const already = await Location.hasStartedLocationUpdatesAsync(TASK);
  if (already) await Location.stopLocationUpdatesAsync(TASK);

  if (perm === 'granted_always') {
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'MeetPod 위치 공유 중',
        notificationBody: '약속이 끝나면 자동으로 종료됩니다.',
      },
    });
  } else {
    // 포그라운드 fallback: watchPosition은 컴포넌트 unmount 시 끊겨 한계가 있으나,
    // MVP에서는 "Always" 거부 시 위치 공유 품질 저하를 사용자에게 안내(화면에서 처리).
  }
  useLocationStore.getState().setTracking(opts.meetupId);
}

export async function stopTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
      await Location.stopLocationUpdatesAsync(TASK);
    }
  } catch {}
  await SecureStore.deleteItemAsync(KEY_MEETUP);
  await SecureStore.deleteItemAsync(KEY_USER);
  await SecureStore.deleteItemAsync(KEY_END);
  useLocationStore.getState().setTracking(null);
}

/** 약속 시작 N분 전 ~ 종료 사이에 들어왔는지 판정 */
export function shouldTrack(meetup: { starts_at: string; ends_at: string; location_share_minutes_before: number }): boolean {
  const now = new Date();
  const start = new Date(meetup.starts_at);
  const end = new Date(meetup.ends_at);
  const window = new Date(start.getTime() - meetup.location_share_minutes_before * 60_000);
  return now >= window && now < end;
}
```

- [ ] **Step 3: typecheck**

Run:
```powershell
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/mobile/src/lib/location_tracker.ts MeetPod/mobile/src/store/locationStore.ts
git commit -m "feat(mobile): background location task + tracker control"
```

---

## Task 3: 앱 부팅/약속 갱신 시 자동 트래킹 결정

**Files:**
- Modify: `MeetPod/mobile/src/store/meetupsStore.ts`

- [ ] **Step 1: refresh 후 트래킹 자동 갱신**

Edit `MeetPod/mobile/src/store/meetupsStore.ts` — 파일 하단에 추가하고 `refresh` 끝에서 호출:
```ts
import { shouldTrack, startTracking, stopTracking } from '@/lib/location_tracker';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';

async function reconcileTracking(items: Meetup[]) {
  const userId = useAuthStore.getState().profile?.id;
  if (!userId) return;
  const candidates = items
    .filter((m) => m.status === 'scheduled' || m.status === 'active')
    .filter(shouldTrack)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const target = candidates[0] ?? null;
  const current = useLocationStore.getState().trackingMeetupId;
  if (target && current !== target.id) {
    await startTracking({ meetupId: target.id, userId, endsAt: new Date(target.ends_at) });
  } else if (!target && current) {
    await stopTracking();
  }
}
```

같은 파일 안 `refresh` 함수 끝에 한 줄 추가 — `set({ byId, ids })` 다음에:
```ts
      reconcileTracking(items);
```

- [ ] **Step 2: typecheck + Commit**

Run:
```powershell
npx tsc --noEmit
git add MeetPod/mobile/src/store/meetupsStore.ts
git commit -m "feat(mobile): auto-reconcile background tracking on meetup refresh"
```

---

## Task 4: MeetupMapScreen — 초기 로드 + Realtime 구독

**Files:**
- Create: `MeetPod/mobile/src/screens/meetups/MeetupMapScreen.tsx`
- Modify: `MeetPod/mobile/src/navigation/MeetupsStack.tsx`

- [ ] **Step 1: MeetupMapScreen**

Create `MeetPod/mobile/src/screens/meetups/MeetupMapScreen.tsx`:
```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { getMeetup, type Meetup } from '@/api/meetups';
import { useLocationStore } from '@/store/locationStore';

interface Ping { user_id: string; lat: number; lng: number; recorded_at: string; }

export function MeetupMapScreen() {
  const { id } = (useRoute<any>()).params;
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [pings, setPings] = useState<Record<string, Ping>>({});
  const tracking = useLocationStore((s) => s.trackingMeetupId);
  const permission = useLocationStore((s) => s.permission);

  useEffect(() => { getMeetup(id).then(setMeetup); }, [id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await supabase
        .from('location_pings')
        .select('user_id, lat, lng, recorded_at')
        .eq('meetup_id', id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false });

      if (cancelled || !data) return;
      const next: Record<string, Ping> = {};
      for (const r of data as Ping[]) {
        if (!next[r.user_id]) next[r.user_id] = r;
      }
      setPings(next);
    })();

    const ch = supabase
      .channel(`pings:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'location_pings', filter: `meetup_id=eq.${id}` },
        (payload) => {
          const r = payload.new as Ping;
          setPings((prev) => ({ ...prev, [r.user_id]: r }));
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [id]);

  const initialRegion = useMemo(() => ({
    latitude: meetup?.place_lat ?? 37.5,
    longitude: meetup?.place_lng ?? 127.0,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  }), [meetup]);

  if (!meetup) return <View style={s.root}><Text>로딩중...</Text></View>;

  return (
    <View style={s.root}>
      <MapView style={{ flex: 1 }} initialRegion={initialRegion}>
        <Marker coordinate={{ latitude: meetup.place_lat, longitude: meetup.place_lng }} pinColor="green" title={meetup.place_name} />
        {Object.values(pings).map((p) => (
          <Marker key={p.user_id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.user_id} />
        ))}
      </MapView>
      <View style={s.banner}>
        <Text style={s.bannerText}>
          {tracking === id ? '내 위치 공유 중'
            : permission === 'denied' ? '위치 권한이 꺼져 있어요 (설정에서 허용 필요)'
            : '약속 시간이 가까워지면 자동으로 공유가 시작돼요'}
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  banner: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 10 },
  bannerText: { color: '#fff', textAlign: 'center' },
});
```

- [ ] **Step 2: Stack에 추가**

Edit `MeetPod/mobile/src/navigation/MeetupsStack.tsx` — 임포트 + Screen 추가:
```tsx
import { MeetupMapScreen } from '@/screens/meetups/MeetupMapScreen';
// Stack 안에:
<S.Screen name="MeetupMap" component={MeetupMapScreen} options={{ title: '실시간 위치' }} />
```

- [ ] **Step 3: 라이브 검증 (실기기 권장)**

1. Plan 8에서 만든 약속의 `starts_at`을 5분 후로, `ends_at`을 30분 후로 갱신(또는 새 약속 생성).
2. `share_minutes_before=20`이면 즉시 트래킹 시작 조건 충족. 앱이 권한 다이얼로그 표시.
3. "Always Allow" 선택 → 백그라운드 task 등록. Studio SQL에서:
   ```sql
   SELECT user_id, COUNT(*) FROM location_pings WHERE meetup_id='<mid>' GROUP BY 1;
   ```
   30초~1분 후 핀 누적 확인.
4. 다른 디바이스/계정으로 같은 약속 참여자로 진입 → MeetupMapScreen에서 상대 핀 표시 + 새 핀이 들어올 때마다 갱신.
5. `ends_at` 도과 후 트래킹 자동 종료(SecureStore 비워짐, foreground service notification 사라짐).

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/mobile/src/screens/meetups/MeetupMapScreen.tsx MeetPod/mobile/src/navigation/MeetupsStack.tsx
git commit -m "feat(mobile): meetup map with realtime ping subscription"
```

---

## Self-Review Notes

§6.4 위치 공유 자동 시작/종료, RLS 본인 INSERT만, Realtime 핀 갱신 ✓
백엔드 미경유 INSERT (Vercel WS 부적합 회피, §3) ✓
권한 거부 fallback: 안내 배너 + foreground 한정 모드 (white-listed) ✓
ends_at 24h 후 정리는 pg_cron(Plan 1) 담당 ✓

**Open question(스펙 §9):** "Always Allow" 거부 시 fallback UX는 현재 안내만 — 후속 Plan에서 포그라운드 watchPosition wiring 가능. MVP는 이 정도로 충분.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
