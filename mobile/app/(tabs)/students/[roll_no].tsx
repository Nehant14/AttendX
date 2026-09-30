import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStudents } from '@/hooks/useStudents';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingView } from '@/components/ui/LoadingView';
import { EmbeddingOut, EnrollmentResponse } from '@/types/api';
import { pickImageFromGallery, takePhotoWithCamera, PickedImage } from '@/utils/image';
import { formatDateTime, formatPercentage } from '@/utils/formatters';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function StudentDetailsScreen() {
  const params = useLocalSearchParams();
  const rollNo = decodeURIComponent(String(params.roll_no || ''));

  const { students, enrollPhotos, getEmbeddings } = useStudents();
  const student = students.find((s) => s.roll_no === rollNo);

  const [embeddings, setEmbeddings] = useState<EmbeddingOut[]>([]);
  const [loadingEmbeddings, setLoadingEmbeddings] = useState(true);

  // Enrollment state
  const [selectedPhotos, setSelectedPhotos] = useState<PickedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<EnrollmentResponse | null>(null);

  const loadStudentEmbeddings = useCallback(async () => {
    if (!rollNo) return;
    setLoadingEmbeddings(true);
    try {
      const data = await getEmbeddings(rollNo);
      setEmbeddings(data);
    } catch (err: any) {
      console.warn('Failed to load embeddings:', err);
    } finally {
      setLoadingEmbeddings(false);
    }
  }, [rollNo, getEmbeddings]);

  useEffect(() => {
    loadStudentEmbeddings();
  }, [loadStudentEmbeddings]);

  const handlePickGallery = async () => {
    const images = await pickImageFromGallery(true);
    if (images.length > 0) {
      setSelectedPhotos((prev) => [...prev, ...images].slice(0, 8));
    }
  };

  const handleCaptureCamera = async () => {
    const image = await takePhotoWithCamera();
    if (image) {
      setSelectedPhotos((prev) => [...prev, image].slice(0, 8));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnroll = async () => {
    if (selectedPhotos.length === 0) {
      Alert.alert('No Photos', 'Please select or capture at least one photo (recommended 4-6).');
      return;
    }

    setIsUploading(true);
    setEnrollmentResult(null);
    try {
      const res = await enrollPhotos(rollNo, selectedPhotos);
      setEnrollmentResult(res);
      setSelectedPhotos([]);
      await loadStudentEmbeddings();

      Alert.alert(
        'Enrollment Complete',
        `Accepted ${res.photos_accepted} of ${res.photos_submitted} submitted photos.`
      );
    } catch (err: any) {
      Alert.alert('Enrollment Error', err.message || 'Failed to enroll photos.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={student?.name || rollNo}
        subtitle={`Roll No: ${rollNo}`}
        canGoBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={Colors.accent} />
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.studentName}>{student?.name || 'Student'}</Text>
            <Text style={styles.studentRoll}>Roll Number: {rollNo}</Text>
            <View style={styles.statusRow}>
              <Badge
                label={embeddings.length > 0 ? `${embeddings.length} Embeddings Active` : 'No Biometrics'}
                variant={embeddings.length > 0 ? 'present' : 'flagged'}
              />
            </View>
          </View>
        </Card>

        {/* Existing Embeddings Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Registered Biometric Embeddings</Text>
          <TouchableOpacity onPress={loadStudentEmbeddings}>
            <Ionicons name="refresh" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {loadingEmbeddings ? (
          <LoadingView message="Loading biometric records..." style={{ height: 120 }} />
        ) : embeddings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="scan-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Biometric Data</Text>
            <Text style={styles.emptySub}>
              This student has not yet enrolled reference photos. Upload 4-6 clear photos below to enable automated face matching.
            </Text>
          </Card>
        ) : (
          <View style={styles.embeddingsGrid}>
            {embeddings.map((emb, idx) => (
              <Card key={emb.id} style={styles.embeddingCard}>
                <View style={styles.embeddingRow}>
                  <View style={styles.embBadge}>
                    <Ionicons name="finger-print" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.embInfo}>
                    <Text style={styles.embTitle}>Embedding #{idx + 1}</Text>
                    <Text style={styles.embMeta}>Model: {emb.model_version}</Text>
                    <Text style={styles.embMeta}>Added: {formatDateTime(emb.created_at)}</Text>
                  </View>
                  <View style={styles.qualityCol}>
                    <Text style={styles.qualityLabel}>Quality</Text>
                    <Text style={styles.qualityVal}>{formatPercentage(emb.quality_score)}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Multi-Photo Face Enrollment Section */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionTitle}>Enroll New Face Photos</Text>
        </View>

        <Card style={styles.enrollCard}>
          <Text style={styles.enrollInfo}>
            Upload 4-6 clear photos of the student from different angles (straight, slight left/right) in good lighting.
          </Text>

          {/* Action Buttons for Image Picking */}
          <View style={styles.pickerActions}>
            <Button
              title="Camera"
              onPress={handleCaptureCamera}
              variant="outline"
              size="sm"
              icon={<Ionicons name="camera" size={18} color={Colors.primary} />}
              style={styles.pickerBtn}
            />
            <Button
              title="Gallery"
              onPress={handlePickGallery}
              variant="outline"
              size="sm"
              icon={<Ionicons name="images" size={18} color={Colors.primary} />}
              style={styles.pickerBtn}
            />
          </View>

          {/* Selected Photos Thumbnails */}
          {selectedPhotos.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Text style={styles.thumbnailCount}>
                {selectedPhotos.length} photo(s) selected
              </Text>
              <View style={styles.photoGrid}>
                {selectedPhotos.map((photo, index) => (
                  <View key={photo.uri} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Button
                title={`Enroll ${selectedPhotos.length} Photo${selectedPhotos.length > 1 ? 's' : ''}`}
                onPress={handleEnroll}
                loading={isUploading}
                size="md"
                style={styles.enrollSubmitBtn}
              />
            </View>
          )}

          {/* Enrollment Feedback Results */}
          {enrollmentResult && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={enrollmentResult.photos_accepted > 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={enrollmentResult.photos_accepted > 0 ? Colors.success : Colors.danger}
                />
                <Text style={styles.resultSummaryText}>
                  {enrollmentResult.photos_accepted} of {enrollmentResult.photos_submitted} Photos Accepted
                </Text>
              </View>

              {enrollmentResult.results.map((res, i) => (
                <View key={i} style={styles.resRow}>
                  <Ionicons
                    name={res.accepted ? 'checkmark-outline' : 'close-outline'}
                    size={16}
                    color={res.accepted ? Colors.success : Colors.danger}
                  />
                  <Text style={styles.resFilename} numberOfLines={1}>
                    {res.filename}
                  </Text>
                  <Text style={[styles.resStatus, { color: res.accepted ? Colors.success : Colors.danger }]}>
                    {res.accepted ? `Accepted (${formatPercentage(res.quality_score)})` : res.reject_reason || 'Rejected'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  profileDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  studentRoll: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusRow: {
    marginTop: 6,
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
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  embeddingsGrid: {
    gap: Spacing.xs,
  },
  embeddingCard: {
    padding: Spacing.sm,
  },
  embeddingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  embBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  embInfo: {
    flex: 1,
  },
  embTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  embMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  qualityCol: {
    alignItems: 'flex-end',
  },
  qualityLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  qualityVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.successText,
  },
  enrollCard: {
    padding: Spacing.md,
  },
  enrollInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  pickerBtn: {
    flex: 1,
  },
  thumbnailContainer: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
  thumbnailCount: {
    fontSize: 13,
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
  thumbnailWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
  enrollSubmitBtn: {
    marginTop: Spacing.sm,
  },
  resultContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  resultSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  resFilename: {
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  resStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
});
