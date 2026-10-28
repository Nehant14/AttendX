import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { NETWORK_PRESETS } from '@/constants/config';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { Button } from './Button';

interface ConnectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ visible, onClose }) => {
  const {
    serverUrl,
    setServerUrl,
    connectionStatus,
    connectionLatency,
    connectionError,
    testConnection,
  } = useAuth();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      if (inputUrl.trim() !== serverUrl) {
        await setServerUrl(inputUrl.trim());
      } else {
        await testConnection();
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSelectPreset = async (url: string) => {
    setInputUrl(url);
    setTesting(true);
    try {
      await setServerUrl(url);
    } finally {
      setTesting(false);
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="server" size={20} color={Colors.primary} />
              <Text style={styles.title}>Backend Connection</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View
              style={[
                styles.statusCard,
                isConnected ? styles.statusCardSuccess : styles.statusCardDanger,
              ]}
            >
              <View style={styles.statusRow}>
                <Ionicons
                  name={isConnected ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={isConnected ? Colors.successText : Colors.dangerText}
                />
                <View style={styles.statusInfo}>
                  <Text
                    style={[
                      styles.statusTitle,
                      { color: isConnected ? Colors.successText : Colors.dangerText },
                    ]}
                  >
                    {testing
                      ? 'Pinging Server...'
                      : isConnected
                      ? 'Connected & Healthy'
                      : 'Not Connected'}
                  </Text>
                  <Text style={styles.statusSub}>
                    {isConnected && connectionLatency !== null
                      ? `FastAPI responded in ${connectionLatency}ms • GET /health: 200 OK`
                      : connectionError || 'FastAPI backend is unreachable on this network.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Test Action */}
            <Button
              title="Ping Backend (/health)"
              onPress={handleTest}
              loading={testing}
              size="md"
              style={styles.testBtn}
              icon={<Ionicons name="pulse" size={18} color={Colors.textInverse} />}
            />

            {/* Network Presets */}
            <Text style={styles.sectionLabel}>Quick Network Presets</Text>
            <View style={styles.presetList}>
              {NETWORK_PRESETS.map((preset) => {
                const isActive = serverUrl === preset.url;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.presetCard, isActive && styles.presetCardActive]}
                    onPress={() => handleSelectPreset(preset.url)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetHeader}>
                      <Text style={[styles.presetName, isActive && styles.presetNameActive]}>
                        {preset.name}
                      </Text>
                      {isActive && (
                        <View style={styles.activeTag}>
                          <Text style={styles.activeTagText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.presetUrl}>{preset.url}</Text>
                    <Text style={styles.presetDesc}>{preset.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom URL Input */}
            <Text style={styles.sectionLabel}>Custom Endpoint</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.urlInput}
                value={inputUrl}
                onChangeText={setInputUrl}
                placeholder="http://192.168.1.X:8000"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                title="Save"
                size="sm"
                onPress={async () => {
                  await setServerUrl(inputUrl.trim());
                  handleTest();
                }}
              />
            </View>

            {/* Diagnostic Tips */}
            {!isConnected && (
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>💡 Physical Device Troubleshooting</Text>
                <Text style={styles.tipItem}>
                  1. <Text style={styles.bold}>Docker Backend:</Text> Ensure the FastAPI container is running (`docker compose up`).
                </Text>
                <Text style={styles.tipItem}>
                  2. <Text style={styles.bold}>Same Wi-Fi:</Text> Verify your phone and computer are connected to the same Wi-Fi network.
                </Text>
                <Text style={styles.tipItem}>
                  3. <Text style={styles.bold}>Host Firewall:</Text> Ensure Windows/macOS Firewall permits incoming connections on port 8000.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '88%',
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  body: {
    marginTop: Spacing.md,
  },
  statusCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statusCardSuccess: {
    backgroundColor: Colors.successSurface,
    borderColor: '#A7F3D0',
  },
  statusCardDanger: {
    backgroundColor: Colors.dangerSurface,
    borderColor: '#FECACA',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  testBtn: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  presetList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  presetCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetCardActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  presetName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  presetNameActive: {
    color: Colors.primary,
  },
  activeTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  activeTagText: {
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
  presetUrl: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  presetDesc: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  urlInput: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.surface,
    borderWidth: 1.2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  tipsBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: Spacing.xl,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  tipItem: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
});
