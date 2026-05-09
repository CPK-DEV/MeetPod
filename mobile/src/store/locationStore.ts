import { create } from 'zustand';

export type PermStatus = 'unknown' | 'granted_always' | 'granted_foreground' | 'denied';

interface State {
  permission: PermStatus;
  trackingMeetupId: string | null;
  setPermission: (p: PermStatus) => void;
  setTracking: (id: string | null) => void;
}

export const useLocationStore = create<State>((set) => ({
  permission: 'unknown',
  trackingMeetupId: null,
  setPermission: (p) => set({ permission: p }),
  setTracking: (id) => set({ trackingMeetupId: id }),
}));
