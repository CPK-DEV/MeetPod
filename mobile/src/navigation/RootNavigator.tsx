import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.initFromStored);
  const hydrate = useAuthStore((s) => s.hydrateAfterAuth);

  useEffect(() => {
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) hydrate(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === 'unknown') {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  return (
    <NavigationContainer>
      {status === 'ready' ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
