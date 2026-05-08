# Plan 6 — Mobile 부트스트랩 & 소셜 로그인 + 온보딩

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expo + React Native + TypeScript 프로젝트를 초기화하고, 네비게이션 골격(Auth stack ↔ Main tab), Supabase 클라이언트, 백엔드 axios 클라이언트, Zustand 인증 스토어, 소셜 로그인(Google) + 핸들 온보딩 화면까지 구현한다.

**Architecture:**
- 인증 흐름: Google OAuth (Supabase Auth `signInWithOAuth` + `expo-web-browser`) → Supabase JWT 획득 → 백엔드 `/api/auth/bootstrap` 호출 → `/api/profiles/me`로 핸들 유무 판단 → 핸들 없으면 OnboardingHandleScreen.
- Apple/Kakao는 본 Plan의 동일 패턴(`signInWithOAuth(provider)`)으로 추가 가능하나, 스펙 §9에 명시된 검증 이슈로 MVP에서는 Google만 wiring. Apple/Kakao 단추는 UI에 노출하되 "곧 출시" 토스트.
- 모든 네트워크 요청은 axios 인터셉터가 Supabase access token을 자동 부착. 401 발생 시 1회 refresh 시도 후 실패하면 로그아웃.
- Zustand `authStore` = `{ session, profile, status }`. AppRoot가 status로 stack 분기.

**Tech Stack:** Expo SDK 51, React Native, TypeScript, React Navigation 6, Zustand 4, axios, @supabase/supabase-js 2, expo-web-browser, expo-secure-store, expo-linking.

**전제:** Plan 2(`/api/auth/bootstrap`, `/api/profiles/me`, `PATCH .../handle`) 라이브. Supabase 프로젝트 (Plan 1).

---

## File Structure

```
MeetPod/mobile/
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── App.tsx                          # AppRoot — provider + RootNavigator
├── .env.example
├── src/
│   ├── lib/
│   │   ├── supabase.ts              # createClient + AsyncStorage adapter
│   │   ├── deep_link.ts             # expo-linking config (다음 Plan에서 확장)
│   │   └── env.ts                   # process.env wrapper + 검증
│   ├── api/
│   │   ├── client.ts                # axios instance + 인터셉터
│   │   ├── auth.ts                  # bootstrap, getMe, setHandle
│   │   └── types.ts                 # Profile 등 공유 DTO
│   ├── store/
│   │   └── authStore.ts             # zustand: session/profile/status
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # status로 분기
│   │   ├── AuthStack.tsx            # Login, Onboarding
│   │   └── MainTabs.tsx             # 빈 placeholder 4탭
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── OnboardingHandleScreen.tsx
│   │   └── placeholders/            # tabs용 Empty
│   │       ├── MeetupsPlaceholder.tsx
│   │       ├── GroupsPlaceholder.tsx
│   │       ├── ChatsPlaceholder.tsx
│   │       └── MePlaceholder.tsx
│   └── components/
│       └── PrimaryButton.tsx
└── __tests__/
    ├── authStore.test.ts
    └── api_client.test.ts
```

---

## Task 1: Expo 프로젝트 초기화 + TS 설정

**Files:**
- Create: `MeetPod/mobile/` (전체 트리)

- [ ] **Step 1: Expo create**

Run (PowerShell, `MeetPod/` 부모 디렉터리에서):
```powershell
cd d:\Workspace\CPKWorks\MeetPod
npx create-expo-app@latest mobile --template blank-typescript
```
Expected: `MeetPod/mobile` 디렉터리가 Expo SDK 51 boilerplate로 생성.

- [ ] **Step 2: 핵심 의존성 설치**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context expo-web-browser expo-secure-store expo-linking @supabase/supabase-js @react-native-async-storage/async-storage
npm install zustand axios
npm install -D @types/react jest jest-expo @testing-library/react-native @testing-library/jest-native
```
Expected: 설치 에러 없음.

- [ ] **Step 3: jest 설정**

Edit `MeetPod/mobile/package.json` — `scripts`에 추가, `jest` 키 추가:
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEach": ["@testing-library/jest-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)/)"
    ]
  }
}
```

- [ ] **Step 4: .env.example**

Create `MeetPod/mobile/.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=replace
```

> **Note:** Android 에뮬레이터는 호스트 `localhost`에 `10.0.2.2`로 접근. iOS 시뮬레이터는 `http://localhost:8000/api`. 실기기는 PC IP.

- [ ] **Step 5: app.json — 딥링크 scheme + 권한 placeholder**

