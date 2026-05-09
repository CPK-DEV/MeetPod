import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: [Linking.createURL('/'), 'meetpod://'],
  config: {
    screens: {
      InviteAccept: 'invite/:code',
      // 후속 plan에서 추가:
      // MeetupDetail: 'meetup/:id',
    },
  },
};

export function parseInviteCode(url: string): string | null {
  const m = url.match(/invite\/([A-Za-z0-9_-]{6,16})/);
  return m ? m[1] : null;
}
