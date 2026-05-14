import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useInviteStore } from '@/store/inviteStore';
import { MeetupsStack } from './MeetupsStack';
import { GroupsStack } from './GroupsStack';
import { ChatsStack } from './ChatsStack';
import { MeStack } from './MeStack';
import { TabBarFloating } from '@/ui/TabBarFloating';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const nav = useNavigation<any>();
  const consume = useInviteStore((s) => s.consume);
  useEffect(() => {
    const code = consume();
    if (code) nav.navigate('InviteAccept', { code });
  }, []);
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBarFloating {...props} />}
    >
      <Tab.Screen name="Meetups" component={MeetupsStack} />
      <Tab.Screen name="Groups" component={GroupsStack} />
      <Tab.Screen name="Chats" component={ChatsStack} />
      <Tab.Screen name="Me" component={MeStack} />
    </Tab.Navigator>
  );
}
