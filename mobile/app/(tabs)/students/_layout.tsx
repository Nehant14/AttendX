import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function StudentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
