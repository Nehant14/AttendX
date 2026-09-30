import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  LayoutChangeEvent,
  ActivityIndicator,
} from 'react-native';
import { DetectedFaceOut } from '@/types/api';
import { Colors, BorderRadius } from '@/constants/theme';

interface FaceBoundingBoxOverlayProps {
  photoUrl: string;
  faces: DetectedFaceOut[];
  selectedFaceId?: number | null;
  onSelectFace: (face: DetectedFaceOut) => void;
}

export const FaceBoundingBoxOverlay: React.FC<FaceBoundingBoxOverlayProps> = ({
  photoUrl,
  faces,
  selectedFaceId,
  onSelectFace,
}) => {
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [imageLoading, setImageLoading] = useState(true);

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerWidth(width);
    setContainerHeight(height);
  };

  const getFaceColor = (face: DetectedFaceOut): string => {
    if (!face.quality_passed) {
      return Colors.danger;
    }
    switch (face.classification) {
      case 'present':
        return Colors.success;
      case 'flagged':
        return Colors.warning;
      case 'unmatched':
      default:
        return Colors.textMuted;
    }
  };

  const renderBoundingBoxes = () => {
    if (!naturalWidth || !naturalHeight || containerWidth === 0 || containerHeight === 0) {
      return null;
    }

    // Since resizeMode is contain
    const imgAspect = naturalWidth / naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > imgAspect) {
      // Height is constrained
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imgAspect;
      offsetX = (containerWidth - renderedWidth) / 2;
    } else {
      // Width is constrained
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imgAspect;
      offsetY = (containerHeight - renderedHeight) / 2;
    }

    const scaleX = renderedWidth / naturalWidth;
    const scaleY = renderedHeight / naturalHeight;

    return faces.map((face) => {
      const box = face.bbox;
      const left = offsetX + box.x * scaleX;
      const top = offsetY + box.y * scaleY;
      const width = box.width * scaleX;
      const height = box.height * scaleY;

      const isSelected = selectedFaceId === face.id;
      const borderColor = getFaceColor(face);

      return (
        <TouchableOpacity
          key={`face-${face.id}`}
          activeOpacity={0.8}
          onPress={() => onSelectFace(face)}
          style={[
            styles.box,
            {
              left,
              top,
              width: Math.max(width, 24),
              height: Math.max(height, 24),
              borderColor: isSelected ? Colors.primaryLight : borderColor,
              borderWidth: isSelected ? 3 : 2,
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
            },
          ]}
        >
          {face.matched_student_name && (
            <View style={[styles.nameTag, { backgroundColor: borderColor }]}>
              <Text style={styles.nameText} numberOfLines={1}>
                {face.matched_student_name}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <Image
        source={{ uri: photoUrl }}
        style={styles.image}
        resizeMode="contain"
        onLoadStart={() => setImageLoading(true)}
        onLoad={(e) => {
          setImageLoading(false);
          const { width, height } = e.nativeEvent.source;
          setNaturalWidth(width);
          setNaturalHeight(height);
        }}
      />
      {imageLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}
      {renderBoundingBoxes()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 260,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  box: {
    position: 'absolute',
    borderRadius: 4,
  },
  nameTag: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
