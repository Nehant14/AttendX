/**
 * Academic & Professional Design Theme for AttendX
 */

export const Colors = {
  primary: '#1E3A8A', // Deep Academic Navy
  primaryLight: '#3B82F6',
  primaryDark: '#172554',
  primarySurface: '#EFF6FF',

  accent: '#0D9488', // Teal accent
  accentLight: '#14B8A6',
  accentSurface: '#F0FDFA',

  background: '#F8FAFC', // Slate 50
  card: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#E2E8F0', // Slate 200
  borderLight: '#F1F5F9',

  textPrimary: '#0F172A', // Slate 900
  textSecondary: '#475569', // Slate 600
  textMuted: '#94A3B8', // Slate 400
  textInverse: '#FFFFFF',

  // Status colors
  success: '#10B981',
  successSurface: '#ECFDF5',
  successText: '#065F46',

  warning: '#F59E0B',
  warningSurface: '#FFFBEB',
  warningText: '#92400E',

  danger: '#EF4444',
  dangerSurface: '#FEF2F2',
  dangerText: '#991B1B',

  info: '#0284C7',
  infoSurface: '#F0F9FF',
  infoText: '#075985',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  headingLg: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headingMd: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  headingSm: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bodySm: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
};

export const Shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};
