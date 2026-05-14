import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { acceptInvite, type AcceptResult } from '@/api/invites';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function InviteAcceptScreen() {
  const nav = useNavigation<any>();
  const code = (useRoute<any>()).params.code as string;
  const [state, setState] = useState<{ status: 'pending' | 'done' | 'error', result?: AcceptResult, error?: string }>({ status: 'pending' });

  useEffect(() => {
    acceptInvite(code)
      .then((r) => setState({ status: 'done', result: r }))
      .catch((e) => setState({ status: 'error', error: e.response?.data?.detail ?? e.message }));
  }, [code]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Card style={{ alignItems: 'center', paddingVertical: spacing(6) }}>
          {state.status === 'pending' ? (
            <>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
              <Text style={s.label}>초대 처리 중…</Text>
            </>
          ) : state.status === 'error' ? (
            <>
              <Text style={s.title}>초대를 사용할 수 없어요</Text>
              <Text style={s.sub}>{state.error}</Text>
            </>
          ) : (
            <Text style={s.title}>{state.result!.kind === 'friend' ? '친구가 추가됐어요' : '그룹에 참여했어요'}</Text>
          )}
        </Card>
      </View>
      {state.status !== 'pending' && (
        <View style={{ padding: spacing(3) }}>
          <Button label={state.result?.kind === 'group' ? '그룹 보기' : '확인'} onPress={() => {
            const r = state.result;
            if (r?.kind === 'group' && r.group_id) {
              nav.replace('MainTabs', { screen: 'Groups', params: { screen: 'GroupDetail', params: { id: r.group_id } } });
            } else {
              nav.replace('MainTabs');
            }
          }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing(2) },
  label: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.md, marginTop: spacing(3) },
  title: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: fontSize.lg, textAlign: 'center' },
  sub: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing(2) },
});