Edit `MeetPod/mobile/app.json` — `expo` 키 안에 다음 추가/수정:
```json
{
  "expo": {
    "name": "MeetPod",
    "slug": "meetpod",
    "scheme": "meetpod",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "ios": { "supportsTablet": false, "bundleIdentifier": "com.cpkworks.meetpod" },
    "android": { "package": "com.cpkworks.meetpod" },
    "plugins": ["expo-secure-store"]
  }
}
```

- [ ] **Step 6: tsconfig 경로 alias**

Edit `MeetPod/mobile/tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

- [ ] **Step 7: babel — alias plugin (선택)**

Edit `MeetPod/mobile/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
    ],
  };
};
```

Run:
```powershell
npm install -D babel-plugin-module-resolver
```

- [ ] **Step 8: 빌드 sanity**

Run:
```powershell
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 9: Commit**

```powershell
git add MeetPod/mobile
git commit -m "chore(mobile): scaffold expo+ts project with navigation/supabase deps"
```

---

## Task 2: env + Supabase 클라이언트

**Files:**
- Create: `MeetPod/mobile/src/lib/env.ts`
- Create: `MeetPod/mobile/src/lib/supabase.ts`

- [ ] **Step 1: env.ts**

Create `MeetPod/mobile/src/lib/env.ts`:
```ts
function required(key: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

export const env = {
  SUPABASE_URL: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  SUPABASE_ANON_KEY: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  API_BASE_URL: required('EXPO_PUBLIC_API_BASE_URL', process.env.EXPO_PUBLIC_API_BASE_URL),
};
```

- [ ] **Step 2: supabase.ts**

Create `MeetPod/mobile/src/lib/supabase.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: typecheck**

Run:
```powershell
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/mobile/src/lib
git commit -m "feat(mobile): env config + supabase client"
```

---

## Task 3: 백엔드 axios 클라이언트 + 단위 테스트

**Files:**
- Create: `MeetPod/mobile/src/api/client.ts`
- Create: `MeetPod/mobile/src/api/types.ts`
- Create: `MeetPod/mobile/__tests__/api_client.test.ts`

- [ ] **Step 1: types.ts**

Create `MeetPod/mobile/src/api/types.ts`:
```ts
export interface Profile {
  id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  expo_push_token: string | null;
}
```

- [ ] **Step 2: 테스트 (실패)**

Create `MeetPod/mobile/__tests__/api_client.test.ts`:
```ts
import { __setSessionForTest, apiClient } from '../src/api/client';

jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

