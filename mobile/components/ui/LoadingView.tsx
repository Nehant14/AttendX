import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

interface LoadingViewProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

export const LoadingView: React.FC<LoadingViewProps> = ({
  message = 'Loading...',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  text: {
    marginTop: Spacing.md,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
