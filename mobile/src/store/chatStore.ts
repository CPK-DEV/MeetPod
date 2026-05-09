import { create } from 'zustand';
import { listMessages, listRooms, type ChatRoom, type Message } from '@/api/chat';

interface State {
  rooms: ChatRoom[];
  messages: Record<string, Message[]>;        // roomId → 최신순 정렬(asc)
  refreshRooms: () => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  pushIncoming: (m: Message) => void;
  appendOptimistic: (m: Message) => void;
}

export const useChatStore = create<State>((set, get) => ({
  rooms: [],
  messages: {},

  refreshRooms: async () => {
    const rooms = await listRooms();
    set({ rooms });
  },

  loadMessages: async (roomId) => {
    const desc = await listMessages(roomId);
    const asc = [...desc].reverse();
    set((s) => ({ messages: { ...s.messages, [roomId]: asc } }));
  },

  pushIncoming: (m) => {
    const list = get().messages[m.room_id] ?? [];
    if (list.some((x) => x.id === m.id)) return;
    set((s) => ({ messages: { ...s.messages, [m.room_id]: [...list, m] } }));
  },

  appendOptimistic: (m) => {
    set((s) => ({ messages: { ...s.messages, [m.room_id]: [...(s.messages[m.room_id] ?? []), m] } }));
  },
}));
