# MeetPod UI 디자인 구현 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec ([2026-05-13-ui-design.md](../specs/2026-05-13-ui-design.md))의 디자인 토큰·공통 컴포넌트를 도입하고 모든 화면(LoginScreen, OnboardingHandleScreen, MeetupList/Detail/Create/Map, GroupList/Detail/Members/Invite, ChatList/Room, PlacePicker, InviteAccept, Friends, Me, MeetupCreate)에 일괄 적용한다.

**Architecture:** 새 `mobile/src/theme/` 모듈에 디자인 토큰을 모으고, 새 `mobile/src/ui/` 디렉터리에 공통 컴포넌트(Button, Card, Header, TabBar, Badge, Avatar, ScreenContainer, Input)를 추가. 기존 화면들을 한 화면씩 새 컴포넌트로 교체. NativeWind/Tamagui 등 라이브러리 도입은 없음.

**Tech Stack:** React Native + TypeScript + StyleSheet + react-native-safe-area-context + @expo-google-fonts/pretendard + expo-font.

**전제:** 모든 화면이 현재 작동 중 (Plan 6-10 완료). 백엔드는 프로덕션(`backend-ochre-six-23.vercel.app`)에 배포됨.

---

## File Structure

### 신규
```
mobile/src/theme/
├── index.ts             # 통합 export
├── colors.ts            # 색상 토큰
├── typography.ts        # font family, scale, weights
├── spacing.ts           # 4·8·12·16·24·32 함수
├── radius.ts            # xs 4 / sm 6 / md 8 / pill 999
└── shadows.ts           # iOS/Android shadow 매핑

mobile/src/ui/
├── ScreenContainer.tsx  # 루트 컨테이너 (배경 + SafeArea)
├── Header.tsx           # 다크 오렌지 헤더 + action slot
├── HeaderButton.tsx     # 28x28 다크 액션 단추
├── Card.tsx             # 흰 카드 (variant: default | hero | row)
├── Button.tsx           # primary | ghostOnOrange | dangerOnSurface | dark
├── Badge.tsx            # today | live | ended | cancelled
├── Avatar.tsx           # squircle, 결정론적 색상
├── TabBarFloating.tsx   # 다크 플로팅 캡슐 탭바
├── Input.tsx            # 흰 input, focus 시 brand border
└── EmptyState.tsx       # 빈 화면 안내 + CTA
```

### 수정 (한 화면 = 한 커밋)
```
mobile/src/components/PrimaryButton.tsx     # 새 Button 사용하도록 변경 또는 deprecate
mobile/src/components/MemberPicker.tsx      # 새 토큰 + Avatar 사용
mobile/src/components/MessageBubble.tsx     # 토큰 적용 (bubble 색)
mobile/src/components/PlaceCard.tsx         # Card variant 사용
mobile/src/navigation/MainTabs.tsx          # TabBarFloating 적용 (탭바 컴포넌트 교체)
mobile/src/screens/auth/LoginScreen.tsx
mobile/src/screens/auth/OnboardingHandleScreen.tsx
mobile/src/screens/meetups/MeetupListScreen.tsx
mobile/src/screens/meetups/MeetupDetailScreen.tsx
mobile/src/screens/meetups/MeetupCreateScreen.tsx
mobile/src/screens/meetups/MeetupMapScreen.tsx
mobile/src/screens/meetups/PlacePickerScreen.tsx
mobile/src/screens/groups/GroupListScreen.tsx
mobile/src/screens/groups/GroupDetailScreen.tsx
mobile/src/screens/groups/GroupMembersScreen.tsx
mobile/src/screens/groups/GroupInviteScreen.tsx
mobile/src/screens/chats/ChatListScreen.tsx
mobile/src/screens/chats/ChatRoomScreen.tsx
mobile/src/screens/friends/FriendListScreen.tsx
mobile/src/screens/friends/FriendInviteScreen.tsx
mobile/src/screens/invites/InviteAcceptScreen.tsx
mobile/src/screens/me/MeScreen.tsx
mobile/App.tsx                              # Pretendard 폰트 로드
```

---

## Task 1: 디자인 토큰 모듈

**Files:**
- Create: `mobile/src/theme/colors.ts`
- Create: `mobile/src/theme/typography.ts`
- Create: `mobile/src/theme/spacing.ts`
- Create: `mobile/src/theme/radius.ts`
- Create: `mobile/src/theme/shadows.ts`
- Create: `mobile/src/theme/index.ts`

- [ ] **Step 1: `colors.ts` 작성**

Create `mobile/src/theme/colors.ts`:
```ts
export const colors = {
  brandPrimary:     '#FF6900',
  brandPrimaryDark: '#E55A00',
  brandSecondary:   '#FEE500',

  ink:              '#1F1B0F',
  inkInverse:       '#FFFFFF',
  muted:            '#64748B',
  mutedLight:       '#94A3B8',

  surface:          '#FFFFFF',
  surfaceSubtle:    '#F8FAFC',
  surfaceDark:      '#1F1B0F',

  success:          '#3DD68C',
  warning:          '#F59E0B',
  danger:           '#EF4444',
  info:             '#6366F1',

  border:           '#E2E8F0',
  borderOnOrange:   'rgba(255,255,255,0.25)',
  ghostOverlay:     'rgba(255,255,255,0.18)',
} as const;

export type ColorKey = keyof typeof colors;
```

- [ ] **Step 2: `typography.ts` 작성**

Create `mobile/src/theme/typography.ts`:
```ts
export const fontFamily = {
  // Pretendard 로드 후 사용. 미로드 상태에서는 fallback.
  base: 'Pretendard',
  fallback: undefined as undefined,  // 시스템 폰트
};

export const fontSize = {
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 19,
  '2xl': 22,
  '3xl': 26,
} as const;

export const fontWeight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '800',
} as const;
```

- [ ] **Step 3: `spacing.ts` 작성**

Create `mobile/src/theme/spacing.ts`:
```ts
/** 1 unit = 4px. spacing(3) = 12. spacing(3.5) = 14. */
export const spacing = (n: number): number => n * 4;
```

- [ ] **Step 4: `radius.ts` 작성**

Create `mobile/src/theme/radius.ts`:
```ts
export const radius = {
  xs:   4,
  sm:   6,
  md:   8,
  pill: 999,
} as const;
```

- [ ] **Step 5: `shadows.ts` 작성**

Create `mobile/src/theme/shadows.ts`:
```ts
import { Platform } from 'react-native';

export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    android: { elevation: 1 },
    default: {},
  })!,
  floatingTabbar: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 12 },
    default: {},
  })!,
  headerSeparator: Platform.select({
    ios: { shadowColor: '#1F1B0F', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 4 },
    default: {},
  })!,
};
```

- [ ] **Step 6: `index.ts` 통합**

Create `mobile/src/theme/index.ts`:
```ts
export { colors } from './colors';
export type { ColorKey } from './colors';
export { fontFamily, fontSize, fontWeight } from './typography';
export { spacing } from './spacing';
export { radius } from './radius';
export { shadows } from './shadows';
```

- [ ] **Step 7: typecheck**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 8: Commit**

```powershell
git add mobile/src/theme
git commit -m "feat(ui): design tokens module (colors/type/spacing/radius/shadows)"
```

---

## Task 2: Pretendard 폰트 로드

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/App.tsx`

- [ ] **Step 1: 패키지 설치**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npm install --legacy-peer-deps @expo-google-fonts/pretendard expo-font expo-splash-screen
```
Expected: 설치 성공.

- [ ] **Step 2: App.tsx 폰트 로드**

