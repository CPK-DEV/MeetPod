import { create } from 'zustand';

interface InviteState {
  pendingCode: string | null;
  setPending: (c: string | null) => void;
  consume: () => string | null;
}

export const useInviteStore = create<InviteState>((set, get) => ({
  pendingCode: null,
  setPending: (c) => set({ pendingCode: c }),
  consume: () => {
    const c = get().pendingCode;
    set({ pendingCode: null });
    return c;
  },
}));
