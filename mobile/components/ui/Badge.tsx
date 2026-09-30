import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '@/constants/theme';

export type BadgeVariant =
  | 'present'
  | 'flagged'
  | 'not_detected'
  | 'absent'
  | 'pending'
  | 'reviewed'
  | 'finalized'
  | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant | string;
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'info', style }) => {
  const getBadgeColors = () => {
    switch (variant?.toLowerCase()) {
      case 'present':
        return { bg: Colors.successSurface, text: Colors.successText };
      case 'flagged':
        return { bg: Colors.warningSurface, text: Colors.warningText };
      case 'not_detected':
      case 'absent':
      case 'rejected':
      case 'failed':
        return { bg: Colors.dangerSurface, text: Colors.dangerText };
      case 'reviewed':
      case 'finalized':
      case 'completed':
        return { bg: Colors.primarySurface, text: Colors.primary };
      case 'pending':
      case 'processing':
        return { bg: '#FEF3C7', text: '#B45309' };
      default:
        return { bg: Colors.borderLight, text: Colors.textSecondary };
    }
  };

  const colors = getBadgeColors();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
