import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createGroup } from '@/api/groups';
import { PrimaryButton } from '@/components/PrimaryButton';

export function GroupCreateScreen() {
  const nav = useNavigation<any>();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) { Alert.alert('이름을 입력하세요'); return; }
    setBusy(true);
    try {
      const g = await createGroup(name.trim(), desc.trim() || undefined);
      nav.replace('GroupDetail', { id: g.id });
    } catch (e: any) {
      Alert.alert('생성 실패', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <TextInput style={s.input} placeholder="그룹 이름" value={name} onChangeText={setName} maxLength={80} />
      <TextInput style={[s.input, { height: 100 }]} placeholder="설명 (선택)" value={desc} onChangeText={setDesc} multiline />
      <PrimaryButton label="만들기" onPress={submit} loading={busy} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex:1, padding: 16, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
});
