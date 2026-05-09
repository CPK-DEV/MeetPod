import { apiClient } from './client';

export interface FriendSummary {
  id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
}

export const listFriends = () =>
  apiClient.get<FriendSummary[]>('/friendships').then(r => r.data);
