import { apiClient } from './client';
import type { Profile } from './types';

export async function bootstrap(displayName: string, avatarUrl?: string): Promise<Profile> {
  const { data } = await apiClient.post<Profile>('/auth/bootstrap', {
    display_name: displayName,
    avatar_url: avatarUrl ?? null,
  });
  return data;
}

export async function getMe(): Promise<Profile | null> {
  try {
    const { data } = await apiClient.get<Profile>('/profiles/me');
    return data;
  } catch (e: any) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}

export async function setHandle(handle: string): Promise<Profile> {
  const { data } = await apiClient.patch<Profile>('/profiles/me/handle', { handle });
  return data;
}