describe('apiClient', () => {
  it('attaches bearer when session present', async () => {
    __setSessionForTest({ access_token: 'tok123' });
    const cfg = await (apiClient.interceptors.request as any).handlers[0].fulfilled({ headers: {} });
    expect(cfg.headers.Authorization).toBe('Bearer tok123');
  });

  it('omits header when no session', async () => {
    __setSessionForTest(null);
    const cfg = await (apiClient.interceptors.request as any).handlers[0].fulfilled({ headers: {} });
    expect(cfg.headers.Authorization).toBeUndefined();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
$env:EXPO_PUBLIC_SUPABASE_URL="http://x"; $env:EXPO_PUBLIC_SUPABASE_ANON_KEY="x"; $env:EXPO_PUBLIC_API_BASE_URL="http://x"
npm test -- api_client
```
Expected: ImportError FAIL.

- [ ] **Step 4: client.ts 구현**

Create `MeetPod/mobile/src/api/client.ts`:
```ts
import axios from 'axios';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

type SessionLike = { access_token: string } | null;

let _testSession: SessionLike | undefined;
export function __setSessionForTest(s: SessionLike) {
  _testSession = s;
}

async function currentToken(): Promise<string | null> {
  if (_testSession !== undefined) return _testSession?.access_token ?? null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await currentToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && _testSession === undefined) {
      const { data, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && data.session && !error.config.__retried) {
        error.config.__retried = true;
        return apiClient.request(error.config);
      }
      await supabase.auth.signOut();
    }
    return Promise.reject(error);
  },
);
```

- [ ] **Step 5: 통과**

Run:
```powershell
npm test -- api_client
```
Expected: 2 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/mobile/src/api MeetPod/mobile/__tests__/api_client.test.ts
git commit -m "feat(mobile): axios client with auto bearer + 401 refresh"
```

---

## Task 4: auth API 함수

**Files:**
- Create: `MeetPod/mobile/src/api/auth.ts`

- [ ] **Step 1: auth.ts**

Create `MeetPod/mobile/src/api/auth.ts`:
```ts
import { apiClient } from './client';
import type { Profile } from './types';

export async function bootstrap(displayName: string, avatarUrl?: string): Promise<Profile> {
  const { data } = await apiClient.post<Profile>('/auth/bootstrap', {
    display_name: displayName,
    avatar_url: avatarUrl ?? null,
  });
  return data;
}

export async function getMe(): Promise<Profile | null> {
  try {
    const { data } = await apiClient.get<Profile>('/profiles/me');
    return data;
  } catch (e: any) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}

export async function setHandle(handle: string): Promise<Profile> {
  const { data } = await apiClient.patch<Profile>('/profiles/me/handle', { handle });
  return data;
}
```

- [ ] **Step 2: typecheck**

Run:
```powershell
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/mobile/src/api/auth.ts
git commit -m "feat(mobile): auth api (bootstrap, getMe, setHandle)"
```

---

## Task 5: authStore (zustand) + 단위 테스트

**Files:**
- Create: `MeetPod/mobile/src/store/authStore.ts`
- Create: `MeetPod/mobile/__tests__/authStore.test.ts`

- [ ] **Step 1: 테스트 (실패)**

Create `MeetPod/mobile/__tests__/authStore.test.ts`:
```ts
import { useAuthStore } from '../src/store/authStore';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signOut: jest.fn() },
  },
}));
jest.mock('@/api/auth', () => ({
  bootstrap: jest.fn(async () => ({ id: 'u1', handle: null, display_name: 'A', avatar_url: null, expo_push_token: null })),
  getMe: jest.fn(async () => ({ id: 'u1', handle: 'alice', display_name: 'A', avatar_url: null, expo_push_token: null })),
}));

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ session: null, profile: null, status: 'unknown' }));

  it('starts unknown', () => {
    expect(useAuthStore.getState().status).toBe('unknown');
  });

  it('sets needsHandle when getMe returns null handle', async () => {
    const { hydrateAfterAuth } = useAuthStore.getState();
    const { bootstrap } = require('@/api/auth');
    bootstrap.mockResolvedValueOnce({ id: 'u1', handle: null, display_name: 'A', avatar_url: null, expo_push_token: null });
    const { getMe } = require('@/api/auth');
    getMe.mockResolvedValueOnce({ id: 'u1', handle: null, display_name: 'A', avatar_url: null, expo_push_token: null });

    await hydrateAfterAuth({ access_token: 't', user: { id: 'u1', user_metadata: { full_name: 'A' } } } as any);
    expect(useAuthStore.getState().status).toBe('needsHandle');
  });

  it('sets ready when handle present', async () => {
    const { hydrateAfterAuth } = useAuthStore.getState();
    await hydrateAfterAuth({ access_token: 't', user: { id: 'u1', user_metadata: { full_name: 'A' } } } as any);
    expect(useAuthStore.getState().status).toBe('ready');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
npm test -- authStore
```
Expected: ImportError FAIL.

- [ ] **Step 3: 구현**

Create `MeetPod/mobile/src/store/authStore.ts`:
```ts
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { bootstrap, getMe, setHandle as apiSetHandle } from '@/api/auth';
import type { Profile } from '@/api/types';
import type { Session } from '@supabase/supabase-js';

type Status = 'unknown' | 'unauthenticated' | 'needsHandle' | 'ready';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  status: Status;
  hydrateAfterAuth: (session: Session) => Promise<void>;
  setHandle: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
  initFromStored: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  status: 'unknown',

  initFromStored: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      set({ status: 'unauthenticated' });
      return;
    }
    await get().hydrateAfterAuth(data.session);
  },

  hydrateAfterAuth: async (session) => {
    set({ session });
    let me = await getMe();
    if (!me) {
      const displayName =
        (session.user.user_metadata?.full_name as string) ||
        (session.user.user_metadata?.name as string) ||
        session.user.email?.split('@')[0] ||
        'User';
      me = await bootstrap(displayName);
    }
    set({ profile: me, status: me.handle ? 'ready' : 'needsHandle' });
  },

  setHandle: async (handle) => {
    const updated = await apiSetHandle(handle);
    set({ profile: updated, status: 'ready' });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: 'unauthenticated' });
  },
}));
```

- [ ] **Step 4: 통과**

Run:
```powershell
npm test -- authStore
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/mobile/src/store MeetPod/mobile/__tests__/authStore.test.ts
git commit -m "feat(mobile): authStore (init/hydrate/setHandle/signOut)"
```

---

## Task 6: Supabase Google OAuth 설정 (콘솔)

**Files:** (Supabase 콘솔, 코드 변경 없음)

- [ ] **Step 1: Google Cloud Console에서 OAuth 클라이언트 생성**

https://console.cloud.google.com → APIs & Services → Credentials → Create Credentials → OAuth client ID
- Application type: **Web application** (Supabase가 콜백 처리)
- Authorized redirect URIs: `https://<supabase-ref>.supabase.co/auth/v1/callback`

Client ID / secret 메모.

- [ ] **Step 2: Supabase 콘솔에서 Google provider 활성화**

Supabase Studio → Authentication → Providers → Google:
- Enable
- Client ID / Client Secret 입력
- Authorized Client IDs: 비워두기 (모바일은 Supabase 경유 OAuth 사용)
- Save

- [ ] **Step 3: Redirect URLs에 앱 scheme 추가**

Supabase Studio → Authentication → URL Configuration → Redirect URLs:
- `meetpod://auth-callback`

- [ ] **Step 4: 메모만 commit (옵션)**

```powershell
cd d:\Workspace\CPKWorks\MeetPod
git commit --allow-empty -m "chore(supabase): enable google oauth + add meetpod:// redirect"
```

---

## Task 7: LoginScreen + OAuth 핸들러

**Files:**
- Create: `MeetPod/mobile/src/components/PrimaryButton.tsx`
- Create: `MeetPod/mobile/src/screens/auth/LoginScreen.tsx`

- [ ] **Step 1: PrimaryButton**

Create `MeetPod/mobile/src/components/PrimaryButton.tsx`:
```tsx
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, loading, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        s.btn,
        (loading || disabled) && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.label}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: LoginScreen**

Create `MeetPod/mobile/src/screens/auth/LoginScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { PrimaryButton } from '@/components/PrimaryButton';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const [loading, setLoading] = useState<string | null>(null);
  const hydrate = useAuthStore((s) => s.hydrateAfterAuth);

  async function loginWithGoogle() {
    setLoading('google');
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        setLoading(null);
        return;
      }
      // URL fragment의 access_token / refresh_token 추출
      const url = new URL(result.url.replace('#', '?'));
      const access_token = url.searchParams.get('access_token');
      const refresh_token = url.searchParams.get('refresh_token');
      if (!access_token || !refresh_token) throw new Error('missing tokens in callback');

      const { data: sessData, error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setErr || !sessData.session) throw setErr ?? new Error('failed to set session');

      await hydrate(sessData.session);
    } catch (e: any) {
      Alert.alert('로그인 실패', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>MeetPod</Text>
      <Text style={s.sub}>친구와 약속, 한 곳에서.</Text>
      <View style={{ height: 40 }} />
      <PrimaryButton label="Google로 계속하기" onPress={loginWithGoogle} loading={loading === 'google'} />
      <PrimaryButton label="Apple로 계속하기 (준비중)" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
      <PrimaryButton label="Kakao로 계속하기 (준비중)" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 36, fontWeight: '800' },
  sub: { fontSize: 16, color: '#666', marginTop: 8 },
});
```

- [ ] **Step 3: typecheck**

Run:
```powershell
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/mobile/src/components MeetPod/mobile/src/screens/auth/LoginScreen.tsx
git commit -m "feat(mobile): login screen with google oauth via expo-web-browser"
```

---

## Task 8: OnboardingHandleScreen

**Files:**
- Create: `MeetPod/mobile/src/screens/auth/OnboardingHandleScreen.tsx`

- [ ] **Step 1: 화면 작성**

Create `MeetPod/mobile/src/screens/auth/OnboardingHandleScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { PrimaryButton } from '@/components/PrimaryButton';

