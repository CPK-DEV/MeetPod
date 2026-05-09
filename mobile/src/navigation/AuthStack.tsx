import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OnboardingHandleScreen } from '@/screens/auth/OnboardingHandleScreen';
import { useAuthStore } from '@/store/authStore';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  const status = useAuthStore((s) => s.status);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'needsHandle' ? (
        <Stack.Screen name="Onboarding" component={OnboardingHandleScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
