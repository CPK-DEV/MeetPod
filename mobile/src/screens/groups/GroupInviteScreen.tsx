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
