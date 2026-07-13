import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { getMeetup, listParticipants, type Meetup, type Participant } from '@/api/meetups';
import { listRooms } from '@/api/chat';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { shouldTrack } from '@/lib/location_tracker';
import { colors, fontFamily, fontSize, radius, shadows, spacing } from '@/theme';

interface Ping { user_id: string; lat: number; lng: number; recorded_at: string; }

export function MeetupMapScreen() {
  const nav = useNavigation<any>();
  const { id } = (useRoute<any>()).params;
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pings, setPings] = useState<Record<string, Ping>>({});
  const [fgTracking, setFgTracking] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const tracking = useLocationStore((s) => s.trackingMeetupId);
  const permission = useLocationStore((s) => s.permission);
  const myId = useAuthStore((s) => s.profile?.id);

  useEffect(() => { getMeetup(id).then(setMeetup); }, [id]);
  useEffect(() => { listParticipants(id).then(setParticipants); }, [id]);
  useEffect(() => {
    listRooms().then((rooms) => {
      const r = rooms.find((x) => x.kind === 'meetup' && x.ref_id === id);
      setRoomId(r?.id ?? null);
    });
  }, [id]);

  const nameById = useMemo(() => Object.fromEntries(
    participants.map((p) => [p.user_id, p.handle ?? p.display_name ?? p.user_id]),
  ), [participants]);

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

  if (!meetup) return (
    <SafeAreaView edges={['top']} style={s.root}>
      <View style={s.topRow}>
        <Pressable style={s.roundBtn} onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={s.roundBtnIcon}>‹</Text>
        </Pressable>
      </View>
      <Text style={s.loading}>로딩중…</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <MapView style={{ flex: 1 }} initialRegion={initialRegion}>
        <Marker coordinate={{ latitude: meetup.place_lat, longitude: meetup.place_lng }} pinColor="green" title={meetup.place_name} />
        {Object.values(pings).map((p) => (
          <Marker key={p.user_id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={nameById[p.user_id] ?? p.user_id} />
        ))}
      </MapView>
      <View style={s.topRow}>
        <Pressable style={s.roundBtn} onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={s.roundBtnIcon}>‹</Text>
        </Pressable>
        {roomId && (
          <Pressable
            style={s.roundBtn}
            onPress={() => nav.navigate('Chats', { screen: 'ChatRoom', params: { id: roomId, kind: 'meetup', ref_id: id } })}
            hitSlop={8}
          >
            <Text style={s.roundBtnIcon}>💬</Text>
          </Pressable>
        )}
      </View>
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
  topRow: {
    position: 'absolute', top: spacing(3), left: spacing(3), right: spacing(3),
    flexDirection: 'row', justifyContent: 'space-between',
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceDark, alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  roundBtnIcon: { color: colors.inkInverse, fontSize: 22, fontFamily: fontFamily.regular, lineHeight: 24 },
});
