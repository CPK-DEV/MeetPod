import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { listMembers, type GroupMember } from '@/api/groups';
import { listFriends, type FriendSummary } from '@/api/friendships';
import { useAuthStore } from '@/store/authStore';

interface Props {
  mode: 'group' | 'friends';
  groupId?: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function MemberPicker({ mode, groupId, selectedIds, onChange }: Props) {
  const me = useAuthStore((s) => s.profile?.id);
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    (async () => {
      if (mode === 'group' && groupId) {
        const ms = await listMembers(groupId);
        const others = ms.filter((m) => m.user_id !== me).map((m) => ({ id: m.user_id, label: m.user_id }));
        setItems(others);
        // group 약속: 기본 전체 선택
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
            <Text style={s.box}>{checked ? '☑' : '☐'}</Text>
            <Text style={s.label}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  box: { fontSize: 22, marginRight: 12 },
  label: { fontSize: 16 },
  empty: { color: '#999', textAlign: 'center', padding: 24 },
});
