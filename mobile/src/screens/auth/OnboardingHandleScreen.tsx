import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { PrimaryButton } from '@/components/PrimaryButton';

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
    try {
      await setHandleAction(handle);
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message;
      Alert.alert('핸들 설정 실패', String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>핸들을 정해주세요</Text>
      <Text style={s.sub}>친구가 회원님을 식별하는 ID입니다. 이후 변경할 수 없어요.</Text>
      <View style={s.row}>
        <Text style={s.at}>@</Text>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="harry"
          style={s.input}
          maxLength={20}
        />
      </View>
      <PrimaryButton label="시작하기" onPress={submit} loading={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, color: '#666', marginTop: 8, marginBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 24 },
  at: { fontSize: 22, color: '#888', marginRight: 4 },
  input: { flex: 1, fontSize: 22, paddingVertical: 12 },
});
