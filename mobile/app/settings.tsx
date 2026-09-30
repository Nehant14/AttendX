import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api/auth';
import { Config } from '@/constants/config';
import { normalizeBaseUrl, isValidBaseUrl } from '@/utils/url';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { serverUrl, setServerUrl, professorName, professorId, logout, isAuthenticated } =
    useAuth();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

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
    setHealthStatus(null);
    try {
      // Tests the typed address without saving it, so a typo can't lock you out.
      const res = await authApi.healthCheck(clean);
      if (res && typeof res.status === 'string' && res.status.startsWith('ok')) {
        setHealthStatus('connected');
        Alert.alert('Connection Successful', `Backend at ${clean} is healthy.\nTap "Save URL" to use it.`);
      } else {
        setHealthStatus('error');
        Alert.alert('Unexpected Response', `Server returned: ${JSON.stringify(res)}`);
      }
    } catch (err: any) {
      setHealthStatus('error');
      Alert.alert('Connection Failed', err.message || 'Unable to connect to AttendX server.');
    } finally {
      setTestingHealth(false);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Settings & Network" subtitle="Server configuration and account" canGoBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Professor Profile */}
        {isAuthenticated && (
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="school" size={28} color={Colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.professorName}>{professorName || 'Professor'}</Text>
              <Text style={styles.professorId}>Faculty ID: #{professorId}</Text>
            </View>
          </Card>
        )}

        {Config.USE_MOCK && (
          <View style={styles.mockBanner}>
            <Ionicons name="flask-outline" size={16} color={Colors.warningText} />
            <Text style={styles.mockBannerText}>
              Mock mode is ON (EXPO_PUBLIC_USE_MOCK=true): the app uses built-in demo data and never
              contacts the server.
            </Text>
          </View>
        )}

        {/* Server Configuration */}
        <Text style={styles.sectionTitle}>API Server Configuration</Text>
        <Card style={styles.card}>
          <Text style={styles.cardDesc}>
            Address of the computer running the backend (Docker). On a real phone, connect to the
            same Wi-Fi as that computer and use its LAN IP, e.g.{' '}
            <Text style={{ fontWeight: '700' }}>http://192.168.1.23:8000</Text>. Emulators: Android{' '}
            <Text style={{ fontWeight: '700' }}>http://10.0.2.2:8000</Text>, iOS simulator{' '}
            <Text style={{ fontWeight: '700' }}>http://localhost:8000</Text>.
          </Text>

          <Input
            label="API Base URL"
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="http://192.168.1.23:8000"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            leftIcon={<Ionicons name="link-outline" size={18} color={Colors.textMuted} />}
          />

          <View style={styles.btnRow}>
            <Button
              title="Test Health (/health)"
              variant="outline"
              size="sm"
              onPress={handleTestConnection}
              loading={testingHealth}
              style={styles.actionBtn}
              icon={<Ionicons name="pulse-outline" size={16} color={Colors.primary} />}
            />
            <Button
              title="Save URL"
              size="sm"
              onPress={handleSaveUrl}
              style={styles.actionBtn}
              icon={<Ionicons name="save-outline" size={16} color={Colors.textInverse} />}
            />
          </View>

          {healthStatus === 'connected' && (
            <View style={styles.healthSuccess}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.healthSuccessText}>Backend connected and healthy</Text>
            </View>
          )}

          {healthStatus === 'error' && (
            <View style={styles.healthError}>
              <Ionicons name="close-circle" size={16} color={Colors.danger} />
              <Text style={styles.healthErrorText}>Cannot reach backend server</Text>
            </View>
          )}
        </Card>

        {/* Pipeline Info */}
        <Text style={styles.sectionTitle}>Recognition Pipeline Architecture</Text>
        <Card style={styles.card}>
          <Text style={styles.infoRowTitle}>ML Pipeline Stages:</Text>
          <Text style={styles.pipelineDesc}>
            1. Face Detection (RetinaFace / OpenCV)
            {'\n'}2. Quality Check Gate (Laplacian blur & size filters)
            {'\n'}3. Face Embedding (InsightFace / ArcFace / FaceNet)
            {'\n'}4. Cosine Similarity Matching against Roster
            {'\n'}5. Confidence Classification (Present, Flagged, Unmatched)
            {'\n'}6. Human-in-the-Loop Review & Resolution
            {'\n'}7. Cryptographic Immutable Audit Logging
          </Text>
        </Card>

        {/* Sign Out Button */}
        {isAuthenticated && (
          <Button
            title="Sign Out"
            variant="danger"
            size="lg"
            onPress={handleLogout}
            style={styles.logoutBtn}
            icon={<Ionicons name="log-out-outline" size={20} color={Colors.textInverse} />}
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  professorName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  professorId: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
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
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
  healthSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.successSurface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  healthSuccessText: {
    fontSize: 12,
    color: Colors.successText,
    fontWeight: '600',
  },
  healthError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dangerSurface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  healthErrorText: {
    fontSize: 12,
    color: Colors.dangerText,
    fontWeight: '600',
  },
  infoRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  pipelineDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  logoutBtn: {
    marginTop: Spacing.xl,
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
