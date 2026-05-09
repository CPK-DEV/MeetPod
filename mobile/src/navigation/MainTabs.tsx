import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { MeetupsStack } from './MeetupsStack';
import { GroupsStack } from './GroupsStack';
import { ChatsStack } from './ChatsStack';
import { MeStack } from './MeStack';
import { useInviteStore } from '@/store/inviteStore';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const nav = useNavigation<any>();
  const consume = useInviteStore((s) => s.consume);
  useEffect(() => {
    const code = consume();
    if (code) nav.navigate('InviteAccept', { code });
  }, []);
  return (
    <Tab.Navigator>
      <Tab.Screen name="Meetups" component={MeetupsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Groups" component={GroupsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Chats" component={ChatsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Me" component={MeStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
