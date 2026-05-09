import { apiClient } from './client';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  created_at: string;
}
export interface GroupMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

export const listGroups = () => apiClient.get<Group[]>('/groups').then(r => r.data);
export const getGroup = (id: string) => apiClient.get<Group>(`/groups/${id}`).then(r => r.data);
export const createGroup = (name: string, description?: string) =>
  apiClient.post<Group>('/groups', { name, description: description ?? null }).then(r => r.data);
export const updateGroup = (id: string, patch: Partial<Pick<Group,'name'|'description'|'avatar_url'>>) =>
  apiClient.patch<Group>(`/groups/${id}`, patch).then(r => r.data);
export const listMembers = (id: string) =>
  apiClient.get<GroupMember[]>(`/groups/${id}/members`).then(r => r.data);
export const setMemberRole = (gid: string, uid: string, role: 'admin'|'member') =>
  apiClient.patch(`/groups/${gid}/members/${uid}/role`, { role });
export const kickMember = (gid: string, uid: string) =>
  apiClient.delete(`/groups/${gid}/members/${uid}`);
export const transferOwner = (gid: string, newOwnerId: string) =>
  apiClient.post(`/groups/${gid}/transfer`, { new_owner_id: newOwnerId });
