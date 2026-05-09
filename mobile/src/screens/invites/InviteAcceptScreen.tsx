import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { acceptInvite, type AcceptResult } from '@/api/invites';
import { PrimaryButton } from '@/components/PrimaryButton';

export function InviteAcceptScreen() {
  const nav = useNavigation<any>();
  const code = (useRoute<any>()).params.code as string;
  const [state, setState] = useState<{ status: 'pending'|'done'|'error', result?: AcceptResult, error?: string }>({ status: 'pending' });

  useEffect(() => {
    acceptInvite(code)
      .then((r) => setState({ status: 'done', result: r }))
      .catch((e) => setState({ status: 'error', error: e.response?.data?.detail ?? e.message }));
  }, [code]);

  if (state.status === 'pending') {
    return <View style={s.root}><ActivityIndicator size="large" /><Text style={s.label}>초대 처리 중...</Text></View>;
  }
  if (state.status === 'error') {
    return (
      <View style={s.root}>
        <Text style={s.title}>초대를 사용할 수 없어요</Text>
        <Text style={s.sub}>{state.error}</Text>
        <PrimaryButton label="홈으로" onPress={() => nav.replace('MainTabs')} />
      </View>
    );
  }
  const r = state.result!;
  return (
    <View style={s.root}>
      <Text style={s.title}>{r.kind === 'friend' ? '친구가 추가됐어요' : '그룹에 참여했어요'}</Text>
      <PrimaryButton
        label={r.kind === 'group' ? '그룹 보기' : '확인'}
        onPress={() => {
          if (r.kind === 'group' && r.group_id) {
            nav.replace('MainTabs', { screen: 'Groups', params: { screen: 'GroupDetail', params: { id: r.group_id } } });
          } else {
            nav.replace('MainTabs');
          }
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  sub: { color: '#666', textAlign: 'center', marginBottom: 24 },
  label: { marginTop: 12, color: '#666' },
});
