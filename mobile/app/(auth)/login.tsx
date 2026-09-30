import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, serverUrl } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify credentials.';
      setErrorMessage(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Server Config Indicator */}
          <TouchableOpacity
            style={styles.serverChip}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="server-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.serverChipText} numberOfLines={1}>
              {serverUrl}
            </Text>
            <Ionicons name="settings-outline" size={12} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="scan-outline" size={38} color={Colors.primary} />
            </View>
            <Text style={styles.appTitle}>AttendX</Text>
            <Text style={styles.appSubtitle}>
              Face Recognition Attendance System for Professors
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign In</Text>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            <Input
              label="Email Address"
              placeholder="professor@university.edu"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              size="lg"
              style={styles.submitBtn}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.linkText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  serverChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  serverChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 220,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerSurface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    color: Colors.dangerText,
    fontSize: 13,
    flex: 1,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
