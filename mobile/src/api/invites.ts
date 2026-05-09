import { apiClient } from './client';

export interface Invite {
  code: string;
  inviter_id: string;
  kind: 'friend' | 'group';
  target_group_id: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
}
export interface AcceptResult {
  kind: 'friend' | 'group';
  inviter_id: string;
  group_id: string | null;
}

export const createInvite = (kind: 'friend' | 'group', target_group_id?: string) =>
  apiClient.post<Invite>('/invites', { kind, target_group_id: target_group_id ?? null }).then(r => r.data);

export const acceptInvite = (code: string) =>
  apiClient.post<AcceptResult>(`/invites/${code}/accept`).then(r => r.data);
