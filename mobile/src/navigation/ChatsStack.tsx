import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatListScreen } from '@/screens/chats/ChatListScreen';
import { ChatRoomScreen } from '@/screens/chats/ChatRoomScreen';
import { PlacePickerScreen } from '@/screens/meetups/PlacePickerScreen';

const S = createNativeStackNavigator();

export function ChatsStack() {
  return (
    <S.Navigator>
      <S.Screen name="ChatList" component={ChatListScreen} options={{ title: '채팅' }} />
      <S.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: '대화' }} />
      <S.Screen name="PlacePicker" component={PlacePickerScreen} options={{ title: '장소 공유' }} />
    </S.Navigator>
  );
}