Edit `mobile/App.tsx` — 전체 교체:
```tsx
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Pretendard_400Regular, Pretendard_500Medium, Pretendard_600SemiBold, Pretendard_700Bold, Pretendard_800ExtraBold } from '@expo-google-fonts/pretendard';
import '@/lib/local_notifications';
import { RootNavigator } from '@/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [loaded] = useFonts({
    Pretendard_400Regular,
    Pretendard_500Medium,
    Pretendard_600SemiBold,
    Pretendard_700Bold,
    Pretendard_800ExtraBold,
  });

  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: typography.ts에서 실제 폰트명 매핑**

Edit `mobile/src/theme/typography.ts` — `fontFamily` 객체 교체:
```ts
export const fontFamily = {
  regular:  'Pretendard_400Regular',
  medium:   'Pretendard_500Medium',
  semibold: 'Pretendard_600SemiBold',
  bold:     'Pretendard_700Bold',
  black:    'Pretendard_800ExtraBold',
} as const;
```

- [ ] **Step 4: 라이브 검증**

Expo 자동 리로드(또는 새로고침) 후 핸드폰에서 텍스트가 Pretendard로 표시되는지 확인. 한글 텍스트("약속", "그룹" 등)에서 차이 두드러짐.

- [ ] **Step 5: Commit**

```powershell
git add mobile/package.json mobile/package-lock.json mobile/App.tsx mobile/src/theme/typography.ts
git commit -m "feat(ui): load Pretendard font family"
```

---

## Task 3: ScreenContainer + Header

**Files:**
- Create: `mobile/src/ui/ScreenContainer.tsx`
- Create: `mobile/src/ui/Header.tsx`
- Create: `mobile/src/ui/HeaderButton.tsx`

- [ ] **Step 1: HeaderButton**

Create `mobile/src/ui/HeaderButton.tsx`:
```tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, fontFamily, fontSize } from '@/theme';

interface Props {
  label?: string;
  icon?: string;
  onPress: () => void;
}

export function HeaderButton({ label, icon, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, pressed && s.pressed]} hitSlop={8}>
      <Text style={s.text}>{icon ?? label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 28, height: 28, borderRadius: radius.xs,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  text: { color: colors.brandSecondary, fontFamily: fontFamily.black, fontSize: fontSize.md, lineHeight: fontSize.lg },
});
```

- [ ] **Step 2: Header**

Create `mobile/src/ui/Header.tsx`:
```tsx
import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}

export function Header({ title, subtitle, back, action }: Props) {
  const nav = useNavigation<any>();
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {back && (
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={s.backBtn}>
            <Text style={s.back}>‹</Text>
          </Pressable>
        )}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <View style={s.actionWrap}>{action}</View>
      </View>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.brandPrimaryDark,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3.5),
    paddingBottom: spacing(3),
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  back: { color: colors.inkInverse, fontSize: 28, fontFamily: fontFamily.regular, lineHeight: 30 },
  title: { flex: 1, color: colors.inkInverse, fontFamily: fontFamily.black, fontSize: fontSize['2xl'] },
  actionWrap: { marginLeft: spacing(2) },
  sub: { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
```

- [ ] **Step 3: ScreenContainer**

Create `mobile/src/ui/ScreenContainer.tsx`:
```tsx
import React, { ReactNode } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

interface Props {
  header?: ReactNode;
  children: ReactNode;
  /** TabBar가 있는 화면이면 본문 패딩 bottom 추가됨 */
  hasTabBar?: boolean;
}

export const TABBAR_RESERVED_HEIGHT = 84;   // 다크 캡슐 + safe area 여유

export function ScreenContainer({ header, children, hasTabBar }: Props) {
  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <StatusBar barStyle="light-content" />
      {header}
      <View style={[s.body, hasTabBar && { paddingBottom: TABBAR_RESERVED_HEIGHT }]}>{children}</View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  body: { flex: 1 },
});
```

- [ ] **Step 4: typecheck**

```powershell
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 5: Commit**

```powershell
git add mobile/src/ui/ScreenContainer.tsx mobile/src/ui/Header.tsx mobile/src/ui/HeaderButton.tsx
git commit -m "feat(ui): ScreenContainer + Header + HeaderButton"
```

---

## Task 4: Card + Badge

**Files:**
- Create: `mobile/src/ui/Card.tsx`
- Create: `mobile/src/ui/Badge.tsx`

- [ ] **Step 1: Card**

Create `mobile/src/ui/Card.tsx`:
```tsx
import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { colors, radius, spacing, shadows } from '@/theme';

type Variant = 'default' | 'hero' | 'row';

interface Props {
  children: ReactNode;
  variant?: Variant;
  onPress?: () => void;
  style?: ViewStyle;
}

const PADDINGS: Record<Variant, ViewStyle> = {
  default: { padding: spacing(3.5) },
  hero:    { padding: spacing(4) },
  row:     { paddingVertical: spacing(3), paddingHorizontal: spacing(3.5) },
};

export function Card({ children, variant = 'default', onPress, style }: Props) {
  const inner = <View style={[s.card, PADDINGS[variant], style]}>{children}</View>;
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => [pressed && s.pressed]}>{inner}</Pressable>
    : inner;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    marginHorizontal: spacing(3),
    marginBottom: spacing(2),
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
});
```

- [ ] **Step 2: Badge**

Create `mobile/src/ui/Badge.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/theme';

type Tone = 'today' | 'live' | 'ended' | 'cancelled' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  today:     { bg: colors.brandSecondary, fg: colors.ink },
  live:      { bg: colors.success,        fg: colors.inkInverse },
  ended:     { bg: colors.mutedLight,     fg: colors.inkInverse },
  cancelled: { bg: colors.danger,         fg: colors.inkInverse },
  neutral:   { bg: colors.surfaceSubtle,  fg: colors.ink },
};

interface Props {
  tone?: Tone;
  children: string;
}

export function Badge({ tone = 'neutral', children }: Props) {
  const t = TONES[tone];
  return (
    <View style={[s.box, { backgroundColor: t.bg }]}>
      <Text style={[s.text, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(1.75),
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  text: { fontFamily: fontFamily.bold, fontSize: 10, letterSpacing: 0.3 },
});
```

- [ ] **Step 3: typecheck + Commit**

```powershell
npx tsc --noEmit
git add mobile/src/ui/Card.tsx mobile/src/ui/Badge.tsx
git commit -m "feat(ui): Card + Badge components"
```

---

## Task 5: Button + Input

**Files:**
- Create: `mobile/src/ui/Button.tsx`
- Create: `mobile/src/ui/Input.tsx`

- [ ] **Step 1: Button**

Create `mobile/src/ui/Button.tsx`:
```tsx
import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/theme';

type Variant = 'primary' | 'ghostOnOrange' | 'dangerOnSurface' | 'dark';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const VARIANTS: Record<Variant, { bg: string; fg: string }> = {
  primary:          { bg: colors.brandSecondary, fg: colors.ink },
  ghostOnOrange:    { bg: colors.ghostOverlay,   fg: colors.inkInverse },
  dangerOnSurface:  { bg: colors.surface,        fg: colors.danger },
  dark:             { bg: colors.surfaceDark,    fg: colors.brandSecondary },
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: v.bg },
        isDisabled && s.disabled,
        pressed && s.pressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={v.fg} />
        : <Text style={[s.label, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
});
```

- [ ] **Step 2: Input**

Create `mobile/src/ui/Input.tsx`:
```tsx
import React, { useState, forwardRef } from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/theme';

export const Input = forwardRef<TextInput, TextInputProps>(function Input(props, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedLight}
      {...props}
      style={[
        s.input,
        focused && s.focused,
        props.multiline && { minHeight: 80, textAlignVertical: 'top' },
        props.style,
      ]}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    />
  );
});

const s = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
  },
  focused: { borderColor: colors.brandPrimary, borderWidth: 2 },
});
```

- [ ] **Step 3: typecheck + Commit**

```powershell
npx tsc --noEmit
git add mobile/src/ui/Button.tsx mobile/src/ui/Input.tsx
git commit -m "feat(ui): Button + Input components"
```

---

## Task 6: Avatar + EmptyState

**Files:**
- Create: `mobile/src/ui/Avatar.tsx`
- Create: `mobile/src/ui/EmptyState.tsx`

