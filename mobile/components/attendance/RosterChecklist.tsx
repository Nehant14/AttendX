import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RosterStudentOut, DetectedFaceOut, NotDetectedStudentOut } from '@/types/api';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';

interface RosterChecklistProps {
  roster: RosterStudentOut[];
  faces: DetectedFaceOut[];
  notDetected: NotDetectedStudentOut[];
  isFinalized: boolean;
}

type FilterTab = 'all' | 'present' | 'flagged' | 'not_detected';

export const RosterChecklist: React.FC<RosterChecklistProps> = ({
  roster,
  faces,
  notDetected,
  isFinalized,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Compute status map for each student in the roster
  const studentStatusMap: Record<
    number,
    { status: 'present' | 'flagged' | 'not_detected' | 'absent'; confidence?: number | null }
  > = {};

  faces.forEach((f) => {
    if (f.matched_student_id) {
      if (f.classification === 'present') {
        studentStatusMap[f.matched_student_id] = {
          status: 'present',
          confidence: f.match_score,
        };
      } else if (f.classification === 'flagged') {
        studentStatusMap[f.matched_student_id] = {
          status: 'flagged',
          confidence: f.match_score,
        };
      }
    }
  });

  notDetected.forEach((nd) => {
    if (!studentStatusMap[nd.student_id]) {
      studentStatusMap[nd.student_id] = {
        status: isFinalized ? 'absent' : 'not_detected',
      };
    }
  });

  // Students on roster that might not be in notDetected or faces
  roster.forEach((student) => {
    if (!studentStatusMap[student.id]) {
      studentStatusMap[student.id] = {
        status: isFinalized ? 'absent' : 'not_detected',
      };
    }
  });

  const getStudentStatus = (studentId: number) => {
    return studentStatusMap[studentId] || { status: isFinalized ? 'absent' : 'not_detected' };
  };

  const filteredRoster = roster.filter((student) => {
    if (activeTab === 'all') return true;
    const { status } = getStudentStatus(student.id);
    if (activeTab === 'not_detected') {
      return status === 'not_detected' || status === 'absent';
    }
    return status === activeTab;
  });

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'present', 'flagged', 'not_detected'] as FilterTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label =
            tab === 'all'
              ? 'All'
              : tab === 'not_detected'
              ? isFinalized
                ? 'Absent'
                : 'Not Detected'
              : tab.charAt(0).toUpperCase() + tab.slice(1);

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={filteredRoster}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const { status, confidence } = getStudentStatus(item.id);

          return (
            <View style={styles.studentRow}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentRoll}>Roll No: {item.roll_no}</Text>
              </View>
              <View style={styles.statusCol}>
                <Badge label={status.replace('_', ' ')} variant={status} />
                {confidence !== undefined && confidence !== null && (
                  <Text style={styles.confidenceText}>{(confidence * 100).toFixed(0)}% match</Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No students in this filter.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  studentRoll: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusCol: {
    alignItems: 'flex-end',
  },
  confidenceText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
