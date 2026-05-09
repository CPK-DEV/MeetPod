import { useAuthStore } from '../src/store/authStore';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signOut: jest.fn() },
  },
}));
jest.mock('@/api/auth', () => ({
  bootstrap: jest.fn(async () => ({ id: 'u1', handle: null, display_name: 'A', avatar_url: null, expo_push_token: null })),
  getMe: jest.fn(async () => ({ id: 'u1', handle: 'alice', display_name: 'A', avatar_url: null, expo_push_token: null })),
}));

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ session: null, profile: null, status: 'unknown' }));

  it('starts unknown', () => {
    expect(useAuthStore.getState().status).toBe('unknown');
  });

  it('sets needsHandle when getMe returns null handle', async () => {
    const { hydrateAfterAuth } = useAuthStore.getState();
    const { bootstrap } = require('@/api/auth');
    bootstrap.mockResolvedValueOnce({ id: 'u1', handle: null, display_name: 'A', avatar_url: null, expo_push_token: null });
    const { getMe } = require('@/api/auth');
    getMe.mockResolvedValueOnce({ id: 'u1', handle: null, display_name: 'A', avatar_url: null, expo_push_token: null });

    await hydrateAfterAuth({ access_token: 't', user: { id: 'u1', user_metadata: { full_name: 'A' } } } as any);
    expect(useAuthStore.getState().status).toBe('needsHandle');
  });

  it('sets ready when handle present', async () => {
    const { hydrateAfterAuth } = useAuthStore.getState();
    await hydrateAfterAuth({ access_token: 't', user: { id: 'u1', user_metadata: { full_name: 'A' } } } as any);
    expect(useAuthStore.getState().status).toBe('ready');
  });
});
