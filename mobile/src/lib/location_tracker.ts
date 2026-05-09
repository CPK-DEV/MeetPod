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
