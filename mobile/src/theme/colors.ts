export const colors = {
  brandPrimary:     '#FF6900',
  brandPrimaryDark: '#E55A00',
  brandSecondary:   '#FEE500',

  ink:              '#1F1B0F',
  inkInverse:       '#FFFFFF',
  muted:            '#64748B',
  mutedLight:       '#94A3B8',

  surface:          '#FFFFFF',
  surfaceSubtle:    '#F8FAFC',
  surfaceDark:      '#1F1B0F',

  success:          '#3DD68C',
  warning:          '#F59E0B',
  danger:           '#EF4444',
  info:             '#6366F1',

  border:           '#E2E8F0',
  borderOnOrange:   'rgba(255,255,255,0.25)',
  ghostOverlay:     'rgba(255,255,255,0.18)',
} as const;

export type ColorKey = keyof typeof colors;
