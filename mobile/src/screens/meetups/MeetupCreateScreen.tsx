import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { createMeetup, type MeetupCreatePayload, type Place } from '@/api/meetups';
import { MemberPicker } from '@/components/MemberPicker';
import { PrimaryButton } from '@/components/PrimaryButton';
import { usePlacePickStore } from '@/store/placePickStore';
import { scheduleMeetupReminder } from '@/lib/local_notifications';

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

  useFocusEffect(
    React.useCallback(() => {
      const p = usePlacePickStore.getState().consume();
      if (p) {
        setPlace({ name: p.name, lat: p.lat, lng: p.lng, address: p.address, google_id: p.google_id });
      }
    }, []),
  );

  function onStartsChange(d: Date) {
    setStarts(d);
    // 종료가 시작보다 빠르거나 같으면 1시간 뒤로 자동 보정
    if (ends <= d) {
      setEnds(new Date(d.getTime() + 60 * 60 * 1000));
    }
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
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.label}>제목</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={120} />

      <Text style={s.label}>시작</Text>
      <Pressable style={s.input} onPress={() => setShowStartsPicker(true)}><Text>{starts.toLocaleString()}</Text></Pressable>
      {showStartsPicker && (
        <DateTimePicker value={starts} mode="datetime" onChange={(_, d) => { setShowStartsPicker(Platform.OS === 'ios'); if (d) onStartsChange(d); }} />
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
