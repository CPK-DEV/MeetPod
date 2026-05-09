import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MeetupListScreen } from '@/screens/meetups/MeetupListScreen';
import { MeetupCreateScreen } from '@/screens/meetups/MeetupCreateScreen';
import { MeetupDetailScreen } from '@/screens/meetups/MeetupDetailScreen';
import { PlacePickerScreen } from '@/screens/meetups/PlacePickerScreen';
import { MeetupMapScreen } from '@/screens/meetups/MeetupMapScreen';

const S = createNativeStackNavigator();

export function MeetupsStack() {
  return (
    <S.Navigator>
      <S.Screen name="MeetupList" component={MeetupListScreen} options={{ title: '약속' }} />
      <S.Screen name="MeetupCreate" component={MeetupCreateScreen} options={{ title: '새 약속' }} />
      <S.Screen name="MeetupDetail" component={MeetupDetailScreen} options={{ title: '' }} />
      <S.Screen name="PlacePicker" component={PlacePickerScreen} options={{ title: '장소 선택' }} />
      <S.Screen name="MeetupMap" component={MeetupMapScreen} options={{ title: '실시간 위치' }} />
    </S.Navigator>
  );
}
