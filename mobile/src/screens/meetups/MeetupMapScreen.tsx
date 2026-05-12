import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { getMeetup, type Meetup } from '@/api/meetups';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { shouldTrack } from '@/lib/location_tracker';

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

  // 백그라운드 권한이 없으면 포그라운드 watchPosition로 fallback
  useEffect(() => {
    if (!meetup || !myId) return;
    if (tracking === id) return;                  // 이미 백그라운드 트래킹 중
    if (!shouldTrack(meetup)) return;             // 윈도우 밖

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
          {tracking === id ? '내 위치 공유 중 (백그라운드)'
            : fgTracking ? '내 위치 공유 중 (이 화면 켜있는 동안)'
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
