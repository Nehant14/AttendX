/**
 * Academic & Modern Design System for AttendX
 */

export const Colors = {
  // Brand & Academic Primary
  primary: '#1E3A8A', // Classic Deep Academic Navy
  primaryLight: '#2563EB', // Royal Blue
  primaryDark: '#0F172A', // Slate 900
  primarySurface: '#EEF2FF', // Indigo 50

  // Accent & Student Highlight
  accent: '#0D9488', // Emerald/Teal
  accentLight: '#14B8A6',
  accentSurface: '#F0FDFA',

  // Neutrals & Surfaces
  background: '#F8FAFC', // Slate 50
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9', // Slate 100
  border: '#E2E8F0', // Slate 200
  borderLight: '#F8FAFC',

  // Typography
  textPrimary: '#0F172A', // Slate 900
  textSecondary: '#475569', // Slate 600
  textMuted: '#94A3B8', // Slate 400
  textInverse: '#FFFFFF',

  // Status & Feedback Colors
  success: '#10B981', // Emerald 500
  successSurface: '#ECFDF5',
  successText: '#047857',

  warning: '#F59E0B', // Amber 500
  warningSurface: '#FFFBEB',
  warningText: '#B45309',

  danger: '#EF4444', // Rose/Red 500
  dangerSurface: '#FEF2F2',
  dangerText: '#B91C1C',

  info: '#0284C7', // Sky 600
  infoSurface: '#F0F9FF',
  infoText: '#0369A1',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
};

export const Typography = {
  headingLg: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headingMd: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  headingSm: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bodySm: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
};

export const Shadows = {
  none: {},
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};
