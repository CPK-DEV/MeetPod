import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

export function OnboardingHandleScreen() {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const setHandleAction = useAuthStore((s) => s.setHandle);

  async function submit() {
    if (!HANDLE_RE.test(handle)) {
      Alert.alert('형식 오류', '영문/숫자/_ 3~20자');
      return;
    }
    setBusy(true);
    try { await setHandleAction(handle); }
    catch (e: any) {
      const detail = e.response?.data?.detail ?? e.message;
      const msg = detail === 'handle taken' ? '이미 존재하는 닉네임입니다.' : String(detail);
      Alert.alert('닉네임 설정 실패', msg);
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={s.title}>닉네임을 정해주세요</Text>
        <Text style={s.desc}>친구가 회원님을 식별하는 ID입니다. 이후 변경할 수 없어요.</Text>
        <View style={s.atWrap}>
          <Text style={s.at}>@</Text>
          <Input
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="harry"
            maxLength={20}
            style={s.input}
          />
        </View>
      </View>
      <Button label="시작하기" onPress={submit} loading={busy} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary, padding: spacing(6) },
  title: { color: colors.inkInverse, fontFamily: fontFamily.black, fontSize: fontSize['3xl'] },
  desc: { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.regular, fontSize: fontSize.md, marginTop: spacing(2), marginBottom: spacing(8) },
  atWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 4, paddingLeft: spacing(3) },
  at: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize['2xl'] },
  input: { flex: 1, borderWidth: 0, fontSize: fontSize['2xl'], paddingVertical: spacing(3) },
});
