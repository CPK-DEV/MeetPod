import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MeScreen } from '@/screens/me/MeScreen';
import { FriendListScreen } from '@/screens/friends/FriendListScreen';
import { FriendInviteScreen } from '@/screens/friends/FriendInviteScreen';

const S = createNativeStackNavigator();

export function MeStack() {
  return (
    <S.Navigator>
      <S.Screen name="Me" component={MeScreen} options={{ title: '내 정보' }} />
      <S.Screen name="FriendList" component={FriendListScreen} options={{ title: '친구' }} />
      <S.Screen name="FriendInvite" component={FriendInviteScreen} options={{ title: '친구 초대' }} />
    </S.Navigator>
  );
}
