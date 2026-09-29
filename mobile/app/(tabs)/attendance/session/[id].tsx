import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAttendanceSession } from '@/hooks/useAttendanceSession';
import { useClasses } from '@/hooks/useClasses';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FaceBoundingBoxOverlay } from '@/components/attendance/FaceBoundingBoxOverlay';
import { FlaggedFaceCard } from '@/components/attendance/FlaggedFaceCard';
import { RosterChecklist } from '@/components/attendance/RosterChecklist';
import { AuditModal } from '@/components/attendance/AuditModal';
import { RosterStudentOut, DetectedFaceOut } from '@/types/api';
import { formatDate } from '@/utils/formatters';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function SessionReviewScreen() {
  const { id } = useLocalSearchParams();
  const sessionId = Number(id);
  const router = useRouter();

  const {
    status,
    reviewData,
    auditLogs,
    error,
    isSubmitting,
    mediaBaseUrl,
    resolveFace,
    finalizeSession,
    loadAudit,
    reloadReview,
  } = useAttendanceSession(sessionId);

  const { getRoster } = useClasses();
  const [roster, setRoster] = useState<RosterStudentOut[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);
  const [auditVisible, setAuditVisible] = useState(false);

  // Load roster once class_id is known from reviewData
  useEffect(() => {
    if (reviewData?.class_id) {
      getRoster(reviewData.class_id).then(setRoster).catch(console.warn);
    }
  }, [reviewData?.class_id, getRoster]);

  const handleConfirmFace = async (faceId: number) => {
    try {
      await resolveFace({ detected_face_id: faceId, action: 'confirm' });
      Alert.alert('Confirmed', 'Face confirmed as present.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to confirm face');
    }
  };

  const handleRejectFace = async (faceId: number) => {
    try {
      await resolveFace({ detected_face_id: faceId, action: 'reject' });
      Alert.alert('Rejected', 'Face rejected and marked absent/unmatched.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject face');
    }
  };

  const handleReassignFace = async (faceId: number, reassignStudentId: number) => {
    try {
      await resolveFace({
        detected_face_id: faceId,
        action: 'reject',
        reassign_student_id: reassignStudentId,
      });
      Alert.alert('Reassigned', 'Face successfully reassigned.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reassign face');
    }
  };

  const handleFinalize = () => {
    const unconfirmedCount = reviewData?.faces.filter(
      (f) => f.classification === 'flagged' || f.classification === 'unmatched'
    ).length || 0;

    Alert.alert(
      'Finalize Attendance',
      `Are you sure you want to finalize Session #${sessionId}? ${
        unconfirmedCount > 0
          ? `${unconfirmedCount} unconfirmed or flagged face(s) will be automatically marked absent.`
          : 'Attendance records will be locked.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize Now',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await finalizeSession();
              Alert.alert(
                'Attendance Finalized',
                `Finalized with ${res.present_count} present and ${res.absent_count} absent.`
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to finalize attendance');
            }
          },
        },
      ]
    );
  };

  const handleOpenAudit = async () => {
    await loadAudit();
    setAuditVisible(true);
  };

  // 1. Loading / Polling Processing State
  if (status === 'pending' || status === 'processing' || status === 'idle') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={`Session #${sessionId}`} subtitle="Processing" canGoBack />
        <View style={styles.processingContainer}>
          <View style={styles.pulseCircle}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          <Text style={styles.processingTitle}>Analyzing Classroom Photo</Text>
          <Text style={styles.processingSub}>
            The backend face-recognition pipeline is detecting faces, assessing quality, and matching against student biometrics.
          </Text>

          <View style={styles.pipelineCard}>
            <View style={styles.pipelineStep}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.stepText}>Photo uploaded successfully</Text>
            </View>
            <View style={styles.pipelineStep}>
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.stepText}>Detecting & aligning student faces...</Text>
            </View>
            <View style={styles.pipelineStep}>
              <Ionicons name="ellipse-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.stepTextMuted}>Cosine similarity & threshold classification</Text>
            </View>
            <View style={styles.pipelineStep}>
              <Ionicons name="ellipse-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.stepTextMuted}>Roster cross-checking & draft attendance</Text>
            </View>
          </View>

          {error && <Text style={styles.errorText}>Notice: {error}</Text>}

          <Button
            title="Refresh Status"
            variant="outline"
            onPress={() => reloadReview()}
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // 2. Failed State
  if (status === 'failed') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={`Session #${sessionId}`} subtitle="Failed" canGoBack />
        <View style={styles.failedContainer}>
          <Ionicons name="alert-circle" size={56} color={Colors.danger} />
          <Text style={styles.failedTitle}>Processing Failed</Text>
          <Text style={styles.failedSub}>
            {error || 'The system could not process this classroom image. Please ensure the photo contains visible faces.'}
          </Text>
          <Button
            title="Try Another Photo"
            onPress={() => router.replace('/(tabs)/attendance')}
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // 3. Reviewed / Finalized State
  const isFinalized = status === 'finalized';
  const fullPhotoUrl = reviewData ? `${mediaBaseUrl}${reviewData.photo_url}` : '';

  const flaggedFaces =
    reviewData?.faces.filter(
      (f) => f.classification === 'flagged' || f.classification === 'unmatched'
    ) || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={`Session #${sessionId}`}
        subtitle={`${formatDate(reviewData?.session_date)} • ${status.toUpperCase()}`}
        canGoBack
        rightAction={
          <TouchableOpacity onPress={handleOpenAudit} style={styles.auditHeaderBtn}>
            <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            <Text style={styles.auditHeaderBtnText}>Audit</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Finalized Banner if applicable */}
        {isFinalized && (
          <View style={styles.finalizedBanner}>
            <Ionicons name="lock-closed" size={18} color={Colors.successText} />
            <Text style={styles.finalizedBannerText}>
              Attendance finalized & immutable. Records saved.
            </Text>
          </View>
        )}

        {/* Summary Stat Cards */}
        <View style={styles.summaryGrid}>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.successText }]}>
              {reviewData?.summary.present || 0}
            </Text>
            <Text style={styles.statLabel}>Present</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.warningText }]}>
              {reviewData?.summary.flagged || 0}
            </Text>
            <Text style={styles.statLabel}>Flagged</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.dangerText }]}>
              {isFinalized
                ? reviewData?.summary.absent || reviewData?.summary.not_detected || 0
                : reviewData?.summary.not_detected || 0}
            </Text>
            <Text style={styles.statLabel}>{isFinalized ? 'Absent' : 'Not Detected'}</Text>
          </Card>
        </View>

        {/* Classroom Photo with Interactive Bounding Boxes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Detected Faces in Classroom</Text>
          <Badge label={`${reviewData?.faces.length || 0} Faces`} variant="info" />
        </View>

        {fullPhotoUrl ? (
          <FaceBoundingBoxOverlay
            photoUrl={fullPhotoUrl}
            faces={reviewData?.faces || []}
            selectedFaceId={selectedFaceId}
            onSelectFace={(face) => setSelectedFaceId(face.id)}
          />
        ) : null}

        {/* Flagged / Ambiguous Faces Section (Only during review) */}
        {!isFinalized && flaggedFaces.length > 0 && (
          <View style={styles.flaggedSection}>
            <View style={styles.flaggedSectionHeader}>
              <Ionicons name="warning" size={20} color={Colors.warning} />
              <Text style={styles.flaggedSectionTitle}>
                Action Required: {flaggedFaces.length} Flagged Face(s)
              </Text>
            </View>
            <Text style={styles.flaggedSub}>
              Confirm identity, reject false detections, or reassign to the correct student.
            </Text>

            {flaggedFaces.map((face) => (
              <FlaggedFaceCard
                key={face.id}
                face={face}
                mediaBaseUrl={mediaBaseUrl}
                roster={roster}
                onConfirm={handleConfirmFace}
                onReject={handleRejectFace}
                onReassign={handleReassignFace}
              />
            ))}
          </View>
        )}

        {/* Full Roster Status Checklist */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionTitle}>Attendance Roster</Text>
        </View>

        <RosterChecklist
          roster={roster}
          faces={reviewData?.faces || []}
          notDetected={reviewData?.not_detected || []}
          isFinalized={isFinalized}
        />

        {/* Bottom Actions */}
        {!isFinalized && (
          <View style={styles.finalizeSection}>
            <Button
              title="Finalize Attendance"
              onPress={handleFinalize}
              loading={isSubmitting}
              size="lg"
              icon={<Ionicons name="checkmark-done" size={20} color={Colors.textInverse} />}
            />
            <Text style={styles.finalizeHelper}>
              Finalizing locks the attendance records and marks all unresolved/missing students as absent.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Audit Modal */}
      <AuditModal
        visible={auditVisible}
        logs={auditLogs}
        onClose={() => setAuditVisible(false)}
      />
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
  auditHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  auditHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  processingSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: Spacing.xl,
  },
  pipelineCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  stepTextMuted: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  failedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  failedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.danger,
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  failedSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  finalizedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successSurface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  finalizedBannerText: {
    color: Colors.successText,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  statNum: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  flaggedSection: {
    marginTop: Spacing.xl,
  },
  flaggedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  flaggedSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.warningText,
  },
  flaggedSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  finalizeSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
  },
  finalizeHelper: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
  errorText: {
    color: Colors.danger,
    marginTop: Spacing.md,
    fontSize: 13,
  },
});
