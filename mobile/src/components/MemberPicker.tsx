import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { listMembers } from '@/api/groups';
import { listFriends } from '@/api/friendships';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/ui/Avatar';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props {
  mode: 'group' | 'friends';
  groupId?: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

interface Item { id: string; label: string; }

export function MemberPicker({ mode, groupId, selectedIds, onChange }: Props) {
  const me = useAuthStore((s) => s.profile?.id);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      if (mode === 'group' && groupId) {
        const ms = await listMembers(groupId);
        const others = ms.filter((m) => m.user_id !== me)
          .map((m) => ({ id: m.user_id, label: m.handle ? `@${m.handle} (${m.display_name})` : m.display_name ?? m.user_id }));
        setItems(others);
        if (selectedIds.size === 0) onChange(new Set(others.map((o) => o.id)));
      } else {
        const fs = await listFriends();
        setItems(fs.map((f) => ({ id: f.id, label: f.handle ? `@${f.handle} (${f.display_name})` : f.display_name })));
      }
    })();
  }, [mode, groupId, me]);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  if (items.length === 0) {
    return <Text style={s.empty}>{mode === 'friends' ? '친구가 없어요' : '다른 멤버가 없어요'}</Text>;
  }
  return (
    <View>
      {items.map((item) => {
        const checked = selectedIds.has(item.id);
        return (
          <Pressable key={item.id} style={s.row} onPress={() => toggle(item.id)}>
            <View style={[s.checkbox, checked && s.checkboxOn]}>
              {checked ? <Text style={s.check}>✓</Text> : null}
            </View>
            <Avatar userId={item.id} name={item.label} size={28} />
            <Text style={s.label}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(2) },
  checkbox: { width: 20, height: 20, borderRadius: radius.xs, borderWidth: 2, borderColor: colors.border, marginRight: spacing(2.5), alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.surfaceDark, borderColor: colors.surfaceDark },
  check: { color: colors.brandSecondary, fontFamily: fontFamily.black, fontSize: 14, lineHeight: 16 },
  label: { color: colors.ink, fontFamily: fontFamily.medium, fontSize: fontSize.base, marginLeft: spacing(2.5), flex: 1 },
  empty: { color: colors.muted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, paddingVertical: spacing(4) },
});
