import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useRoute } from '@react-navigation/native';
import { createInvite, type Invite } from '@/api/invites';
import { PrimaryButton } from '@/components/PrimaryButton';

function inviteUrl(code: string) { return `meetpod://invite/${code}`; }

export function GroupInviteScreen() {
  const { id } = (useRoute<any>()).params;
  const [inv, setInv] = useState<Invite | null>(null);

  useEffect(() => { createInvite('group', id).then(setInv).catch((e) => Alert.alert('실패', e.message)); }, [id]);

  if (!inv) return <View style={s.root}><Text>발급 중...</Text></View>;
  const url = inviteUrl(inv.code);

  return (
    <View style={s.root}>
      <Text style={s.code}>{inv.code}</Text>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <QRCode value={url} size={200} />
      </View>
      <Text style={s.sub}>만료: {new Date(inv.expires_at).toLocaleString()}</Text>
      <Text style={s.sub}>잔여: {inv.max_uses - inv.used_count}회</Text>
      <View style={{ height: 24 }} />
      <PrimaryButton label="링크 복사" onPress={async () => { await Clipboard.setStringAsync(url); Alert.alert('복사됨'); }} />
      <PrimaryButton label="공유" onPress={() => Share.share({ message: `MeetPod 그룹 초대: ${url}` })} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff' },
  code: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: 4 },
  sub: { color: '#666', textAlign: 'center' },
});