- [ ] **Step 1: Avatar**

Create `mobile/src/ui/Avatar.tsx`:
```tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, fontFamily, fontSize } from '@/theme';

interface Props {
  userId: string;
  name?: string;
  uri?: string | null;
  size?: number;
}

const PALETTE: { bg: string; fg: string }[] = [
  { bg: colors.surfaceDark,    fg: colors.brandSecondary },
  { bg: colors.success,        fg: colors.inkInverse },
  { bg: colors.info,           fg: colors.inkInverse },
  { bg: colors.brandSecondary, fg: colors.ink },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name?: string, userId?: string): string {
  const src = (name && name.trim()) || (userId ?? '?');
  return src.replace(/[^A-Za-z가-힣]/g, '').slice(0, 2).toUpperCase() || '?';
}

export function Avatar({ userId, name, uri, size = 28 }: Props) {
  const tone = PALETTE[hash(userId) % PALETTE.length];
  const fontSizeScaled = Math.max(10, Math.round(size * 0.4));
  if (uri) {
    return <Image source={{ uri }} style={[s.box, { width: size, height: size, borderRadius: radius.xs }]} />;
  }
  return (
    <View style={[s.box, { width: size, height: size, borderRadius: radius.xs, backgroundColor: tone.bg }]}>
      <Text style={[s.txt, { color: tone.fg, fontSize: fontSizeScaled }]}>{initials(name, userId)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  txt: { fontFamily: fontFamily.bold, includeFontPadding: false },
});
```

- [ ] **Step 2: EmptyState**

Create `mobile/src/ui/EmptyState.tsx`:
```tsx
import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      {description ? <Text style={s.desc}>{description}</Text> : null}
      {action ? <View style={s.action}>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(8), paddingTop: spacing(20) },
  title: { color: colors.inkInverse, fontFamily: fontFamily.bold, fontSize: fontSize.lg, textAlign: 'center' },
  desc:  { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center', marginTop: spacing(2) },
  action: { marginTop: spacing(6), width: '100%' },
});
```

- [ ] **Step 3: typecheck + Commit**

```powershell
npx tsc --noEmit
git add mobile/src/ui/Avatar.tsx mobile/src/ui/EmptyState.tsx
git commit -m "feat(ui): Avatar (deterministic squircle) + EmptyState"
```

---

## Task 7: TabBarFloating + MainTabs 적용

**Files:**
- Create: `mobile/src/ui/TabBarFloating.tsx`
- Modify: `mobile/src/navigation/MainTabs.tsx`

- [ ] **Step 1: TabBarFloating**

Create `mobile/src/ui/TabBarFloating.tsx`:
```tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, fontFamily, fontSize, spacing, shadows } from '@/theme';

const ICONS: Record<string, string> = {
  Meetups: '📅',
  Groups:  '👥',
  Chats:   '💬',
  Me:      '🙂',
};

const LABELS: Record<string, string> = {
  Meetups: '약속',
  Groups:  '그룹',
  Chats:   '채팅',
  Me:      '나',
};

export function TabBarFloating({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { bottom: Math.max(insets.bottom, 8) + 4 }]}>
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name as any);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={[s.tab, focused && s.tabActive]}>
              <Text style={[s.icon, focused && s.iconActive]}>{ICONS[route.name] ?? '•'}</Text>
              <Text style={[s.label, focused && s.labelActive]}>{LABELS[route.name] ?? route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', left: spacing(3), right: spacing(3),
    ...shadows.floatingTabbar,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    padding: spacing(1.25),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(1.75),
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.brandSecondary },
  icon: { fontSize: 17, color: 'rgba(255,255,255,0.6)' },
  iconActive: { color: colors.ink },
  label: { fontFamily: fontFamily.semibold, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  labelActive: { color: colors.ink },
});
```

- [ ] **Step 2: MainTabs에 적용**

Read current `mobile/src/navigation/MainTabs.tsx` then edit. Replace its contents with:
```tsx
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useInviteStore } from '@/store/inviteStore';
import { MeetupsStack } from './MeetupsStack';
import { GroupsStack } from './GroupsStack';
import { ChatsStack } from './ChatsStack';
import { MeStack } from './MeStack';
import { TabBarFloating } from '@/ui/TabBarFloating';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const nav = useNavigation<any>();
  const consume = useInviteStore((s) => s.consume);
  useEffect(() => {
    const code = consume();
    if (code) nav.navigate('InviteAccept', { code });
  }, []);
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBarFloating {...props} />}
    >
      <Tab.Screen name="Meetups" component={MeetupsStack} />
      <Tab.Screen name="Groups" component={GroupsStack} />
      <Tab.Screen name="Chats" component={ChatsStack} />
      <Tab.Screen name="Me" component={MeStack} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 3: 라이브 검증**

핸드폰 새로고침. 탭바가 다크 캡슐로 보이고 활성 탭에 노랑 칩 표시.

- [ ] **Step 4: Commit**

```powershell
git add mobile/src/ui/TabBarFloating.tsx mobile/src/navigation/MainTabs.tsx
git commit -m "feat(ui): floating dark tabbar with yellow active chip"
```

---

## Task 8: LoginScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/auth/LoginScreen.tsx`

- [ ] **Step 1: 전체 교체**

Replace `mobile/src/screens/auth/LoginScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
      if (result.type !== 'success') { setLoading(null); return; }
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
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.hero}>
        <Text style={s.brand}>MeetPod</Text>
        <Text style={s.tagline}>친구와 약속, 한 곳에서.</Text>
      </View>
      <View style={s.actions}>
        <Button label="Google로 계속하기" onPress={loginWithGoogle} loading={loading === 'google'} />
        <View style={{ height: spacing(2) }} />
        <Button label="Apple로 계속하기 (준비중)" variant="ghostOnOrange" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
        <View style={{ height: spacing(2) }} />
        <Button label="Kakao로 계속하기 (준비중)" variant="ghostOnOrange" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing(6), paddingVertical: spacing(8), justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center' },
  brand: { color: colors.inkInverse, fontFamily: fontFamily.black, fontSize: fontSize['3xl'] + 14 },
  tagline: { color: 'rgba(255,255,255,0.92)', fontFamily: fontFamily.medium, fontSize: fontSize.lg, marginTop: spacing(2) },
  actions: { paddingBottom: spacing(4) },
});
```

- [ ] **Step 2: 라이브 검증**

로그아웃(Me 탭) 후 LoginScreen 진입. 큰 brand 텍스트 + 노랑 단추 확인.

- [ ] **Step 3: Commit**

```powershell
git add mobile/src/screens/auth/LoginScreen.tsx
git commit -m "feat(ui): redesign LoginScreen with theme"
```

---

## Task 9: OnboardingHandleScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/auth/OnboardingHandleScreen.tsx`

- [ ] **Step 1: 전체 교체**

Replace `mobile/src/screens/auth/OnboardingHandleScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
    try { await setHandleAction(handle); }
    catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message;
      Alert.alert('핸들 설정 실패', String(msg));
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={s.title}>핸들을 정해주세요</Text>
        <Text style={s.desc}>친구가 회원님을 식별하는 ID입니다. 이후 변경할 수 없어요.</Text>
        <View style={s.field}>
          <View style={s.atWrap}>
            <Text style={s.at}>@</Text>
            <Input
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="harry"
              maxLength={20}
              style={s.input}
            />
          </View>
        </View>
      </View>
      <Button label="시작하기" onPress={submit} loading={busy} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary, padding: spacing(6) },
  title: { color: colors.inkInverse, fontFamily: fontFamily.black, fontSize: fontSize['3xl'] },
  desc: { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.md, marginTop: spacing(2), marginBottom: spacing(8) },
  field: {},
  atWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 4, paddingLeft: spacing(3) },
  at: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize['2xl'] },
  input: { flex: 1, borderWidth: 0, fontSize: fontSize['2xl'], paddingVertical: spacing(3) },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/auth/OnboardingHandleScreen.tsx
git commit -m "feat(ui): redesign OnboardingHandleScreen"
```

