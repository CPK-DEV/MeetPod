import { apiClient } from './client';

export interface Place {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  google_id?: string | null;
}
export interface Meetup {
  id: string;
  group_id: string | null;
  creator_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  place_name: string;
  place_lat: number;
  place_lng: number;
  place_address: string | null;
  place_google_id: string | null;
  location_share_minutes_before: number;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  created_at: string;
  my_status: 'pending' | 'going' | 'declined' | null;
}
export interface Participant {
  user_id: string;
  status: 'pending' | 'going' | 'declined';
  joined_at: string;
  display_name: string | null;
  handle: string | null;
}

export interface MeetupCreatePayload {
  title: string;
  starts_at: string;
  ends_at: string;
  place: Place;
  group_id?: string | null;
  participant_ids?: string[];
  location_share_minutes_before?: 10 | 20 | 30 | 60;
  self_reminder_minutes_before?: number | null;
}

export const listMeetups = (includeEnded = false) =>
  apiClient.get<Meetup[]>('/meetups', { params: { include_ended: includeEnded } }).then(r => r.data);

export const getMeetup = (id: string) =>
  apiClient.get<Meetup>(`/meetups/${id}`).then(r => r.data);

export const createMeetup = (body: MeetupCreatePayload) =>
  apiClient.post<Meetup>('/meetups', body).then(r => r.data);

export const cancelMeetup = (id: string) =>
  apiClient.post<Meetup>(`/meetups/${id}/cancel`).then(r => r.data);

export const respondToMeetup = (id: string, status: 'going' | 'declined') =>
  apiClient.post<Meetup>(`/meetups/${id}/rsvp`, { status }).then(r => r.data);

export const listParticipants = (id: string) =>
  apiClient.get<Participant[]>(`/meetups/${id}/participants`).then(r => r.data);

export const upsertReminder = (mid: string, minutes_before: number) =>
  apiClient.put(`/meetups/${mid}/reminders/me`, { minutes_before });
