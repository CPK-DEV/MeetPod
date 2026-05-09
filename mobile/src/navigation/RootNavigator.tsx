import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { useAuthStore } from '@/store/authStore';
import { useInviteStore } from '@/store/inviteStore';
import { supabase } from '@/lib/supabase';
import { linking, parseInviteCode } from '@/lib/deep_link';
import * as Linking from 'expo-linking';
import { InviteAcceptScreen } from '@/screens/invites/InviteAcceptScreen';

const Root = createNativeStackNavigator();

function MainOrInviteStack() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Screen name="MainTabs" component={MainTabs} />
      <Root.Screen name="InviteAccept" component={InviteAcceptScreen} options={{ presentation: 'modal', headerShown: true, title: '초대' }} />
    </Root.Navigator>
  );
}

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.initFromStored);
  const hydrate = useAuthStore((s) => s.hydrateAfterAuth);
  const setPending = useInviteStore((s) => s.setPending);

  useEffect(() => {
    init();
    const sub = supabase.auth.onAuthStateChange((_e, sess) => { if (sess) hydrate(sess); });
    Linking.getInitialURL().then((u) => { if (u) { const c = parseInviteCode(u); if (c) setPending(c); } });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      const c = parseInviteCode(url);
      if (c) setPending(c);
    });
    return () => { sub.data.subscription.unsubscribe(); linkSub.remove(); };
  }, []);

  if (status === 'unknown') return <View style={{ flex:1, justifyContent:'center' }}><ActivityIndicator /></View>;
  return (
    <NavigationContainer linking={linking}>
      {status === 'ready' ? <MainOrInviteStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