---

## Task 10: MeetupListScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/meetups/MeetupListScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/meetups/MeetupListScreen.tsx`:
```tsx
import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useMeetupsStore } from '@/store/meetupsStore';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { HeaderButton } from '@/ui/HeaderButton';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

function badgeFor(status: string, startsAt: string) {
  if (status === 'cancelled') return { tone: 'cancelled' as const, label: '취소' };
  if (status === 'active') return { tone: 'live' as const, label: '진행중' };
  if (status === 'ended') return { tone: 'ended' as const, label: '종료' };
  const isToday = new Date(startsAt).toDateString() === new Date().toDateString();
  if (isToday) return { tone: 'today' as const, label: '오늘' };
  return null;
}

export function MeetupListScreen() {
  const nav = useNavigation<any>();
  const { ids, byId, loading, refresh } = useMeetupsStore();
  useFocusEffect(useCallback(() => { refresh(false); }, [refresh]));

  const items = ids.map((i) => byId[i]);

  return (
    <ScreenContainer
      hasTabBar
      header={
        <Header
          title="약속"
          subtitle={`${items.length}건 예정`}
          action={<HeaderButton icon="+" onPress={() => nav.navigate('MeetupCreate', {})} />}
        />
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title="예정된 약속이 없어요"
          description="친구와 첫 약속을 만들어보세요."
          action={<Button label="새 약속 만들기" onPress={() => nav.navigate('MeetupCreate', {})} />}
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          data={items}
          keyExtractor={(m) => m.id}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={loading} onRefresh={() => refresh(false)} />}
          renderItem={({ item }) => {
            const b = badgeFor(item.status, item.starts_at);
            return (
              <Card variant="row" onPress={() => nav.navigate('MeetupDetail', { id: item.id })}>
                {b && <View style={{ marginBottom: spacing(1.5) }}><Badge tone={b.tone}>{b.label}</Badge></View>}
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.meta}>📍 {item.place_name} · {new Date(item.starts_at).toLocaleString()}</Text>
              </Card>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  meta:  { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
```

- [ ] **Step 2: 라이브 검증 + Commit**

핸드폰 새로고침. 약속 리스트가 새 디자인으로 렌더링.
```powershell
git add mobile/src/screens/meetups/MeetupListScreen.tsx
git commit -m "feat(ui): redesign MeetupListScreen"
```

---

