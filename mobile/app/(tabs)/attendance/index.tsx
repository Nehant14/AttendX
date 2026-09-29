import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClasses } from '@/hooks/useClasses';
import { useAttendanceSession } from '@/hooks/useAttendanceSession';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { pickImageFromGallery, takePhotoWithCamera, PickedImage } from '@/utils/image';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function AttendanceStartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const preselectedClassId = params.preselectedClassId
    ? Number(params.preselectedClassId)
    : null;

  const { classes, refreshClasses } = useClasses();
  const { startSession, isSubmitting } = useAttendanceSession();

  const [selectedClassId, setSelectedClassId] = useState<number | null>(preselectedClassId);
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [classroomPhoto, setClassroomPhoto] = useState<PickedImage | null>(null);

  useEffect(() => {
    refreshClasses();
  }, [refreshClasses]);

  useEffect(() => {
    if (preselectedClassId) {
      setSelectedClassId(preselectedClassId);
    } else if (classes.length > 0 && selectedClassId === null) {
      setSelectedClassId(classes[0].id);
    }
  }, [preselectedClassId, classes, selectedClassId]);

  const handleCaptureCamera = async () => {
    const photo = await takePhotoWithCamera();
    if (photo) {
      setClassroomPhoto(photo);
    }
  };

  const handlePickGallery = async () => {
    const photos = await pickImageFromGallery(false);
    if (photos.length > 0) {
      setClassroomPhoto(photos[0]);
    }
  };

  const handleStartSession = async () => {
    if (!selectedClassId) {
      Alert.alert('Missing Class', 'Please select a class for this attendance session.');
      return;
    }
    if (!classroomPhoto) {
      Alert.alert('Missing Photo', 'Please capture or select a classroom photo to analyze.');
      return;
    }

    try {
      const sessionId = await startSession(selectedClassId, classroomPhoto, sessionDate);
      setClassroomPhoto(null);
      router.push(`/(tabs)/attendance/session/${sessionId}`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not start attendance session.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Take Attendance"
        subtitle="Capture or upload classroom photo for automated face matching"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Class Selection */}
        <Text style={styles.sectionTitle}>1. Select Course</Text>

        {classes.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No Classes Available"
            description="You must create a class before initiating an attendance session."
            actionTitle="Go to Classes"
            onAction={() => router.push('/(tabs)/classes')}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classSelector}
          >
            {classes.map((c) => {
              const isSelected = selectedClassId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.classChip, isSelected && styles.classChipSelected]}
                  onPress={() => setSelectedClassId(c.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'book-outline'}
                    size={16}
                    color={isSelected ? Colors.textInverse : Colors.textSecondary}
                  />
                  <Text
                    style={[styles.classChipText, isSelected && styles.classChipTextSelected]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Date Selection */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
          2. Session Date
        </Text>
        <Input
          placeholder="YYYY-MM-DD"
          value={sessionDate}
          onChangeText={setSessionDate}
          leftIcon={<Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />}
          helperText="Format: YYYY-MM-DD (Defaults to today)"
        />

        {/* Classroom Photo Capture */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>
          3. Classroom Photo
        </Text>

        <Card style={styles.uploadCard}>
          {classroomPhoto ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: classroomPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => setClassroomPhoto(null)}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={styles.retakeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPromptContainer}>
              <View style={styles.promptIconBadge}>
                <Ionicons name="people-circle-outline" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.promptTitle}>Capture Classroom Photo</Text>
              <Text style={styles.promptSubtitle}>
                Ensure good lighting and wide room coverage so student faces are clearly visible.
              </Text>

              <View style={styles.actionButtonsRow}>
                <Button
                  title="Take Photo"
                  onPress={handleCaptureCamera}
                  icon={<Ionicons name="camera" size={18} color={Colors.textInverse} />}
                  style={styles.actionBtn}
                />
                <Button
                  title="Choose Gallery"
                  onPress={handlePickGallery}
                  variant="outline"
                  icon={<Ionicons name="images" size={18} color={Colors.textPrimary} />}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Start Button */}
        {classroomPhoto && (
          <Button
            title="Start Face Recognition & Verification"
            onPress={handleStartSession}
            loading={isSubmitting}
            size="lg"
            style={styles.startBtn}
            icon={<Ionicons name="sparkles" size={20} color={Colors.textInverse} />}
          />
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  classSelector: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  classChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  classChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  classChipTextSelected: {
    color: Colors.textInverse,
  },
  uploadCard: {
    padding: Spacing.lg,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  photoPromptContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  promptIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  promptSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: Spacing.lg,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.md,
    backgroundColor: '#0F172A',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    padding: Spacing.xs,
  },
  retakeText: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '600',
  },
  startBtn: {
    marginTop: Spacing.xl,
  },
});
