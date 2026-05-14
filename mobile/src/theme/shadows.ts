import { Platform } from 'react-native';

export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    android: { elevation: 1 },
    default: {},
  })!,
  floatingTabbar: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 12 },
    default: {},
  })!,
  headerSeparator: Platform.select({
    ios: { shadowColor: '#1F1B0F', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 4 },
    default: {},
  })!,
};
