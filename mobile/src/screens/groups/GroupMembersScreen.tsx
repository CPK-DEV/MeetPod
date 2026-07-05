import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { listMembers, kickMember, setMemberRole, type GroupMember } from '@/api/groups';
import { useAuthStore } from '@/store/authStore';
import { ScreenContainer, TABBAR_RESERVED_HEIGHT } from '@/ui/ScreenContainer';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function GroupMembersScreen() {
  const { id } = (useRoute<any>()).params;
  const [items, setItems] = useState<GroupMember[]>([]);
  const me = useAuthStore((s) => s.profile?.id);

  const load = useCallback(() => { listMembers(id).then(setItems); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myRole = items.find((m) => m.user_id === me)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  function actions(m: GroupMember) {
    if (!canManage || m.user_id === me) return;
    Alert.alert('멤버 관리', m.handle ?? m.display_name ?? m.user_id, [
      m.role === 'admin'
        ? { text: '일반 멤버로', onPress: async () => { await setMemberRole(id, m.user_id, 'member'); load(); } }
        : { text: '관리자 지정', onPress: async () => { await setMemberRole(id, m.user_id, 'admin'); load(); } },
      { text: '추방', style: 'destructive', onPress: async () => { await kickMember(id, m.user_id); load(); } },
      { text: '취소', style: 'cancel' },
    ]);
  }

  return (
    <ScreenContainer hasTabBar header={<Header title="멤버" subtitle={`${items.length}명`} back />}>
      <FlatList
        data={items}
        keyExtractor={(m) => m.user_id}
        contentContainerStyle={{ paddingTop: spacing(2), paddingBottom: TABBAR_RESERVED_HEIGHT }}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => actions(item)}>
            <View style={s.row}>
              <Avatar userId={item.user_id} name={item.handle ?? item.display_name ?? item.user_id} size={36} />
              <View style={{ flex: 1, marginLeft: spacing(3) }}>
                <Text style={s.id}>{item.handle ?? item.display_name ?? item.user_id}</Text>
              </View>
              <Badge tone={item.role === 'owner' ? 'today' : 'neutral'}>{item.role}</Badge>
            </View>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  id: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
