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
import { cacheStorage } from '@/services/storage/cache';
import { SessionSummaryOut } from '@/types/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { formatDate } from '@/utils/formatters';

export default function DashboardScreen() {
  const router = useRouter();
  const { professorName } = useAuth();
  const { classes, refreshClasses } = useClasses();
  const { students, refreshStudents } = useStudents();

  const [recentSessions, setRecentSessions] = useState<SessionSummaryOut[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      await Promise.all([
        refreshClasses(),
        refreshStudents(),
        cacheStorage.getCachedSessions().then(setRecentSessions),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshClasses, refreshStudents]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.nameText}>{professorName || 'Professor'}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Quick Launch Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>Automate Attendance</Text>
            <Text style={styles.heroSubtitle}>
              Take a high-res classroom photo and let AttendX identify enrolled faces.
            </Text>
            <Button
              title="Start Attendance Session"
              onPress={() => router.push('/(tabs)/attendance')}
              size="md"
              style={styles.heroBtn}
              icon={<Ionicons name="camera-outline" size={18} color={Colors.textInverse} />}
            />
          </View>
        </View>

        {/* Overview Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBadge, { backgroundColor: Colors.primarySurface }]}>
              <Ionicons name="book-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.statCount}>{classes.length}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBadge, { backgroundColor: Colors.accentSurface }]}>
              <Ionicons name="people-outline" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.statCount}>{students.length}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBadge, { backgroundColor: Colors.successSurface }]}>
              <Ionicons name="checkmark-done-circle-outline" size={20} color={Colors.success} />
            </View>
            <Text style={styles.statCount}>{recentSessions.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {/* Classes Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Classes</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/classes')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {classes.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No Classes Yet"
            description="Create your first class to configure student rosters."
            actionTitle="Create Class"
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
                  <Ionicons name="school" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.className} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.classMeta}>Class ID: {c.id}</Text>
                <View style={styles.classFooter}>
                  <Text style={styles.classAction}>Manage Roster →</Text>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}

        {/* Recent Activity / Sessions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Attendance Activity</Text>
        </View>

        {recentSessions.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No Attendance Sessions Yet"
            description="Your recent classroom attendance captures and finalized reviews will appear here."
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
                  <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.sessionInfoCol}>
                  <Text style={styles.sessionTitle}>Session #{session.id}</Text>
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
    marginBottom: Spacing.lg,
  },
  greetingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  heroLeft: {
    width: '100%',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textInverse,
    marginBottom: 6,
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
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statCount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  horizontalClassList: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  classCard: {
    width: 170,
    padding: Spacing.md,
  },
  classIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  className: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  classMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  classFooter: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  classAction: {
    fontSize: 12,
    fontWeight: '600',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  sessionInfoCol: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sessionDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sessionStatusCol: {
    alignItems: 'flex-end',
  },
  sessionCounts: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
