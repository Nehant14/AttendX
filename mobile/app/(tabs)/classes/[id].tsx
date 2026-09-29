import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClasses } from '@/hooks/useClasses';
import { useStudents } from '@/hooks/useStudents';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingView } from '@/components/ui/LoadingView';
import { RosterStudentOut } from '@/types/api';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function ClassDetailsScreen() {
  const { id } = useLocalSearchParams();
  const classId = Number(id);
  const router = useRouter();

  const { classes, getRoster, addToRoster } = useClasses();
  const { students } = useStudents();

  const [roster, setRoster] = useState<RosterStudentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentClass = classes.find((c) => c.id === classId);

  const loadClassRoster = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const data = await getRoster(classId);
      setRoster(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch roster');
    } finally {
      setLoading(false);
    }
  }, [classId, getRoster]);

  useEffect(() => {
    loadClassRoster();
  }, [loadClassRoster]);

  const toggleStudentSelection = (studentId: number) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
    } else {
      setSelectedStudentIds((prev) => [...prev, studentId]);
    }
  };

  const handleSaveRoster = async () => {
    if (selectedStudentIds.length === 0) {
      Alert.alert('Selection Empty', 'Please select at least one student to add.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addToRoster(classId, selectedStudentIds);
      setSelectedStudentIds([]);
      setAddModalVisible(false);
      await loadClassRoster();
      Alert.alert('Success', 'Students added to class roster.');
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to add students to roster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available students not already on the roster
  const existingRosterIds = new Set(roster.map((s) => s.id));
  const availableStudents = students.filter((s) => !existingRosterIds.has(s.id));

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={currentClass?.name || `Class #${classId}`}
        subtitle={`Class ID: ${classId}`}
        canGoBack
        rightAction={
          <TouchableOpacity
            style={styles.addRosterBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add" size={18} color={Colors.primary} />
            <Text style={styles.addRosterBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {/* Action Banner to Take Attendance */}
      <View style={styles.actionBanner}>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>Class Session</Text>
          <Text style={styles.bannerSub}>{roster.length} registered students</Text>
        </View>
        <Button
          title="Start Attendance"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/attendance',
              params: { preselectedClassId: String(classId) },
            })
          }
          size="sm"
          icon={<Ionicons name="camera-outline" size={16} color={Colors.textInverse} />}
        />
      </View>

      {loading ? (
        <LoadingView message="Loading class roster..." />
      ) : (
        <FlatList
          data={roster}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Card style={styles.studentCard}>
              <View style={styles.studentRow}>
                <View style={styles.indexCircle}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={styles.studentDetails}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <Text style={styles.studentRoll}>Roll No: {item.roll_no}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/(tabs)/students/${item.roll_no}`)}
                  style={styles.viewStudentBtn}
                >
                  <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Class Roster is Empty"
              description="Add students to this class roster so AttendX can verify them against classroom photos."
              actionTitle="Add Students Now"
              onAction={() => setAddModalVisible(true)}
            />
          }
        />
      )}

      {/* Add Students to Roster Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add to Class Roster</Text>
                <Text style={styles.modalSubtitle}>Select students to enroll in this course</Text>
              </View>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableStudents}
              keyExtractor={(item) => String(item.id)}
              style={styles.availableList}
              renderItem={({ item }) => {
                const isSelected = selectedStudentIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.selectableItem, isSelected && styles.selectableItemSelected]}
                    onPress={() => toggleStudentSelection(item.id)}
                  >
                    <View style={styles.selectCheckbox}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                    </View>
                    <View style={styles.selectableInfo}>
                      <Text style={styles.selectName}>{item.name}</Text>
                      <Text style={styles.selectRoll}>Roll No: {item.roll_no}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyAvailable}>
                  <Text style={styles.emptyAvailableText}>
                    {students.length === 0
                      ? 'No students created in the system yet. Please create students in the Students tab first.'
                      : 'All existing students are already enrolled in this class roster!'}
                  </Text>
                  {students.length === 0 && (
                    <Button
                      title="Go to Students Tab"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setAddModalVisible(false);
                        router.push('/(tabs)/students');
                      }}
                      style={{ marginTop: Spacing.md }}
                    />
                  )}
                </View>
              }
            />

            {availableStudents.length > 0 && (
              <View style={styles.modalFooter}>
                <Text style={styles.selectionCount}>
                  {selectedStudentIds.length} selected
                </Text>
                <Button
                  title="Add to Roster"
                  onPress={handleSaveRoster}
                  loading={isSubmitting}
                  disabled={selectedStudentIds.length === 0}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  addRosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  addRosterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  bannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  studentCard: {
    padding: Spacing.sm,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  studentRoll: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  viewStudentBtn: {
    padding: Spacing.sm,
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '80%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  availableList: {
    marginTop: Spacing.md,
  },
  selectableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectableItemSelected: {
    backgroundColor: Colors.primarySurface,
  },
  selectCheckbox: {
    marginRight: Spacing.md,
  },
  selectableInfo: {
    flex: 1,
  },
  selectName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  selectRoll: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyAvailable: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyAvailableText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
