import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const { userRole } = useAuth();
  const isStudent = userRole === 'student';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* Professor Dashboard Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Professor',
          href: isStudent ? null : '/(tabs)',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Classes Management Tab */}
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          href: isStudent ? null : '/(tabs)/classes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Student Biometrics Directory Tab */}
      <Tabs.Screen
        name="students"
        options={{
          title: 'Students',
          href: isStudent ? null : '/(tabs)/students',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Attendance Session Capture Tab */}
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          href: isStudent ? null : '/(tabs)/attendance',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-circle" size={size + 2} color={color} />
          ),
        }}
      />

      {/* Dedicated Student Portal Tab */}
      <Tabs.Screen
        name="student-portal"
        options={{
          title: 'Student Portal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
