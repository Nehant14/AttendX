/**
 * Camera & Image Picker helper with permissions
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export interface PickedImage {
  uri: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
}

export async function pickImageFromGallery(allowsMultiple = false): Promise<PickedImage[]> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'AttendX requires photo library access to select classroom or student enrollment photos.'
        );
        return [];
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: allowsMultiple,
      quality: 0.9,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    return result.assets.map((asset, index) => {
      const uri = asset.uri;
      const filename = uri.split('/').pop() || `image_${Date.now()}_${index}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      return {
        uri,
        name: filename,
        type,
        width: asset.width,
        height: asset.height,
      };
    });
  } catch (error: any) {
    console.warn('Error picking image from gallery:', error);
    Alert.alert('Error', error.message || 'Failed to select image from gallery');
    return [];
  }
}

export async function takePhotoWithCamera(): Promise<PickedImage | null> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'AttendX requires camera access to take classroom or student enrollment photos.'
        );
        return null;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const uri = asset.uri;
    const filename = uri.split('/').pop() || `camera_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const type = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    return {
      uri,
      name: filename,
      type,
      width: asset.width,
      height: asset.height,
    };
  } catch (error: any) {
    console.warn('Error capturing photo:', error);
    Alert.alert('Error', error.message || 'Failed to capture photo with camera');
    return null;
  }
}
