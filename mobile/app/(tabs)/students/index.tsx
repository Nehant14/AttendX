import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStudents } from '@/hooks/useStudents';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function StudentsListScreen() {
  const router = useRouter();
  const { students, isLoading, createStudent } = useStudents();

  const [modalVisible, setModalVisible] = useState(false);
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!rollNo.trim()) {
      setErrorMsg('Please enter Roll Number');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Please enter Student Name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await createStudent(rollNo.trim(), name.trim());
      setRollNo('');
      setName('');
      setModalVisible(false);

      Alert.alert(
        'Student Created',
        `Student "${created.name}" created. Would you like to enroll face photos now?`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Enroll Faces',
            onPress: () => router.push(`/(tabs)/students/${encodeURIComponent(created.roll_no)}`),
          },
        ]
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Students"
        subtitle="Manage student profiles and face biometric enrollment"
        rightAction={
          <Button
            title="Add Student"
            onPress={() => setModalVisible(true)}
            size="sm"
            icon={<Ionicons name="person-add" size={16} color={Colors.textInverse} />}
          />
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by name or roll number..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search-outline" size={18} color={Colors.textMuted} />}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card
            style={styles.studentCard}
            onPress={() => router.push(`/(tabs)/students/${encodeURIComponent(item.roll_no)}`)}
          >
            <View style={styles.studentRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color={Colors.accent} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentRoll}>Roll No: {item.roll_no}</Text>
              </View>
              <View style={styles.enrollChip}>
                <Ionicons name="camera-outline" size={14} color={Colors.primary} />
                <Text style={styles.enrollChipText}>Biometrics</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="No Students Registered"
              description="Add students to create their profile and register 4-6 reference photos for face recognition."
              actionTitle="Add Student"
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
      />

      {/* Add Student Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Student Registration</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {errorMsg && <Text style={styles.modalError}>{errorMsg}</Text>}

            <Input
              label="Roll Number / Student ID"
              placeholder="e.g. 21BCE1001"
              value={rollNo}
              onChangeText={setRollNo}
              autoCapitalize="characters"
            />

            <Input
              label="Full Name"
              placeholder="e.g. Grace Hopper"
              value={name}
              onChangeText={setName}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Create Student"
                onPress={handleCreate}
                loading={isSubmitting}
                style={styles.modalBtn}
              />
            </View>
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
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  studentCard: {
    padding: Spacing.md,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  infoCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  studentRoll: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  enrollChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  enrollChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalError: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
});
