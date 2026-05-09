export interface Profile {
  id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  expo_push_token: string | null;
}
