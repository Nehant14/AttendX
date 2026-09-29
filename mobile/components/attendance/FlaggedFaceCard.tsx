import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Modal, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DetectedFaceOut, RosterStudentOut } from '@/types/api';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatPercentage } from '@/utils/formatters';

interface FlaggedFaceCardProps {
  face: DetectedFaceOut;
  mediaBaseUrl: string;
  roster: RosterStudentOut[];
  onConfirm: (faceId: number) => Promise<void>;
  onReject: (faceId: number) => Promise<void>;
  onReassign: (faceId: number, studentId: number) => Promise<void>;
}

export const FlaggedFaceCard: React.FC<FlaggedFaceCardProps> = ({
  face,
  mediaBaseUrl,
  roster,
  onConfirm,
  onReject,
  onReassign,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);

  // Compute crop URL: crop_path is stored on disk like "session1_face0_xyz.jpg" or full path
  const cropFilename = face.crop_path ? face.crop_path.split(/[\\/]/).pop() : null;
  const cropUrl = cropFilename ? `${mediaBaseUrl}/media/crops/${cropFilename}` : null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(face.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject(face.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectReassign = async (studentId: number) => {
    setReassignModalVisible(false);
    setIsSubmitting(true);
    try {
      await onReassign(face.id, studentId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {cropUrl ? (
          <Image source={{ uri: cropUrl }} style={styles.cropImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cropImage, styles.cropPlaceholder]}>
            <Ionicons name="person" size={28} color={Colors.textMuted} />
          </View>
        )}

        <View style={styles.details}>
          <View style={styles.headerRow}>
            <Text style={styles.studentName} numberOfLines={1}>
              {face.matched_student_name || 'Unidentified Face'}
            </Text>
            <Badge label={face.classification || 'Unmatched'} variant={face.classification || 'info'} />
          </View>

          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>
              Match: <Text style={styles.metricVal}>{formatPercentage(face.match_score)}</Text>
            </Text>
            <Text style={styles.metricDivider}>•</Text>
            <Text style={styles.metricText}>
              Quality: <Text style={face.quality_passed ? styles.metricVal : styles.metricValDanger}>
                {face.quality_passed ? 'Pass' : face.quality_reject_reason || 'Fail'}
              </Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Button
          title="Confirm"
          onPress={handleConfirm}
          size="sm"
          disabled={isSubmitting}
          style={styles.actionBtn}
          icon={<Ionicons name="checkmark" size={16} color={Colors.textInverse} />}
        />
        <Button
          title="Reject"
          onPress={handleReject}
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          style={styles.actionBtn}
          icon={<Ionicons name="close" size={16} color={Colors.danger} />}
        />
        <Button
          title="Reassign"
          onPress={() => setReassignModalVisible(true)}
          variant="secondary"
          size="sm"
          disabled={isSubmitting}
          style={styles.actionBtn}
          icon={<Ionicons name="swap-horizontal" size={16} color={Colors.primary} />}
        />
      </View>

      {/* Modal for selecting another student from roster to reassign */}
      <Modal
        visible={reassignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReassignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reassign to Student</Text>
              <TouchableOpacity onPress={() => setReassignModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={roster}
              keyExtractor={(item) => String(item.id)}
              style={styles.rosterList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.rosterItem}
                  onPress={() => handleSelectReassign(item.id)}
                >
                  <View>
                    <Text style={styles.rosterName}>{item.name}</Text>
                    <Text style={styles.rosterRoll}>{item.roll_no}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyRoster}>No students in this class roster.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cropImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.borderLight,
  },
  cropPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metricText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metricVal: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  metricValDanger: {
    fontWeight: '600',
    color: Colors.danger,
  },
  metricDivider: {
    marginHorizontal: 6,
    color: Colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.card,
    width: '100%',
    maxHeight: '80%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rosterList: {
    marginTop: Spacing.sm,
  },
  rosterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rosterName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rosterRoll: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyRoster: {
    padding: Spacing.lg,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
});
