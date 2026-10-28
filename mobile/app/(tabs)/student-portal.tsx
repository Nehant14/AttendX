import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useStudentPortal } from '@/hooks/useStudentPortal';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConnectionStatusBanner } from '@/components/ui/ConnectionStatusBanner';
import { pickImageFromGallery, takePhotoWithCamera, PickedImage } from '@/utils/image';
import { formatDate, formatPercentage } from '@/utils/formatters';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function StudentPortalScreen() {
  const router = useRouter();
  const { studentRollNo, studentName, switchRole, logout } = useAuth();
  const {
    loading,
    embeddings,
    enrolledClasses,
    attendanceHistory,
    courseSummaries,
    stats,
    refresh,
    enrollSelfPhotos,
  } = useStudentPortal(studentRollNo);

  const [refreshing, setRefreshing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<PickedImage[]>([]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCaptureSelfie = async () => {
    const photo = await takePhotoWithCamera();
    if (photo) {
      setSelectedPhotos((prev) => [...prev, photo].slice(0, 6));
    }
  };

  const handlePickFromGallery = async () => {
    const photos = await pickImageFromGallery(true);
    if (photos.length > 0) {
      setSelectedPhotos((prev) => [...prev, ...photos].slice(0, 6));
    }
  };

  const handleUploadSelfPhotos = async () => {
    if (selectedPhotos.length === 0) return;
    setEnrolling(true);
    try {
      const res = await enrollSelfPhotos(selectedPhotos);
      setSelectedPhotos([]);
      Alert.alert(
        'Biometrics Updated',
        `Successfully enrolled ${res.photos_accepted} of ${res.photos_submitted} face photos!`
      );
    } catch (err: any) {
      Alert.alert('Enrollment Error', err.message || 'Failed to update biometrics.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleSwitchToProfessor = async () => {
    await switchRole('professor');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Student Portal"
        subtitle={studentName || studentRollNo || 'Student Dashboard'}
        rightAction={
          <TouchableOpacity
            style={styles.switchRoleBtn}
            onPress={handleSwitchToProfessor}
            activeOpacity={0.7}
          >
            <Ionicons name="repeat-outline" size={16} color={Colors.primary} />
            <Text style={styles.switchRoleText}>Professor View</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Connection Status Pill */}
        <View style={styles.connectionWrapper}>
          <ConnectionStatusBanner />
        </View>

        {/* Student ID Hero Card */}
        <View style={styles.studentIdCard}>
          <View style={styles.studentIdTop}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={28} color={Colors.accent} />
            </View>
            <View style={styles.studentIdInfo}>
              <Text style={styles.studentNameText}>{studentName || 'Student'}</Text>
              <Text style={styles.studentRollText}>Roll No: {studentRollNo || 'N/A'}</Text>
            </View>
            <Badge
              label={embeddings.length > 0 ? 'Verified' : 'Unregistered'}
              variant={embeddings.length > 0 ? 'present' : 'flagged'}
            />
          </View>

          {/* Biometrics Status Strip */}
          <View style={styles.biometricStrip}>
            <Ionicons
              name={embeddings.length > 0 ? 'shield-checkmark' : 'alert-circle'}
              size={18}
              color={embeddings.length > 0 ? Colors.accent : Colors.warning}
            />
            <Text style={styles.biometricStripText}>
              {embeddings.length > 0
                ? `${embeddings.length} Biometric Face Embeddings on file`
                : 'No face biometrics on file. Please enroll photos below.'}
            </Text>
          </View>
        </View>

        {/* Attendance Statistics Grid */}
        <Text style={styles.sectionTitle}>Attendance Overview</Text>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {stats.attendanceRate}%
            </Text>
            <Text style={styles.statLabel}>Attendance Rate</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.successText }]}>
              {stats.presentSessions}
            </Text>
            <Text style={styles.statLabel}>Present</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.dangerText }]}>
              {stats.absentSessions}
            </Text>
            <Text style={styles.statLabel}>Absent / Missed</Text>
          </Card>
        </View>

        {/* Self Face Biometric Enrollment Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Face Biometrics Registration</Text>
          <Text style={styles.sectionSub}>Camera verification</Text>
        </View>

        <Card style={styles.enrollCard}>
          <Text style={styles.enrollCardDesc}>
            Upload 3-6 clear photos of your face. Good frontal lighting ensures instant detection during class attendance captures.
          </Text>

          <View style={styles.enrollActions}>
            <Button
              title="Take Selfie"
              onPress={handleCaptureSelfie}
              size="sm"
              variant="outline"
              icon={<Ionicons name="camera" size={16} color={Colors.primary} />}
              style={styles.actionBtn}
            />
            <Button
              title="Upload Photos"
              onPress={handlePickFromGallery}
              size="sm"
              variant="outline"
              icon={<Ionicons name="images" size={16} color={Colors.primary} />}
              style={styles.actionBtn}
            />
          </View>

          {/* Selected photos preview */}
          {selectedPhotos.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewCount}>
                {selectedPhotos.length} photo(s) ready to submit
              </Text>
              <View style={styles.photoGrid}>
                {selectedPhotos.map((photo, idx) => (
                  <View key={photo.uri} style={styles.thumbWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} />
                    <TouchableOpacity
                      style={styles.removeThumb}
                      onPress={() => setSelectedPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Button
                title="Submit for AI Quality Check & Enrollment"
                onPress={handleUploadSelfPhotos}
                loading={enrolling}
                size="md"
              />
            </View>
          )}
        </Card>

        {/* Enrolled Courses */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Enrolled Courses</Text>
        {courseSummaries.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No Courses Enrolled"
            description="Your professor has not yet added your roll number to any class rosters."
          />
        ) : (
          courseSummaries.map((course) => (
            <Card key={course.classId} style={styles.courseCard}>
              <View style={styles.courseHeader}>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseName}>{course.className}</Text>
                  <Text style={styles.courseMeta}>
                    {course.presentCount} of {course.totalSessions} sessions attended
                  </Text>
                </View>
                <Badge
                  label={`${course.attendanceRate}%`}
                  variant={course.attendanceRate >= 75 ? 'present' : 'flagged'}
                />
              </View>

              {/* Attendance Progress Bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(course.attendanceRate, 100)}%`,
                      backgroundColor:
                        course.attendanceRate >= 75 ? Colors.success : Colors.warning,
                    },
                  ]}
                />
              </View>
            </Card>
          ))
        )}

        {/* Recent Attendance Log */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
          Session Attendance History
        </Text>

        {loading ? (
          <LoadingView message="Loading attendance logs..." />
        ) : attendanceHistory.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No Attendance Records Yet"
            description="When professors capture attendance in your classes, your status and verification logs will appear here."
          />
        ) : (
          attendanceHistory.map((item, index) => (
            <Card key={`${item.sessionId}-${index}`} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={styles.historyIconCol}>
                  <Ionicons
                    name={item.status === 'present' ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={item.status === 'present' ? Colors.success : Colors.danger}
                  />
                </View>
                <View style={styles.historyDetails}>
                  <Text style={styles.historyCourse}>{item.className}</Text>
                  <Text style={styles.historyDate}>
                    {formatDate(item.sessionDate)} • Session #{item.sessionId}
                  </Text>
                </View>
                <View style={styles.historyStatusCol}>
                  <Badge label={item.status} variant={item.status} />
                  {item.matchScore !== null && (
                    <Text style={styles.confidenceText}>
                      {formatPercentage(item.matchScore)} match
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
  connectionWrapper: {
    marginBottom: Spacing.md,
  },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  switchRoleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  studentIdCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  studentIdTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  studentIdInfo: {
    flex: 1,
  },
  studentNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  studentRollText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  biometricStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  biometricStripText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  enrollCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  enrollCardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  enrollActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  previewSection: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  previewCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  thumbWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  removeThumb: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.card,
    borderRadius: 9,
  },
  courseCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  courseInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  courseMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  historyCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIconCol: {
    marginRight: Spacing.md,
  },
  historyDetails: {
    flex: 1,
  },
  historyCourse: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  historyStatusCol: {
    alignItems: 'flex-end',
  },
  confidenceText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
