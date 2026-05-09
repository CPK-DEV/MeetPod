import { apiClient } from './client';

export interface ChatRoom {
  id: string;
  kind: 'group' | 'meetup';
  ref_id: string;
  archived_at: string | null;
  created_at: string;
}
export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  kind: 'text' | 'image' | 'place';
  body: string | null;
  image_url: string | null;
  place_payload: any | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}
export interface UploadUrlResponse {
  object_key: string;
  signed_url: string;
  public_path: string;
  expires_in: number;
}

export const listRooms = () => apiClient.get<ChatRoom[]>('/chat/rooms').then(r => r.data);
export const listMessages = (roomId: string, before?: string, limit = 50) =>
  apiClient.get<Message[]>(`/chat/rooms/${roomId}/messages`, { params: { before, limit } }).then(r => r.data);

export const sendText = (roomId: string, body: string) =>
  apiClient.post<Message>(`/chat/rooms/${roomId}/messages`, { kind: 'text', body }).then(r => r.data);
export const sendImage = (roomId: string, imageUrl: string) =>
  apiClient.post<Message>(`/chat/rooms/${roomId}/messages`, { kind: 'image', image_url: imageUrl }).then(r => r.data);
export const sendPlace = (roomId: string, place_payload: any) =>
  apiClient.post<Message>(`/chat/rooms/${roomId}/messages`, { kind: 'place', place_payload }).then(r => r.data);

export const createUploadUrl = (roomId: string, ext: string) =>
  apiClient.post<UploadUrlResponse>(`/chat/rooms/${roomId}/upload-url`, { ext }).then(r => r.data);

export const setPushToken = (token: string | null) =>
  apiClient.put('/profiles/me/push-token', { expo_push_token: token });
