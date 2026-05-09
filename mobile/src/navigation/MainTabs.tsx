import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MeetupsPlaceholder } from '@/screens/placeholders/MeetupsPlaceholder';
import { GroupsPlaceholder } from '@/screens/placeholders/GroupsPlaceholder';
import { ChatsPlaceholder } from '@/screens/placeholders/ChatsPlaceholder';
import { MePlaceholder } from '@/screens/placeholders/MePlaceholder';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Meetups" component={MeetupsPlaceholder} />
      <Tab.Screen name="Groups" component={GroupsPlaceholder} />
      <Tab.Screen name="Chats" component={ChatsPlaceholder} />
      <Tab.Screen name="Me" component={MePlaceholder} />
    </Tab.Navigator>
  );
}
