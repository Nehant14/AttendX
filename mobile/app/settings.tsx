import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api/auth';
import { Config, NETWORK_PRESETS } from '@/constants/config';
import { normalizeBaseUrl, isValidBaseUrl } from '@/utils/url';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    serverUrl,
    setServerUrl,
    professorName,
    professorId,
    studentRollNo,
    studentName,
    userRole,
    switchRole,
    logout,
    isAuthenticated,
    connectionStatus,
    connectionLatency,
    connectionError,
    testConnection,
  } = useAuth();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [testingHealth, setTestingHealth] = useState(false);

  const handleSaveUrl = async () => {
    if (!isValidBaseUrl(inputUrl)) {
      Alert.alert(
        'Invalid URL',
        'Enter the computer\'s address including the port, e.g. http://192.168.1.23:8000'
      );
      return;
    }
    const clean = normalizeBaseUrl(inputUrl);
    await setServerUrl(clean);
    setInputUrl(clean);
    Alert.alert('Saved', `API Base URL updated to: ${clean}`);
  };

  const handleTestConnection = async () => {
    if (!isValidBaseUrl(inputUrl)) {
      Alert.alert(
        'Invalid URL',
        'Enter the computer\'s address including the port, e.g. http://192.168.1.23:8000'
      );
      return;
    }
    const clean = normalizeBaseUrl(inputUrl);
    setTestingHealth(true);
    try {
      // Tests the typed address without saving it first, so a typo can't lock you out
      const res = await authApi.healthCheck(clean);
      if (res && typeof res.status === 'string' && res.status.startsWith('ok')) {
        await setServerUrl(clean);
        setInputUrl(clean);
        Alert.alert(
          'Backend Connected',
          `Successfully connected to FastAPI backend!\nEndpoint: ${clean}\nStatus: ${res.status}`
        );
      } else {
        Alert.alert(
          'Connection Failed',
          `Could not connect to ${clean}.\n\nMake sure the Docker backend is running and your mobile device is on the same network.`
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Connection Failed',
        `${err?.message || 'Backend unreachable.'}\n\nMake sure the Docker backend is running and your mobile device is on the same network.`
      );
    } finally {
      setTestingHealth(false);
    }
  };

  const handleApplyPreset = async (url: string) => {
    setInputUrl(url);
    await setServerUrl(url);
  };

  const handleRoleToggle = async () => {
    const nextRole = userRole === 'professor' ? 'student' : 'professor';
    await switchRole(nextRole);
    if (nextRole === 'student') {
      router.replace('/(tabs)/student-portal');
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Settings & Network" subtitle="Backend connectivity & profile" canGoBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active Profile Card */}
        {isAuthenticated && (
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons
                name={userRole === 'professor' ? 'school' : 'person'}
                size={26}
                color={userRole === 'professor' ? Colors.primary : Colors.accent}
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userRole === 'professor' ? professorName || 'Professor' : studentName || 'Student'}
              </Text>
              <Text style={styles.profileSub}>
                {userRole === 'professor'
                  ? `Faculty ID: #${professorId || 'Active'}`
                  : `Roll No: ${studentRollNo || 'Unassigned'}`}
              </Text>
            </View>
            <TouchableOpacity style={styles.roleBadgeBtn} onPress={handleRoleToggle}>
              <Badge
                label={userRole === 'professor' ? 'Faculty' : 'Student'}
                variant={userRole === 'professor' ? 'info' : 'present'}
              />
            </TouchableOpacity>
          </Card>
        )}

        {/* Mock Mode Banner if active */}
        {Config.USE_MOCK && (
          <View style={styles.mockBanner}>
            <Ionicons name="flask-outline" size={16} color={Colors.warningText} />
            <Text style={styles.mockBannerText}>
              Mock mode is ON (EXPO_PUBLIC_USE_MOCK=true): the app uses built-in demo data and never
              contacts the server.
            </Text>
          </View>
        )}

        {/* Backend & Device Connection Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Backend Connectivity</Text>
          <Badge
            label={isConnected ? `Live (${connectionLatency}ms)` : 'Offline'}
            variant={isConnected ? 'present' : 'absent'}
          />
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardDesc}>
            Verify your mobile device can reach the AttendX FastAPI server running inside Docker.
          </Text>

          {/* Connected / Not Connected Status Banner */}
          <View
            style={[
              styles.connectionBanner,
              isConnected ? styles.bannerSuccess : styles.bannerDanger,
            ]}
          >
            <Ionicons
              name={isConnected ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={isConnected ? Colors.successText : Colors.dangerText}
            />
            <View style={styles.bannerInfo}>
              <Text
                style={[
                  styles.bannerStatus,
                  { color: isConnected ? Colors.successText : Colors.dangerText },
                ]}
              >
                {isConnected ? 'FastAPI Backend Reachable' : 'Backend Not Reachable'}
              </Text>
              <Text style={styles.bannerSub}>
                {isConnected
                  ? `Latency: ${connectionLatency}ms • Health endpoint verified (/health: 200 OK)`
                  : connectionError || 'Could not establish connection to the server.'}
              </Text>
            </View>
          </View>

          {/* Test Health Check Button */}
          <Button
            title="Check Backend Connection (/health)"
            onPress={handleTestConnection}
            loading={testingHealth}
            size="md"
            icon={<Ionicons name="pulse" size={18} color={Colors.textInverse} />}
            style={styles.checkBtn}
          />

          {/* Quick Presets */}
          <Text style={styles.subLabel}>Network Presets:</Text>
          <View style={styles.presetGrid}>
            {NETWORK_PRESETS.map((preset) => {
              const isSelected = serverUrl === preset.url;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                  onPress={() => handleApplyPreset(preset.url)}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetTop}>
                    <Text style={[styles.presetTitle, isSelected && styles.presetTitleActive]}>
                      {preset.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    )}
                  </View>
                  <Text style={styles.presetUrl}>{preset.url}</Text>
                  <Text style={styles.presetDesc}>{preset.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Host Input */}
          <Text style={[styles.subLabel, { marginTop: Spacing.md }]}>Custom URL:</Text>
          <View style={styles.customUrlRow}>
            <TextInput
              style={styles.urlInput}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.1.X:8000"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button
              title="Apply"
              size="sm"
              onPress={handleSaveUrl}
            />
          </View>
        </Card>

        {/* Diagnostic Tips Card */}
        <Card style={styles.tipsCard}>
          <Text style={styles.tipsHeading}>Device Connection Guide:</Text>
          <Text style={styles.tipsText}>
            • <Text style={{ fontWeight: '700' }}>Physical Phones (iOS/Android):</Text> Connect phone to the same Wi-Fi as your computer and select the Wi-Fi LAN preset ({NETWORK_PRESETS[0].url}).
            {'\n'}• <Text style={{ fontWeight: '700' }}>Docker Backend:</Text> Must be running via <Text style={{ fontFamily: 'monospace' }}>docker compose up</Text> exposing port 8000.
          </Text>
        </Card>

        {/* Switch Portal Button */}
        <Button
          title={userRole === 'professor' ? 'Switch to Student Portal' : 'Switch to Faculty Dashboard'}
          variant="outline"
          size="md"
          onPress={handleRoleToggle}
          icon={<Ionicons name="repeat-outline" size={18} color={Colors.primary} />}
          style={styles.switchPortalBtn}
        />

        {/* Sign Out Button */}
        {isAuthenticated && (
          <Button
            title="Sign Out"
            variant="danger"
            size="md"
            onPress={handleLogout}
            icon={<Ionicons name="log-out-outline" size={18} color={Colors.textInverse} />}
            style={styles.logoutBtn}
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  profileSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadgeBtn: {
    padding: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  bannerSuccess: {
    backgroundColor: Colors.successSurface,
    borderColor: '#A7F3D0',
  },
  bannerDanger: {
    backgroundColor: Colors.dangerSurface,
    borderColor: '#FECACA',
  },
  bannerInfo: {
    flex: 1,
  },
  bannerStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  checkBtn: {
    marginBottom: Spacing.md,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  presetGrid: {
    gap: Spacing.sm,
  },
  presetCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetCardActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  presetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  presetTitleActive: {
    color: Colors.primary,
  },
  presetUrl: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  presetDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  customUrlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  urlInput: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  tipsHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  switchPortalBtn: {
    marginBottom: Spacing.sm,
  },
  logoutBtn: {
    marginTop: Spacing.sm,
  },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.warningSurface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  mockBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.warningText,
    fontWeight: '600',
  },
});
