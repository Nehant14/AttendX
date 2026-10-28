import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useClasses } from '@/hooks/useClasses';
import { useStudents } from '@/hooks/useStudents';
import { useSessions } from '@/hooks/useSessions';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConnectionStatusBanner } from '@/components/ui/ConnectionStatusBanner';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { formatDate } from '@/utils/formatters';

export default function DashboardScreen() {
  const router = useRouter();
  const { professorName, switchRole } = useAuth();
  const { classes, refreshClasses } = useClasses();
  const { students, refreshStudents } = useStudents();

  const { sessions: recentSessions, refreshSessions } = useSessions();
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      await Promise.all([refreshClasses(), refreshStudents(), refreshSessions()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshClasses, refreshStudents, refreshSessions]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleOpenStudentPortal = async () => {
    if (students.length > 0) {
      await switchRole('student');
      router.push('/(tabs)/student-portal');
    } else {
      router.push('/(tabs)/students');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <Text style={styles.greetingText}>Faculty Dashboard</Text>
            <Text style={styles.nameText} numberOfLines={1}>
              {professorName || 'Professor'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={handleOpenStudentPortal}
              activeOpacity={0.7}
            >
              <Ionicons name="school-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Backend Connection Status Pill */}
        <View style={styles.connectionWrapper}>
          <ConnectionStatusBanner />
        </View>

        {/* Quick Launch Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Automate Attendance</Text>
            <Text style={styles.heroSubtitle}>
              Take a classroom photo to detect, match, and log student attendance.
            </Text>
            <Button
              title="Start New Attendance Session"
              onPress={() => router.push('/(tabs)/attendance')}
              size="md"
              style={styles.heroBtn}
              icon={<Ionicons name="camera" size={17} color={Colors.textInverse} />}
            />
          </View>
        </View>

        {/* Overview Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard} onPress={() => router.push('/(tabs)/classes')}>
            <View style={[styles.statIconBadge, { backgroundColor: Colors.primarySurface }]}>
              <Ionicons name="book-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.statCount}>{classes.length}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </Card>

          <Card style={styles.statCard} onPress={() => router.push('/(tabs)/students')}>
            <View style={[styles.statIconBadge, { backgroundColor: Colors.accentSurface }]}>
              <Ionicons name="people-outline" size={18} color={Colors.accent} />
            </View>
            <Text style={styles.statCount}>{students.length}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={[styles.statIconBadge, { backgroundColor: Colors.successSurface }]}>
              <Ionicons name="checkmark-done" size={18} color={Colors.success} />
            </View>
            <Text style={styles.statCount}>{recentSessions.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </Card>
        </View>

        {/* Classes Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Courses</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/classes')}>
            <Text style={styles.sectionLink}>View All ({classes.length})</Text>
          </TouchableOpacity>
        </View>

        {classes.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No Classes Configured"
            description="Create your course to register student rosters and run face matching."
            actionTitle="Create First Class"
            onAction={() => router.push('/(tabs)/classes')}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalClassList}
          >
            {classes.slice(0, 5).map((c) => (
              <Card
                key={c.id}
                style={styles.classCard}
                onPress={() => router.push(`/(tabs)/classes/${c.id}`)}
              >
                <View style={styles.classIconBadge}>
                  <Ionicons name="school" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.className} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.classMeta}>Class ID: #{c.id}</Text>
                <View style={styles.classFooter}>
                  <Text style={styles.classAction}>Manage Roster →</Text>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}

        {/* Recent Activity / Sessions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Attendance Sessions</Text>
        </View>

        {recentSessions.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No Past Sessions"
            description="Completed classroom sessions will appear here with review breakdowns."
          />
        ) : (
          recentSessions.slice(0, 5).map((session) => (
            <Card
              key={session.id}
              style={styles.sessionCard}
              onPress={() => router.push(`/(tabs)/attendance/session/${session.id}`)}
            >
              <View style={styles.sessionRow}>
                <View style={styles.sessionIconCol}>
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.sessionInfoCol}>
                  <Text style={styles.sessionTitle}>
                    {session.class_name ? `${session.class_name} · #${session.id}` : `Session #${session.id}`}
                  </Text>
                  <Text style={styles.sessionDate}>{formatDate(session.session_date)}</Text>
                </View>
                <View style={styles.sessionStatusCol}>
                  <Badge label={session.status} variant={session.status} />
                  {session.status === 'finalized' && (
                    <Text style={styles.sessionCounts}>
                      {session.present_count} present • {session.absent_count} absent
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  titleCol: {
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  connectionWrapper: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  heroContent: {
    width: '100%',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textInverse,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#93C5FD',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  heroBtn: {
    backgroundColor: Colors.primaryLight,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statCount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  horizontalClassList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  classCard: {
    width: 160,
    padding: Spacing.md,
  },
  classIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  className: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  classMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  classFooter: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 6,
  },
  classAction: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  sessionCard: {
    marginBottom: Spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionIconCol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  sessionInfoCol: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sessionDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  sessionStatusCol: {
    alignItems: 'flex-end',
  },
  sessionCounts: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
});