## Task 11: MeetupDetailScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/meetups/MeetupDetailScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/meetups/MeetupDetailScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { cancelMeetup, getMeetup, listParticipants, type Meetup, type Participant } from '@/api/meetups';
import { listRooms } from '@/api/chat';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Avatar';
import { PlaceCard } from '@/components/PlaceCard';
import { useAuthStore } from '@/store/authStore';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function MeetupDetailScreen() {
  const { id } = (useRoute<any>()).params;
  const nav = useNavigation<any>();
  const me = useAuthStore((s) => s.profile?.id);
  const [m, setM] = useState<Meetup | null>(null);
  const [parts, setParts] = useState<Participant[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    getMeetup(id).then(setM);
    listParticipants(id).then(setParts);
    listRooms().then((rooms) => {
      const r = rooms.find((x) => x.kind === 'meetup' && x.ref_id === id);
      setRoomId(r?.id ?? null);
    });
  }, [id]));

  if (!m) return (
    <ScreenContainer hasTabBar header={<Header title="" back />}>
      <View style={{ padding: spacing(4) }}><Text style={{ color: colors.inkInverse }}>로딩중…</Text></View>
    </ScreenContainer>
  );

  const isCreator = m.creator_id === me;
  const editable = m.status === 'scheduled' && isCreator;

  return (
    <ScreenContainer hasTabBar header={<Header title={m.title} back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}>
        <Card variant="hero">
          <Text style={s.meta}>상태: {m.status}</Text>
          <Text style={s.meta}>{new Date(m.starts_at).toLocaleString()} ~ {new Date(m.ends_at).toLocaleString()}</Text>
          <Text style={s.meta}>위치 공유: {m.location_share_minutes_before}분 전 시작</Text>
          <View style={s.avatars}>
            {parts.map((p) => (
              <View key={p.user_id} style={{ marginRight: spacing(1.5) }}>
                <Avatar userId={p.user_id} name={p.user_id} size={32} />
              </View>
            ))}
          </View>
        </Card>

        <PlaceCard name={m.place_name} lat={m.place_lat} lng={m.place_lng} address={m.place_address ?? undefined} />

        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          {roomId && (
            <>
              <Button label="약속 채팅 열기" variant="primary" onPress={() => nav.navigate('Chats', { screen: 'ChatRoom', params: { id: roomId, kind: 'meetup' } })} />
              <View style={{ height: spacing(2) }} />
            </>
          )}
          {(m.status === 'active' || m.status === 'scheduled') && (
            <>
              <Button label="실시간 위치 보기" variant="ghostOnOrange" onPress={() => nav.navigate('MeetupMap', { id: m.id })} />
              <View style={{ height: spacing(2) }} />
            </>
          )}
          {editable && (
            <Button label="약속 취소" variant="dangerOnSurface" onPress={() =>
              Alert.alert('취소', '정말 취소할까요?', [
                { text: '돌아가기', style: 'cancel' },
                { text: '확인', style: 'destructive', onPress: async () => { const updated = await cancelMeetup(id); setM(updated); } },
              ])} />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  meta: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.base, marginTop: spacing(1) },
  avatars: { flexDirection: 'row', marginTop: spacing(3) },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/meetups/MeetupDetailScreen.tsx
git commit -m "feat(ui): redesign MeetupDetailScreen"
```

---

## Task 12: PlaceCard 토큰 적용

**Files:**
- Modify: `mobile/src/components/PlaceCard.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/components/PlaceCard.tsx`:
```tsx
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
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/components/PlaceCard.tsx
git commit -m "feat(ui): PlaceCard with theme tokens"
```

---

## Task 13: MeetupCreateScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/meetups/MeetupCreateScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/meetups/MeetupCreateScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { createMeetup, type MeetupCreatePayload, type Place } from '@/api/meetups';
import { MemberPicker } from '@/components/MemberPicker';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { usePlacePickStore } from '@/store/placePickStore';
import { scheduleMeetupReminder } from '@/lib/local_notifications';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

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

  useFocusEffect(React.useCallback(() => {
    const p = usePlacePickStore.getState().consume();
    if (p) setPlace({ name: p.name, lat: p.lat, lng: p.lng, address: p.address, google_id: p.google_id });
  }, []));

  function onStartsChange(d: Date) {
    setStarts(d);
    if (ends <= d) setEnds(new Date(d.getTime() + 60 * 60 * 1000));
  }

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
      if (reminder !== null) {
        const notifyAt = new Date(starts.getTime() - reminder * 60_000);
        await scheduleMeetupReminder(m.id, m.title, reminder, notifyAt);
      }
      nav.replace('MeetupDetail', { id: m.id });
    } catch (e: any) {
      Alert.alert('생성 실패', e.response?.data?.detail ?? e.message);
    } finally { setBusy(false); }
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="새 약속" back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}>
        <Card>
          <Text style={s.label}>제목</Text>
          <Input value={title} onChangeText={setTitle} maxLength={120} />
        </Card>

        <Card>
          <Text style={s.label}>시작</Text>
          <Pressable style={s.pickerRow} onPress={() => setShowStartsPicker(true)}>
            <Text style={s.pickerText}>{starts.toLocaleString()}</Text>
          </Pressable>
          {showStartsPicker && (
            <DateTimePicker value={starts} mode="datetime" onChange={(_, d) => { setShowStartsPicker(Platform.OS === 'ios'); if (d) onStartsChange(d); }} />
          )}

          <Text style={[s.label, { marginTop: spacing(3) }]}>종료</Text>
          <Pressable style={s.pickerRow} onPress={() => setShowEndsPicker(true)}>
            <Text style={s.pickerText}>{ends.toLocaleString()}</Text>
          </Pressable>
          {showEndsPicker && (
            <DateTimePicker value={ends} mode="datetime" onChange={(_, d) => { setShowEndsPicker(Platform.OS === 'ios'); if (d) setEnds(d); }} />
          )}
        </Card>

        <Card>
          <Text style={s.label}>장소</Text>
          <Pressable style={s.pickerRow} onPress={() => nav.navigate('PlacePicker')}>
            <Text style={s.pickerText}>{place ? place.name : '장소 선택'}</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={s.label}>위치 공유 시작 (분 전)</Text>
          <View style={s.chips}>
            {SHARE_OPTIONS.map((n) => (
              <Pressable key={n} onPress={() => setShare(n)} style={[s.chip, share === n && s.chipOn]}>
                <Text style={share === n ? s.chipOnText : s.chipText}>{n}분</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={s.label}>내 알림 (분 전, 선택)</Text>
          <View style={s.chips}>
            <Pressable onPress={() => setReminder(null)} style={[s.chip, reminder === null && s.chipOn]}>
              <Text style={reminder === null ? s.chipOnText : s.chipText}>없음</Text>
            </Pressable>
            {REMINDER_OPTIONS.map((n) => (
              <Pressable key={n} onPress={() => setReminder(n)} style={[s.chip, reminder === n && s.chipOn]}>
                <Text style={reminder === n ? s.chipOnText : s.chipText}>{n}분</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={s.label}>{initialGroupId ? '그룹 멤버' : '친구'}</Text>
          <MemberPicker
            mode={initialGroupId ? 'group' : 'friends'}
            groupId={initialGroupId ?? undefined}
            selectedIds={participants}
            onChange={setParticipants}
          />
        </Card>

        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="만들기" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  label: { color: colors.muted, fontFamily: fontFamily.medium, fontSize: fontSize.sm, marginBottom: spacing(1.5) },
  pickerRow: { paddingVertical: spacing(2), borderWidth: 1, borderColor: colors.border, borderRadius: radius.xs, paddingHorizontal: spacing(3) },
  pickerText: { color: colors.ink, fontFamily: fontFamily.regular, fontSize: fontSize.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xs, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5), marginRight: spacing(2), marginBottom: spacing(1.5) },
  chipOn: { backgroundColor: colors.surfaceDark, borderColor: colors.surfaceDark },
  chipText: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  chipOnText: { color: colors.brandSecondary, fontFamily: fontFamily.bold, fontSize: fontSize.sm },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/meetups/MeetupCreateScreen.tsx
git commit -m "feat(ui): redesign MeetupCreateScreen"
```

---

## Task 14: MemberPicker 토큰 적용

**Files:**
- Modify: `mobile/src/components/MemberPicker.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/components/MemberPicker.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { listMembers } from '@/api/groups';
import { listFriends } from '@/api/friendships';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/ui/Avatar';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props {
  mode: 'group' | 'friends';
  groupId?: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

interface Item { id: string; label: string; }

export function MemberPicker({ mode, groupId, selectedIds, onChange }: Props) {
  const me = useAuthStore((s) => s.profile?.id);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      if (mode === 'group' && groupId) {
        const ms = await listMembers(groupId);
        const others = ms.filter((m) => m.user_id !== me).map((m) => ({ id: m.user_id, label: m.user_id }));
        setItems(others);
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

  if (items.length === 0) {
    return <Text style={s.empty}>{mode === 'friends' ? '친구가 없어요' : '다른 멤버가 없어요'}</Text>;
  }
  return (
    <View>
      {items.map((item) => {
        const checked = selectedIds.has(item.id);
        return (
          <Pressable key={item.id} style={s.row} onPress={() => toggle(item.id)}>
            <View style={[s.checkbox, checked && s.checkboxOn]}>
              {checked ? <Text style={s.check}>✓</Text> : null}
            </View>
            <Avatar userId={item.id} name={item.label} size={28} />
            <Text style={s.label}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(2) },
  checkbox: { width: 20, height: 20, borderRadius: radius.xs, borderWidth: 2, borderColor: colors.border, marginRight: spacing(2.5), alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.surfaceDark, borderColor: colors.surfaceDark },
  check: { color: colors.brandSecondary, fontFamily: fontFamily.black, fontSize: 14, lineHeight: 16 },
  label: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.base, marginLeft: spacing(2.5), flex: 1 },
  empty: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, paddingVertical: spacing(4) },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/components/MemberPicker.tsx
git commit -m "feat(ui): MemberPicker with Avatar and theme"
```

---

## Task 15: MeetupMapScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/meetups/MeetupMapScreen.tsx`

- [ ] **Step 1: 헤더와 배너만 토큰화 (지도 위주 화면이라 변화 최소)**

Edit `mobile/src/screens/meetups/MeetupMapScreen.tsx` — banner 영역의 스타일과 wrap을 새 토큰으로:

Replace the existing `return` JSX and `const s = StyleSheet.create` block. Show the full file replacement:
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { getMeetup, type Meetup } from '@/api/meetups';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { shouldTrack } from '@/lib/location_tracker';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Ping { user_id: string; lat: number; lng: number; recorded_at: string; }

export function MeetupMapScreen() {
  const { id } = (useRoute<any>()).params;
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [pings, setPings] = useState<Record<string, Ping>>({});
  const [fgTracking, setFgTracking] = useState(false);
  const tracking = useLocationStore((s) => s.trackingMeetupId);
  const permission = useLocationStore((s) => s.permission);
  const myId = useAuthStore((s) => s.profile?.id);

  useEffect(() => { getMeetup(id).then(setMeetup); }, [id]);

  useEffect(() => {
    if (!meetup || !myId) return;
    if (tracking === id) return;
    if (!shouldTrack(meetup)) return;

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted || cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 10 },
        async (loc) => {
          await supabase.from('location_pings').insert({
            meetup_id: id,
            user_id: myId,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy_m: loc.coords.accuracy ?? null,
            recorded_at: new Date(loc.timestamp).toISOString(),
          });
        },
      );
      if (cancelled) { sub?.remove(); return; }
      setFgTracking(true);
    })();

    return () => { cancelled = true; sub?.remove(); setFgTracking(false); };
  }, [meetup, myId, id, tracking]);

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
      .on('postgres_changes',
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

  if (!meetup) return <SafeAreaView style={s.root}><Text style={s.loading}>로딩중…</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <MapView style={{ flex: 1 }} initialRegion={initialRegion}>
        <Marker coordinate={{ latitude: meetup.place_lat, longitude: meetup.place_lng }} pinColor="green" title={meetup.place_name} />
        {Object.values(pings).map((p) => (
          <Marker key={p.user_id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.user_id} />
        ))}
      </MapView>
      <View style={s.banner}>
        <Text style={s.bannerText}>
          {tracking === id ? '내 위치 공유 중 (백그라운드)'
            : fgTracking ? '내 위치 공유 중 (이 화면 켜있는 동안)'
            : permission === 'denied' ? '위치 권한이 꺼져 있어요 (설정에서 허용 필요)'
            : '약속 시간이 가까워지면 자동으로 공유가 시작돼요'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  loading: { color: colors.inkInverse, padding: spacing(4) },
  banner: {
    position: 'absolute', bottom: 100, left: spacing(3), right: spacing(3),
    backgroundColor: colors.surfaceDark, borderRadius: radius.sm,
    padding: spacing(3),
  },
  bannerText: { color: colors.inkInverse, fontFamily: fontFamily.medium, fontSize: fontSize.sm, textAlign: 'center' },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/meetups/MeetupMapScreen.tsx
git commit -m "feat(ui): MeetupMapScreen banner with theme"
```

---

## Task 16: PlacePickerScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/meetups/PlacePickerScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/meetups/PlacePickerScreen.tsx`:
```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { autocomplete, placeDetails, type LocationBias, type PlaceSuggestion } from '@/lib/places';
import { usePlacePickStore } from '@/store/placePickStore';
import * as Crypto from 'expo-crypto';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Card } from '@/ui/Card';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function PlacePickerScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [bias, setBias] = useState<LocationBias | null>(null);
  const sessionToken = useMemo(() => Crypto.randomUUID(), []);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      let granted = perm.granted;
      if (!granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        granted = req.granted;
      }
      if (!granted) return;
      try {
        const pos = await Location.getLastKnownPositionAsync()
          ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos) setBias({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch (e) {
        console.log('[place] location fetch failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try { setItems(await autocomplete(q, sessionToken, 'ko', bias)); } finally { setBusy(false); }
    }, 250);
  }, [q, sessionToken, bias]);

  async function pick(sg: PlaceSuggestion) {
    const d = await placeDetails(sg.place_id, sessionToken);
    usePlacePickStore.getState().set(d);
    nav.goBack();
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="장소 선택" back />}>
      <View style={{ padding: spacing(3) }}>
        <Input value={q} onChangeText={setQ} placeholder="장소 검색" autoFocus />
      </View>
      {busy && <ActivityIndicator color={colors.inkInverse} />}
      <FlatList
        data={items}
        keyExtractor={(p) => p.place_id}
        contentContainerStyle={{ paddingBottom: TABBAR_RESERVED_HEIGHT }}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => pick(item)}>
            <Text style={s.desc}>{item.description}</Text>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  desc: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.md },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/meetups/PlacePickerScreen.tsx
git commit -m "feat(ui): redesign PlacePickerScreen"
```

---

## Task 17: GroupListScreen + GroupDetailScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/groups/GroupListScreen.tsx`
- Modify: `mobile/src/screens/groups/GroupDetailScreen.tsx`

- [ ] **Step 1: GroupListScreen 교체**

Replace `mobile/src/screens/groups/GroupListScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { listGroups, type Group } from '@/api/groups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { HeaderButton } from '@/ui/HeaderButton';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
    <ScreenContainer
      hasTabBar
      header={<Header title="그룹" subtitle={`${items.length}개`} action={<HeaderButton icon="+" onPress={() => nav.navigate('GroupCreate')} />} />}
    >
      {items.length === 0 ? (
        <EmptyState
          title="그룹이 없어요"
          description="친구와 자주 만나는 모임을 그룹으로 만들어보세요."
          action={<Button label="그룹 만들기" onPress={() => nav.navigate('GroupCreate')} />}
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          data={items}
          keyExtractor={(g) => g.id}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={refreshing} onRefresh={load} />}
          renderItem={({ item }) => (
            <Card variant="row" onPress={() => nav.navigate('GroupDetail', { id: item.id })}>
              <Text style={s.name}>{item.name}</Text>
              {item.description ? <Text style={s.sub}>{item.description}</Text> : null}
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  name: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  sub: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
```

- [ ] **Step 2: GroupDetailScreen 교체**

Replace `mobile/src/screens/groups/GroupDetailScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { Text, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { getGroup, type Group } from '@/api/groups';
import { listRooms } from '@/api/chat';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function GroupDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params;
  const [g, setG] = useState<Group | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    getGroup(id).then(setG);
    listRooms().then((rooms) => {
      const r = rooms.find((x) => x.kind === 'group' && x.ref_id === id);
      setRoomId(r?.id ?? null);
    });
  }, [id]));

  if (!g) return (
    <ScreenContainer hasTabBar header={<Header title="" back />}>
      <Text style={s.loading}>로딩중…</Text>
    </ScreenContainer>
  );

  return (
    <ScreenContainer hasTabBar header={<Header title={g.name} back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}>
        {g.description ? (
          <Card><Text style={s.desc}>{g.description}</Text></Card>
        ) : null}

        <Card>
          <Pressable style={s.row} onPress={() => nav.navigate('GroupMembers', { id: g.id })}><Text style={s.rowLabel}>멤버</Text><Text style={s.chev}>›</Text></Pressable>
          <View style={s.divider} />
          <Pressable style={s.row} onPress={() => nav.navigate('GroupInvite', { id: g.id })}><Text style={s.rowLabel}>초대 링크 만들기</Text><Text style={s.chev}>›</Text></Pressable>
          {roomId && (
            <>
              <View style={s.divider} />
              <Pressable style={s.row} onPress={() => nav.navigate('Chats', { screen: 'ChatRoom', params: { id: roomId, kind: 'group' } })}>
                <Text style={s.rowLabel}>그룹 채팅 열기</Text><Text style={s.chev}>›</Text>
              </Pressable>
            </>
          )}
        </Card>

        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="이 그룹으로 약속 만들기" onPress={() => nav.navigate('Meetups', { screen: 'MeetupCreate', params: { group_id: g.id } })} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  loading: { color: colors.inkInverse, padding: spacing(4) },
  desc: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.base },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(2.5) },
  rowLabel: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.md },
  chev: { color: colors.mutedLight, fontSize: fontSize.lg },
  divider: { height: 1, backgroundColor: colors.border },
});
```

- [ ] **Step 3: Commit**

```powershell
git add mobile/src/screens/groups/GroupListScreen.tsx mobile/src/screens/groups/GroupDetailScreen.tsx
git commit -m "feat(ui): redesign GroupList + GroupDetail"
```

---

## Task 18: GroupMembersScreen + GroupInviteScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/groups/GroupMembersScreen.tsx`
- Modify: `mobile/src/screens/groups/GroupInviteScreen.tsx`

- [ ] **Step 1: GroupMembersScreen 교체**

Replace `mobile/src/screens/groups/GroupMembersScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { listMembers, kickMember, setMemberRole, type GroupMember } from '@/api/groups';
import { useAuthStore } from '@/store/authStore';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
    <ScreenContainer hasTabBar header={<Header title="멤버" subtitle={`${items.length}명`} back />}>
      <FlatList
        data={items}
        keyExtractor={(m) => m.user_id}
        contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => actions(item)}>
            <View style={s.row}>
              <Avatar userId={item.user_id} name={item.user_id} size={36} />
              <View style={{ flex: 1, marginLeft: spacing(3) }}>
                <Text style={s.id}>{item.user_id}</Text>
              </View>
              <Badge tone={item.role === 'owner' ? 'today' : 'neutral'}>{item.role}</Badge>
            </View>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  id: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
```

- [ ] **Step 2: GroupInviteScreen 교체**

Replace `mobile/src/screens/groups/GroupInviteScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useRoute } from '@react-navigation/native';
import { createInvite, type Invite } from '@/api/invites';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

function inviteUrl(code: string) { return `meetpod://invite/${code}`; }

export function GroupInviteScreen() {
  const { id } = (useRoute<any>()).params;
  const [inv, setInv] = useState<Invite | null>(null);
  useEffect(() => { createInvite('group', id).then(setInv).catch((e) => Alert.alert('실패', e.message)); }, [id]);

  if (!inv) return (
    <ScreenContainer hasTabBar header={<Header title="초대" back />}>
      <Text style={s.loading}>발급 중…</Text>
    </ScreenContainer>
  );
  const url = inviteUrl(inv.code);

  return (
    <ScreenContainer hasTabBar header={<Header title="초대" back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(4), paddingBottom: TABBAR_RESERVED_HEIGHT, alignItems: 'center' }}>
        <Card style={{ alignItems: 'center', paddingVertical: spacing(5) }}>
          <Text style={s.code}>{inv.code}</Text>
          <View style={{ marginTop: spacing(4) }}>
            <QRCode value={url} size={200} />
          </View>
          <Text style={s.meta}>만료: {new Date(inv.expires_at).toLocaleString()}</Text>
          <Text style={s.meta}>잔여: {inv.max_uses - inv.used_count}회</Text>
        </Card>

        <View style={{ width: '100%', paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="링크 복사" onPress={async () => { await Clipboard.setStringAsync(url); Alert.alert('복사됨'); }} />
          <View style={{ height: spacing(2) }} />
          <Button label="공유" variant="ghostOnOrange" onPress={() => Share.share({ message: `MeetPod 그룹 초대: ${url}` })} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  loading: { color: colors.inkInverse, padding: spacing(4) },
  code: { color: colors.ink, fontFamily: fontFamily.black, fontSize: 32, letterSpacing: 4 },
  meta: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
```

- [ ] **Step 3: Commit**

```powershell
git add mobile/src/screens/groups/GroupMembersScreen.tsx mobile/src/screens/groups/GroupInviteScreen.tsx
git commit -m "feat(ui): redesign GroupMembers + GroupInvite"
```

---

## Task 19: GroupCreateScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/groups/GroupCreateScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/groups/GroupCreateScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { Text, View, Alert, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createGroup } from '@/api/groups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
    } catch (e: any) { Alert.alert('생성 실패', e.message); }
    finally { setBusy(false); }
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="그룹 만들기" back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}>
        <Card>
          <Text style={s.label}>그룹 이름</Text>
          <Input value={name} onChangeText={setName} maxLength={80} placeholder="예: 동기 모임" />
        </Card>
        <Card>
          <Text style={s.label}>설명 (선택)</Text>
          <Input value={desc} onChangeText={setDesc} multiline placeholder="간단한 그룹 소개" />
        </Card>
        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="만들기" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  label: { color: colors.muted, fontFamily: fontFamily.medium, fontSize: fontSize.sm, marginBottom: spacing(1.5) },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/groups/GroupCreateScreen.tsx
git commit -m "feat(ui): redesign GroupCreateScreen"
```

---

## Task 20: ChatListScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/chats/ChatListScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/chats/ChatListScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useChatStore } from '@/store/chatStore';
import { listGroups, type Group } from '@/api/groups';
import { listMeetups, type Meetup } from '@/api/meetups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Avatar } from '@/ui/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function ChatListScreen() {
  const nav = useNavigation<any>();
  const rooms = useChatStore((s) => s.rooms);
  const refresh = useChatStore((s) => s.refreshRooms);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [meetups, setMeetups] = useState<Record<string, Meetup>>({});

  const load = useCallback(async () => {
    await refresh();
    const [gs, ms] = await Promise.all([listGroups(), listMeetups(true)]);
    setGroups(Object.fromEntries(gs.map((g) => [g.id, g])));
    setMeetups(Object.fromEntries(ms.map((m) => [m.id, m])));
  }, [refresh]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function labelFor(kind: 'group' | 'meetup', ref_id: string) {
    if (kind === 'group') {
      const g = groups[ref_id];
      return { title: g?.name ?? '그룹 채팅', sub: '그룹' };
    }
    const m = meetups[ref_id];
    return { title: m?.title ?? '약속 채팅', sub: m ? `약속 · ${new Date(m.starts_at).toLocaleDateString()}` : '약속' };
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="채팅" subtitle={`${rooms.length}개`} />}>
      {rooms.length === 0 ? (
        <EmptyState title="채팅방이 없어요" description="그룹·약속을 만들면 자동으로 채팅방이 생겨요." />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={false} onRefresh={load} />}
          renderItem={({ item }) => {
            const { title, sub } = labelFor(item.kind, item.ref_id);
            return (
              <Card variant="row" onPress={() => nav.navigate('ChatRoom', { id: item.id, kind: item.kind })}>
                <View style={s.row}>
                  <Avatar userId={item.id} name={title} size={40} />
                  <View style={{ marginLeft: spacing(3), flex: 1 }}>
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.sub}>{sub}{item.archived_at ? ' · 아카이브됨' : ''}</Text>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  sub: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(0.5) },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/chats/ChatListScreen.tsx
git commit -m "feat(ui): redesign ChatListScreen"
```

---

## Task 21: MessageBubble 토큰 적용

**Files:**
- Modify: `mobile/src/components/MessageBubble.tsx`

- [ ] **Step 1: 색상 상수 → 토큰으로 교체**

Edit `mobile/src/components/MessageBubble.tsx` — `StyleSheet.create` 블록을 다음으로 교체:
```tsx
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

// ... (위쪽 컴포넌트는 그대로 유지)

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
```

Also update JSX text className references: `textMine` → use semibold weight, `textTheirs` → regular. The existing rendering uses `mine ? s.textMine : s.textTheirs` so the styles change is sufficient.

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/components/MessageBubble.tsx
git commit -m "feat(ui): MessageBubble with theme tokens"
```

---

## Task 22: ChatRoomScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/chats/ChatRoomScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/chats/ChatRoomScreen.tsx`:
```tsx
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

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
    const objectKey = `${roomId}/${Date.now()}.${ext}`;
    const contentType = asset.mimeType ?? `image/${ext}`;
    try {
      const ab = await (await fetch(asset.uri)).arrayBuffer();
      const { error } = await supabase.storage.from('chat-images').upload(objectKey, ab, { contentType, upsert: false });
      if (error) throw error;
      await sendImage(roomId, `chat-images/${objectKey}`);
    } catch (e: any) {
      Alert.alert('업로드 실패', e.message ?? String(e));
    }
  }

  return (
    <ScreenContainer header={<Header title="대화" back />}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble msg={item} mine={item.sender_id === me} />}
          ListEmptyComponent={<Text style={s.empty}>첫 메시지를 보내보세요</Text>}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: spacing(2) }}
        />
        <View style={s.inputRow}>
          <Pressable style={s.iconBtn} onPress={pickAndSendImage}><Text style={s.iconTxt}>🖼</Text></Pressable>
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
  iconTxt: { fontSize: 20 },
  textInput: { flex: 1, marginRight: spacing(2), maxHeight: 100 },
  sendBtn: { backgroundColor: colors.brandSecondary, borderRadius: radius.xs, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5) },
  sendTxt: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.sm },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/chats/ChatRoomScreen.tsx
git commit -m "feat(ui): redesign ChatRoomScreen"
```

---

## Task 23: Friends 화면들 리디자인

**Files:**
- Modify: `mobile/src/screens/friends/FriendListScreen.tsx`
- Modify: `mobile/src/screens/friends/FriendInviteScreen.tsx`

- [ ] **Step 1: FriendListScreen 교체**

Replace `mobile/src/screens/friends/FriendListScreen.tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listFriends, type FriendSummary } from '@/api/friendships';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Avatar } from '@/ui/Avatar';
import { EmptyState } from '@/ui/EmptyState';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function FriendListScreen() {
  const [items, setItems] = useState<FriendSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setRefreshing(true); try { setItems(await listFriends()); } finally { setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScreenContainer hasTabBar header={<Header title="친구" subtitle={`${items.length}명`} back />}>
      {items.length === 0 ? (
        <EmptyState title="친구가 없어요" description="초대 링크를 보내 친구를 추가하세요." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
          refreshControl={<RefreshControl tintColor={colors.inkInverse} refreshing={refreshing} onRefresh={load} />}
          renderItem={({ item }) => (
            <Card variant="row">
              <View style={s.row}>
                <Avatar userId={item.id} name={item.display_name} uri={item.avatar_url} size={40} />
                <View style={{ marginLeft: spacing(3), flex: 1 }}>
                  <Text style={s.name}>{item.display_name}</Text>
                  {item.handle ? <Text style={s.handle}>@{item.handle}</Text> : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.md },
  handle: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(0.5) },
});
```

- [ ] **Step 2: FriendInviteScreen 교체**

Replace `mobile/src/screens/friends/FriendInviteScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Share, Alert, ScrollView, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { createInvite, type Invite } from '@/api/invites';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function FriendInviteScreen() {
  const [inv, setInv] = useState<Invite | null>(null);
  useEffect(() => { createInvite('friend').then(setInv).catch((e) => Alert.alert('실패', e.message)); }, []);

  if (!inv) return (
    <ScreenContainer hasTabBar header={<Header title="친구 초대" back />}>
      <Text style={s.loading}>발급 중…</Text>
    </ScreenContainer>
  );
  const url = `meetpod://invite/${inv.code}`;

  return (
    <ScreenContainer hasTabBar header={<Header title="친구 초대" back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(4), paddingBottom: TABBAR_RESERVED_HEIGHT, alignItems: 'center' }}>
        <Card style={{ alignItems: 'center', paddingVertical: spacing(5) }}>
          <Text style={s.code}>{inv.code}</Text>
          <View style={{ marginTop: spacing(4) }}>
            <QRCode value={url} size={200} />
          </View>
          <Text style={s.meta}>만료: {new Date(inv.expires_at).toLocaleString()}</Text>
        </Card>

        <View style={{ width: '100%', paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="링크 복사" onPress={async () => { await Clipboard.setStringAsync(url); Alert.alert('복사됨'); }} />
          <View style={{ height: spacing(2) }} />
          <Button label="공유" variant="ghostOnOrange" onPress={() => Share.share({ message: `MeetPod 친구 초대: ${url}` })} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  loading: { color: colors.inkInverse, padding: spacing(4) },
  code: { color: colors.ink, fontFamily: fontFamily.black, fontSize: 32, letterSpacing: 4 },
  meta: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing(1) },
});
```

- [ ] **Step 3: Commit**

```powershell
git add mobile/src/screens/friends/FriendListScreen.tsx mobile/src/screens/friends/FriendInviteScreen.tsx
git commit -m "feat(ui): redesign Friends screens"
```

---

## Task 24: InviteAcceptScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/invites/InviteAcceptScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/invites/InviteAcceptScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { acceptInvite, type AcceptResult } from '@/api/invites';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function InviteAcceptScreen() {
  const nav = useNavigation<any>();
  const code = (useRoute<any>()).params.code as string;
  const [state, setState] = useState<{ status: 'pending' | 'done' | 'error', result?: AcceptResult, error?: string }>({ status: 'pending' });

  useEffect(() => {
    acceptInvite(code)
      .then((r) => setState({ status: 'done', result: r }))
      .catch((e) => setState({ status: 'error', error: e.response?.data?.detail ?? e.message }));
  }, [code]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Card style={{ alignItems: 'center', paddingVertical: spacing(6) }}>
          {state.status === 'pending' ? (
            <>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
              <Text style={s.label}>초대 처리 중…</Text>
            </>
          ) : state.status === 'error' ? (
            <>
              <Text style={s.title}>초대를 사용할 수 없어요</Text>
              <Text style={s.sub}>{state.error}</Text>
            </>
          ) : (
            <Text style={s.title}>{state.result!.kind === 'friend' ? '친구가 추가됐어요' : '그룹에 참여했어요'}</Text>
          )}
        </Card>
      </View>
      {state.status !== 'pending' && (
        <View style={{ padding: spacing(3) }}>
          <Button label={state.result?.kind === 'group' ? '그룹 보기' : '확인'} onPress={() => {
            const r = state.result;
            if (r?.kind === 'group' && r.group_id) {
              nav.replace('MainTabs', { screen: 'Groups', params: { screen: 'GroupDetail', params: { id: r.group_id } } });
            } else {
              nav.replace('MainTabs');
            }
          }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing(2) },
  label: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.md, marginTop: spacing(3) },
  title: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.lg, textAlign: 'center' },
  sub: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing(2) },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/invites/InviteAcceptScreen.tsx
git commit -m "feat(ui): redesign InviteAcceptScreen"
```

---

## Task 25: MeScreen 리디자인

**Files:**
- Modify: `mobile/src/screens/me/MeScreen.tsx`

- [ ] **Step 1: 교체**

Replace `mobile/src/screens/me/MeScreen.tsx`:
```tsx
import React from 'react';
import { Text, View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function MeScreen() {
  const nav = useNavigation<any>();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <ScreenContainer hasTabBar header={<Header title="내 정보" />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}>
        <Card variant="hero">
          <View style={s.heroRow}>
            <Avatar userId={profile?.id ?? '?'} name={profile?.display_name} uri={profile?.avatar_url ?? undefined} size={64} />
            <View style={{ marginLeft: spacing(3), flex: 1 }}>
              <Text style={s.name}>{profile?.display_name}</Text>
              <Text style={s.handle}>@{profile?.handle}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Pressable style={s.row} onPress={() => nav.navigate('FriendList')}><Text style={s.rowLabel}>친구 목록</Text><Text style={s.chev}>›</Text></Pressable>
          <View style={s.divider} />
          <Pressable style={s.row} onPress={() => nav.navigate('FriendInvite')}><Text style={s.rowLabel}>친구 초대</Text><Text style={s.chev}>›</Text></Pressable>
        </Card>

        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="로그아웃" variant="ghostOnOrange" onPress={signOut} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.ink, fontFamily: fontFamily.black, fontSize: fontSize.xl },
  handle: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.md, marginTop: spacing(0.5) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(2.5) },
  rowLabel: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.md },
  chev: { color: colors.mutedLight, fontSize: fontSize.lg },
  divider: { height: 1, backgroundColor: colors.border },
});
```

- [ ] **Step 2: Commit**

```powershell
git add mobile/src/screens/me/MeScreen.tsx
git commit -m "feat(ui): redesign MeScreen"
```

---

## Task 26: 종합 검증

**Files:** (변경 없음)

- [ ] **Step 1: typecheck**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 2: jest (authStore 회귀)**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npm test -- authStore 2>&1 | Select-Object -Last 5
```
Expected: 3 tests passed.

- [ ] **Step 3: Expo 리로드 + 핸드폰 종합 검증**

기존 Metro 종료 후 다시 시작:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
npx expo start --tunnel --clear
```

핸드폰에서 새 tunnel URL로 재진입. 다음 화면 모두 새 디자인으로 렌더링되는지 확인:
- LoginScreen (로그아웃 후)
- OnboardingHandle (다른 계정으로 재진입 시)
- MeetupList, MeetupDetail, MeetupCreate, MeetupMap, PlacePicker
- GroupList, GroupCreate, GroupDetail, GroupMembers, GroupInvite
- ChatList, ChatRoom (텍스트/이미지/장소 메시지 거품 색 확인)
- FriendList, FriendInvite
- InviteAccept
- MeScreen
- 모든 화면 하단에 다크 캡슐 탭바 보임

- [ ] **Step 4: 마무리 빈 commit**

```powershell
cd d:\Workspace\CPKWorks\MeetPod
git commit --allow-empty -m "chore(ui): full theme migration verified"
```

---

## Self-Review Notes

스펙 §2 디자인 토큰 → Task 1, 2 ✓
스펙 §3.1 ScreenContainer → Task 3 ✓
스펙 §3.2 Header → Task 3 ✓
스펙 §3.3 Card → Task 4 ✓
스펙 §3.4 Button → Task 5 ✓
스펙 §3.5 Badge → Task 4 ✓
스펙 §3.6 MessageBubble → Task 21 ✓
스펙 §3.7 TabBar → Task 7 ✓
스펙 §3.8 Avatar → Task 6 ✓
스펙 §3.9 Input → Task 5 ✓
스펙 §3.10 PlaceCard → Task 12 ✓
스펙 §4 각 화면 적용 → Task 8-25 ✓

**의도적 deferral (Phase 2):**
- 다크모드
- 애니메이션 (탭 전환 모션)
- 일러스트/마스코트
- 메시지 그룹 묶음 (연속 메시지 라운드 작게)
- 채팅방 위치공유 시작 안내 배너

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-ui-design-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**
