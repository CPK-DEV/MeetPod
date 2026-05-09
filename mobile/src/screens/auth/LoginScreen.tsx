import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { PrimaryButton } from '@/components/PrimaryButton';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const [loading, setLoading] = useState<string | null>(null);
  const hydrate = useAuthStore((s) => s.hydrateAfterAuth);

  async function loginWithGoogle() {
    setLoading('google');
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        setLoading(null);
        return;
      }
      // URL fragment의 access_token / refresh_token 추출
      const url = new URL(result.url.replace('#', '?'));
      const access_token = url.searchParams.get('access_token');
      const refresh_token = url.searchParams.get('refresh_token');
      if (!access_token || !refresh_token) throw new Error('missing tokens in callback');

      const { data: sessData, error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setErr || !sessData.session) throw setErr ?? new Error('failed to set session');

      await hydrate(sessData.session);
    } catch (e: any) {
      Alert.alert('로그인 실패', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>MeetPod</Text>
      <Text style={s.sub}>친구와 약속, 한 곳에서.</Text>
      <View style={{ height: 40 }} />
      <PrimaryButton label="Google로 계속하기" onPress={loginWithGoogle} loading={loading === 'google'} />
      <PrimaryButton label="Apple로 계속하기 (준비중)" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
      <PrimaryButton label="Kakao로 계속하기 (준비중)" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 36, fontWeight: '800' },
  sub: { fontSize: 16, color: '#666', marginTop: 8 },
});