const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

export function OnboardingHandleScreen() {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const setHandleAction = useAuthStore((s) => s.setHandle);

  async function submit() {
    if (!HANDLE_RE.test(handle)) {
      Alert.alert('형식 오류', '영문/숫자/_ 3~20자');
      return;
    }
    setBusy(true);
    try {
      await setHandleAction(handle);
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message;
      Alert.alert('핸들 설정 실패', String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>핸들을 정해주세요</Text>
      <Text style={s.sub}>친구가 회원님을 식별하는 ID입니다. 이후 변경할 수 없어요.</Text>
      <View style={s.row}>
        <Text style={s.at}>@</Text>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="harry"
          style={s.input}
          maxLength={20}
        />
      </View>
      <PrimaryButton label="시작하기" onPress={submit} loading={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, color: '#666', marginTop: 8, marginBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 24 },
  at: { fontSize: 22, color: '#888', marginRight: 4 },
  input: { flex: 1, fontSize: 22, paddingVertical: 12 },
});
```

- [ ] **Step 2: Commit**

```powershell
git add MeetPod/mobile/src/screens/auth/OnboardingHandleScreen.tsx
git commit -m "feat(mobile): onboarding handle screen"
```

---

## Task 9: Navigation 골격

**Files:**
- Create: `MeetPod/mobile/src/navigation/AuthStack.tsx`
- Create: `MeetPod/mobile/src/navigation/MainTabs.tsx`
- Create: `MeetPod/mobile/src/navigation/RootNavigator.tsx`
- Create: `MeetPod/mobile/src/screens/placeholders/*.tsx` (4개)
- Modify: `MeetPod/mobile/App.tsx`

- [ ] **Step 1: 4개 placeholder 화면**

Create `MeetPod/mobile/src/screens/placeholders/MeetupsPlaceholder.tsx`:
```tsx
import React from 'react';
import { View, Text } from 'react-native';
export function MeetupsPlaceholder() {
  return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Meetups (Plan 8)</Text></View>;
}
```

같은 패턴으로 `GroupsPlaceholder.tsx`(Plan 7), `ChatsPlaceholder.tsx`(Plan 10), `MePlaceholder.tsx`(Plan 6 마무리에서 확장).

- [ ] **Step 2: AuthStack**

Create `MeetPod/mobile/src/navigation/AuthStack.tsx`:
```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OnboardingHandleScreen } from '@/screens/auth/OnboardingHandleScreen';
import { useAuthStore } from '@/store/authStore';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  const status = useAuthStore((s) => s.status);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'needsHandle' ? (
        <Stack.Screen name="Onboarding" component={OnboardingHandleScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: MainTabs**

Create `MeetPod/mobile/src/navigation/MainTabs.tsx`:
```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MeetupsPlaceholder } from '@/screens/placeholders/MeetupsPlaceholder';
import { GroupsPlaceholder } from '@/screens/placeholders/GroupsPlaceholder';
import { ChatsPlaceholder } from '@/screens/placeholders/ChatsPlaceholder';
import { MePlaceholder } from '@/screens/placeholders/MePlaceholder';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Meetups" component={MeetupsPlaceholder} />
      <Tab.Screen name="Groups" component={GroupsPlaceholder} />
      <Tab.Screen name="Chats" component={ChatsPlaceholder} />
      <Tab.Screen name="Me" component={MePlaceholder} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: RootNavigator**

Create `MeetPod/mobile/src/navigation/RootNavigator.tsx`:
```tsx
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.initFromStored);
  const hydrate = useAuthStore((s) => s.hydrateAfterAuth);

  useEffect(() => {
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) hydrate(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === 'unknown') {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  return (
    <NavigationContainer>
      {status === 'ready' ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
```

- [ ] **Step 5: App.tsx**

Replace `MeetPod/mobile/App.tsx`:
```tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 6: typecheck + 부팅**

Run:
```powershell
npx tsc --noEmit
npm start
```
별도 디바이스/시뮬레이터에서 Expo Go로 접속.
Expected: LoginScreen 표시.

- [ ] **Step 7: 라이브 OAuth 흐름 테스트**

Backend(Plan 2)를 `uvicorn`으로 기동하고, Expo 앱에서 "Google로 계속하기" → 브라우저 → 동의 → `meetpod://auth-callback` 복귀 → OnboardingHandleScreen 노출 확인.
핸들 입력 → MainTabs(placeholder)로 전환 확인.

Backend 로그에 `POST /api/auth/bootstrap`, `GET /api/profiles/me`, `PATCH /api/profiles/me/handle` 200이 찍혀야 한다.

- [ ] **Step 8: Commit**

```powershell
git add MeetPod/mobile/src/navigation MeetPod/mobile/src/screens/placeholders MeetPod/mobile/App.tsx
git commit -m "feat(mobile): root navigator + auth/main split + tab placeholders"
```

---

## Self-Review Notes

§6.1 가입 흐름 4단계 모두 구현 (소셜 로그인 → bootstrap → 핸들 → push token은 Plan 10) ✓
Apple/Kakao는 비활성 단추로 노출, 후속 작업 필요 (스펙 §9 위험 항목) ✓
Tab 4개 placeholder가 후속 Plan 7/8/10에서 실제 화면으로 교체 ✓

**제외:** push token 등록 (Plan 10), 딥링크 invite 처리(Plan 7), Apple/Kakao 백엔드 검증.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
