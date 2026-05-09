import { create } from 'zustand';
import { listMeetups, type Meetup } from '@/api/meetups';

interface State {
  byId: Record<string, Meetup>;
  ids: string[];
  loading: boolean;
  refresh: (includeEnded?: boolean) => Promise<void>;
}

export const useMeetupsStore = create<State>((set) => ({
  byId: {},
  ids: [],
  loading: false,
  refresh: async (includeEnded = false) => {
    set({ loading: true });
    try {
      const items = await listMeetups(includeEnded);
      const byId: Record<string, Meetup> = {};
      const ids: string[] = [];
      for (const m of items) { byId[m.id] = m; ids.push(m.id); }
      set({ byId, ids });
    } finally {
      set({ loading: false });
    }
  },
}));
