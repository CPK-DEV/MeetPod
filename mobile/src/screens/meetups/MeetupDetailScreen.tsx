import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { cancelMeetup, getMeetup, listParticipants, respondToMeetup, type Meetup, type Participant } from '@/api/meetups';
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
  const [responding, setResponding] = useState(false);

  useFocusEffect(useCallback(() => {
    getMeetup(id).then(setM);
    listParticipants(id).then(setParts);
    listRooms().then((rooms) => {
      const r = rooms.find((x) => x.kind === 'meetup' && x.ref_id === id);
      setRoomId(r?.id ?? null);
    });
  }, [id]));

  async function respond(rsvpStatus: 'going' | 'declined') {
    setResponding(true);
    try {
      await respondToMeetup(id, rsvpStatus);
      listParticipants(id).then(setParts);
    } catch (e: any) {
      Alert.alert('처리 실패', e.response?.data?.detail ?? e.message);
    } finally {
      setResponding(false);
    }
  }

  if (!m) return (
    <ScreenContainer hasTabBar header={<Header title="" back />}>
      <View style={{ padding: spacing(4) }}><Text style={{ color: colors.inkInverse }}>로딩중…</Text></View>
    </ScreenContainer>
  );

  const isCreator = m.creator_id === me;
  const editable = m.status === 'scheduled' && isCreator;
  const myStatus = parts.find((p) => p.user_id === me)?.status;

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
                <Avatar userId={p.user_id} name={p.handle ?? p.display_name ?? p.user_id} size={32} />
              </View>
            ))}
          </View>
        </Card>

        <PlaceCard name={m.place_name} lat={m.place_lat} lng={m.place_lng} address={m.place_address ?? undefined} />

        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          {myStatus === 'pending' && (
            <>
              <View style={s.rsvpRow}>
                <View style={{ flex: 1, marginRight: spacing(2) }}>
                  <Button label="참여하기" onPress={() => respond('going')} loading={responding} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="거절하기" variant="dangerOnSurface" onPress={() => respond('declined')} loading={responding} />
                </View>
              </View>
              <View style={{ height: spacing(2) }} />
            </>
          )}
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
  rsvpRow: { flexDirection: 'row' },
});
