import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { bootstrap, getMe, setHandle as apiSetHandle } from '@/api/auth';
import type { Profile } from '@/api/types';
import type { Session } from '@supabase/supabase-js';

type Status = 'unknown' | 'unauthenticated' | 'needsHandle' | 'ready';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  status: Status;
  hydrateAfterAuth: (session: Session) => Promise<void>;
  setHandle: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
  initFromStored: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  status: 'unknown',

  initFromStored: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      set({ status: 'unauthenticated' });
      return;
    }
    await get().hydrateAfterAuth(data.session);
  },

  hydrateAfterAuth: async (session) => {
    set({ session });
    let me = await getMe();
    if (!me) {
      const displayName =
        (session.user.user_metadata?.full_name as string) ||
        (session.user.user_metadata?.name as string) ||
        session.user.email?.split('@')[0] ||
        'User';
      me = await bootstrap(displayName);
    }
    set({ profile: me, status: me.handle ? 'ready' : 'needsHandle' });
  },

  setHandle: async (handle) => {
    const updated = await apiSetHandle(handle);
    set({ profile: updated, status: 'ready' });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: 'unauthenticated' });
  },
}));
