import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, fontFamily } from '@/theme';

type Tone = 'today' | 'live' | 'ended' | 'cancelled' | 'neutral' | 'pending';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  today:     { bg: colors.brandSecondary, fg: colors.ink },
  live:      { bg: colors.success,        fg: colors.inkInverse },
  ended:     { bg: colors.mutedLight,     fg: colors.inkInverse },
  cancelled: { bg: colors.danger,         fg: colors.inkInverse },
  neutral:   { bg: colors.surfaceSubtle,  fg: colors.ink },
  pending:   { bg: colors.warning,        fg: colors.inkInverse },
};

interface Props {
  tone?: Tone;
  children: string;
}

export function Badge({ tone = 'neutral', children }: Props) {
  const t = TONES[tone];
  return (
    <View style={[s.box, { backgroundColor: t.bg }]}>
      <Text style={[s.text, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(1.75),
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  text: { fontFamily: fontFamily.bold, fontSize: 10, letterSpacing: 0.3 },
});
