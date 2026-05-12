import { create } from 'zustand';
import type { PlaceDetail } from '@/lib/places';

interface State {
  picked: PlaceDetail | null;
  set: (p: PlaceDetail) => void;
  consume: () => PlaceDetail | null;
}

export const usePlacePickStore = create<State>((set, get) => ({
  picked: null,
  set: (p) => set({ picked: p }),
  consume: () => {
    const p = get().picked;
    set({ picked: null });
    return p;
  },
}));
