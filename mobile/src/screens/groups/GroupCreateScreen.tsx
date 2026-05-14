import React, { useState } from 'react';
import { Text, View, Alert, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createGroup } from '@/api/groups';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
    } catch (e: any) { Alert.alert('생성 실패', e.message); }
    finally { setBusy(false); }
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="그룹 만들기" back />}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}>
        <Card>
          <Text style={s.label}>그룹 이름</Text>
          <Input value={name} onChangeText={setName} maxLength={80} placeholder="예: 동기 모임" />
        </Card>
        <Card>
          <Text style={s.label}>설명 (선택)</Text>
          <Input value={desc} onChangeText={setDesc} multiline placeholder="간단한 그룹 소개" />
        </Card>
        <View style={{ paddingHorizontal: spacing(3), marginTop: spacing(2) }}>
          <Button label="만들기" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  label: { color: colors.muted, fontFamily: fontFamily.medium, fontSize: fontSize.sm, marginBottom: spacing(1.5) },
});
