import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

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
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
        preferEphemeralSession: true,
      });
      if (result.type !== 'success') { setLoading(null); return; }

      let session;
      if (result.url.includes('code=')) {
        // PKCE flow (supabase-js v2 default)
        const code = new URL(result.url).searchParams.get('code');
        if (!code) throw new Error('missing code in callback');
        const { data: d, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !d.session) throw error ?? new Error('failed to exchange code');
        session = d.session;
      } else {
        // Implicit flow fallback
        const url = new URL(result.url.replace('#', '?'));
        const access_token = url.searchParams.get('access_token');
        const refresh_token = url.searchParams.get('refresh_token');
        if (!access_token || !refresh_token) throw new Error('missing tokens in callback');
        const { data: d, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !d.session) throw error ?? new Error('failed to set session');
        session = d.session;
      }
      await hydrate(session);
    } catch (e: any) {
      const detail = e.response?.data?.detail ?? e.response?.data ?? '';
      Alert.alert('로그인 실패', `${e.message ?? String(e)}\n${detail}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.hero}>
        <Text style={s.brand}>MeetPod</Text>
        <Text style={s.tagline}>친구와 약속, 한 곳에서.</Text>
      </View>
      <View style={s.actions}>
        <Button label="Google로 계속하기" onPress={loginWithGoogle} loading={loading === 'google'} />
        <View style={{ height: spacing(2) }} />
        <Button label="Apple로 계속하기 (준비중)" variant="ghostOnOrange" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
        <View style={{ height: spacing(2) }} />
        <Button label="Kakao로 계속하기 (준비중)" variant="ghostOnOrange" onPress={() => Alert.alert('곧 지원 예정입니다')} disabled />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing(6), paddingVertical: spacing(8), justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center' },
  brand: { color: colors.inkInverse, fontFamily: fontFamily.black, fontSize: fontSize['3xl'] + 14 },
  tagline: { color: 'rgba(255,255,255,0.92)', fontFamily: fontFamily.medium, fontSize: fontSize.lg, marginTop: spacing(2) },
  actions: { paddingBottom: spacing(4) },
});
