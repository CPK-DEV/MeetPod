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
            <Avatar userId={profile?.id ?? '?'} name={profile?.handle ?? profile?.display_name} uri={profile?.avatar_url ?? undefined} size={64} />
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
