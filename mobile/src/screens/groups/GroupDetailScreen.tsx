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
