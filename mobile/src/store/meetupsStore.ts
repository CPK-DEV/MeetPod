import { create } from 'zustand';
import { listMeetups, type Meetup } from '@/api/meetups';
import { shouldTrack, startTracking, stopTracking } from '@/lib/location_tracker';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';

async function reconcileTracking(items: Meetup[]) {
  const userId = useAuthStore.getState().profile?.id;
  if (!userId) return;
  const candidates = items
    .filter((m) => m.status === 'scheduled' || m.status === 'active')
    .filter(shouldTrack)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const target = candidates[0] ?? null;
  const current = useLocationStore.getState().trackingMeetupId;
  if (target && current !== target.id) {
    await startTracking({ meetupId: target.id, userId, endsAt: new Date(target.ends_at) });
  } else if (!target && current) {
    await stopTracking();
  }
}

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
      reconcileTracking(items);
    } finally {
      set({ loading: false });
    }
  },
}));
