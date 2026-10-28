import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors, BorderRadius, Shadows } from '@/constants/theme';
import { ConnectionModal } from './ConnectionModal';

export const ConnectionStatusBanner: React.FC = () => {
  const { connectionStatus, connectionLatency } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  const isConnected = connectionStatus === 'connected';
  const isTesting = connectionStatus === 'testing';

  return (
    <>
      <TouchableOpacity
        style={[
          styles.chip,
          isConnected ? styles.chipConnected : styles.chipDisconnected,
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.dot,
            {
              backgroundColor: isTesting
                ? Colors.warning
                : isConnected
                ? Colors.success
                : Colors.danger,
            },
          ]}
        />
        <Text style={styles.text} numberOfLines={1}>
          {isTesting
            ? 'Checking Backend...'
            : isConnected
            ? `Backend Live ${connectionLatency !== null ? `(${connectionLatency}ms)` : ''}`
            : 'Backend Offline • Tap to Connect'}
        </Text>
        <Ionicons name="wifi-outline" size={13} color={Colors.textSecondary} />
      </TouchableOpacity>

      <ConnectionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'center',
    ...Shadows.sm,
  },
  chipConnected: {
    backgroundColor: Colors.successSurface,
    borderColor: '#A7F3D0',
  },
  chipDisconnected: {
    backgroundColor: Colors.dangerSurface,
    borderColor: '#FECACA',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
