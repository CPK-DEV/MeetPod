import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GroupListScreen } from '@/screens/groups/GroupListScreen';
import { GroupCreateScreen } from '@/screens/groups/GroupCreateScreen';
import { GroupDetailScreen } from '@/screens/groups/GroupDetailScreen';
import { GroupMembersScreen } from '@/screens/groups/GroupMembersScreen';
import { GroupInviteScreen } from '@/screens/groups/GroupInviteScreen';

const S = createNativeStackNavigator();

export function GroupsStack() {
  return (
    <S.Navigator screenOptions={{ headerShown: false }}>
      <S.Screen name="GroupList" component={GroupListScreen} options={{ title: '그룹' }} />
      <S.Screen name="GroupCreate" component={GroupCreateScreen} options={{ title: '그룹 만들기' }} />
      <S.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: '' }} />
      <S.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: '멤버' }} />
      <S.Screen name="GroupInvite" component={GroupInviteScreen} options={{ title: '초대' }} />
    </S.Navigator>
  );
}
