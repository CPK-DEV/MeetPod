import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from '@/api/client';

// 앱 시작 시 한 번 실행 — 포어그라운드에서도 배너+소리 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface ReminderRow {
  meetup_id: string;
  user_id: string;
  minutes_before: number;
  notify_at: string;
}
interface MeetupRow {
  id: string;
  title: string;
  starts_at: string;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    granted = req.granted;
  }
  if (granted && Platform.OS === 'android') {
    // HIGH importance가 있어야 헤드업 알림 + 소리 + 잠금화면 표시
    await Notifications.setNotificationChannelAsync('meetpod-reminders', {
      name: 'MeetPod 약속 알림',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  return granted;
}

/** 미래 시점의 reminder 1건을 로컬 알림으로 등록. */
export async function scheduleMeetupReminder(meetupId: string, title: string, minutesBefore: number, notifyAt: Date): Promise<string | null> {
  if (notifyAt.getTime() <= Date.now()) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const id = await Notifications.scheduleNotificationAsync({
    identifier: `meetup-${meetupId}-${minutesBefore}`,
    content: {
      title,
      body: `${minutesBefore}분 후 시작`,
      data: { meetup_id: meetupId },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyAt,
      channelId: Platform.OS === 'android' ? 'meetpod-reminders' : undefined,
    } as any,
  });
  return id;
}

/** 서버에서 본인의 모든 future reminder를 받아와 OS 알림 큐를 다시 동기화. */
export async function syncAllLocalReminders(): Promise<number> {
  const granted = await ensureNotificationPermission();
  if (!granted) return 0;

  // 1. 모든 본인 미래 약속 가져오기 (포함 ended=false)
  const { data: meetups } = await apiClient.get<MeetupRow[]>('/meetups');
  if (!meetups.length) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return 0;
  }

  // 2. 각 약속의 본인 reminders 조회
  const reminderArrays = await Promise.all(
    meetups.map((m) =>
      apiClient.get<ReminderRow[]>(`/meetups/${m.id}/reminders/me`).then((r) => r.data).catch(() => []),
    ),
  );
  const reminders: { meetup: MeetupRow; r: ReminderRow }[] = [];
  meetups.forEach((m, i) => reminderArrays[i].forEach((r) => reminders.push({ meetup: m, r })));

  // 3. 기존 OS 큐 비우고 미래 reminder만 다시 등록
  await Notifications.cancelAllScheduledNotificationsAsync();
  let scheduled = 0;
  for (const { meetup, r } of reminders) {
    const at = new Date(r.notify_at);
    if (at.getTime() > Date.now()) {
      await scheduleMeetupReminder(meetup.id, meetup.title, r.minutes_before, at);
      scheduled += 1;
    }
  }
  return scheduled;
}
