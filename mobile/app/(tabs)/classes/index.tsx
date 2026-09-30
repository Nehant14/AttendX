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
import { useClasses } from '@/hooks/useClasses';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { formatDate } from '@/utils/formatters';

export default function ClassesListScreen() {
  const router = useRouter();
  const { classes, isLoading, createClass } = useClasses();

  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newClassName.trim()) {
      setErrorMsg('Please enter a class name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await createClass(newClassName.trim());
      setNewClassName('');
      setModalVisible(false);
      Alert.alert('Success', `Class "${created.name}" created successfully!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create class');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Classes"
        subtitle="Manage courses and student rosters"
        rightAction={
          <Button
            title="Create"
            onPress={() => setModalVisible(true)}
            size="sm"
            icon={<Ionicons name="add" size={18} color={Colors.textInverse} />}
          />
        }
      />

      <FlatList
        data={classes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card
            style={styles.classCard}
            onPress={() => router.push(`/(tabs)/classes/${item.id}`)}
          >
            <View style={styles.classRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="school" size={24} color={Colors.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.className}>{item.name}</Text>
                <Text style={styles.classMeta}>
                  Class ID: #{item.id} • Created {formatDate(item.created_at)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="book-outline"
              title="No Classes Configured"
              description="Create a class to assign student rosters and start automated attendance."
              actionTitle="Create First Class"
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
      />

      {/* Create Class Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Class</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {errorMsg && <Text style={styles.modalError}>{errorMsg}</Text>}

            <Input
              label="Course / Class Name"
              placeholder="e.g. CS201: Data Structures"
              value={newClassName}
              onChangeText={setNewClassName}
              autoFocus
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Create Class"
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
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  classCard: {
    padding: Spacing.md,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  infoCol: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  classMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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
