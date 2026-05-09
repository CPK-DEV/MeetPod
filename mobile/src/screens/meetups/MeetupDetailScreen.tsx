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
