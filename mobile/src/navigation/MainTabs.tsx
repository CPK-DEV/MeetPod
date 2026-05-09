import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MeetupsPlaceholder } from '@/screens/placeholders/MeetupsPlaceholder';
import { GroupsStack } from './GroupsStack';
import { ChatsPlaceholder } from '@/screens/placeholders/ChatsPlaceholder';
import { MePlaceholder } from '@/screens/placeholders/MePlaceholder';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Meetups" component={MeetupsPlaceholder} />
      <Tab.Screen name="Groups" component={GroupsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Chats" component={ChatsPlaceholder} />
      <Tab.Screen name="Me" component={MePlaceholder} />
    </Tab.Navigator>
  );
}
