import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '@/theme';

interface Props {
  userId: string;
  name?: string;
  uri?: string | null;
  size?: number;
}

const PALETTE: { bg: string; fg: string }[] = [
  { bg: colors.surfaceDark,    fg: colors.brandSecondary },
  { bg: colors.success,        fg: colors.inkInverse },
  { bg: colors.info,           fg: colors.inkInverse },
  { bg: colors.brandSecondary, fg: colors.ink },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name?: string, userId?: string): string {
  const src = (name && name.trim()) || (userId ?? '?');
  const korean = src.match(/[가-힣]/g);
  if (korean && korean.length > 0) return korean.slice(0, 2).join('');
  const latin = src.replace(/[^A-Za-z]/g, '');
  return latin.slice(0, 2).toUpperCase() || '?';
}

export function Avatar({ userId, name, uri, size = 28 }: Props) {
  const tone = PALETTE[hash(userId) % PALETTE.length];
  const fontSizeScaled = Math.max(10, Math.round(size * 0.4));
  if (uri) {
    return <Image source={{ uri }} style={[s.box, { width: size, height: size, borderRadius: radius.xs }]} />;
  }
  return (
    <View style={[s.box, { width: size, height: size, borderRadius: radius.xs, backgroundColor: tone.bg }]}>
      <Text style={[s.txt, { color: tone.fg, fontSize: fontSizeScaled }]}>{initials(name, userId)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  txt: { fontFamily: fontFamily.bold, includeFontPadding: false },
});
