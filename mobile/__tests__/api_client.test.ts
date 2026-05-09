import { __setSessionForTest, apiClient } from '../src/api/client';

jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

describe('apiClient', () => {
  it('attaches bearer when session present', async () => {
    __setSessionForTest({ access_token: 'tok123' });
    const cfg = await (apiClient.interceptors.request as any).handlers[0].fulfilled({ headers: {} });
    expect(cfg.headers.Authorization).toBe('Bearer tok123');
  });

  it('omits header when no session', async () => {
    __setSessionForTest(null);
    const cfg = await (apiClient.interceptors.request as any).handlers[0].fulfilled({ headers: {} });
    expect(cfg.headers.Authorization).toBeUndefined();
  });
});
