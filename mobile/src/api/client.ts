import axios from 'axios';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

type SessionLike = { access_token: string } | null;

let _testSession: SessionLike | undefined;
export function __setSessionForTest(s: SessionLike) {
  _testSession = s;
}

async function currentToken(): Promise<string | null> {
  if (_testSession !== undefined) return _testSession?.access_token ?? null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await currentToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && _testSession === undefined) {
      const { data, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && data.session && !error.config.__retried) {
        error.config.__retried = true;
        return apiClient.request(error.config);
      }
      await supabase.auth.signOut();
    }
    return Promise.reject(error);
  },
);
