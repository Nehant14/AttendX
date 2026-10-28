import React, { useState, useEffect } from 'react';
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
import { cacheStorage } from '@/services/storage/cache';
import { StudentOut } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConnectionStatusBanner } from '@/components/ui/ConnectionStatusBanner';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAsStudent } = useAuth();

  const [activeTab, setActiveTab] = useState<'professor' | 'student'>('professor');

  // Professor fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Student fields
  const [studentRollNo, setStudentRollNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [cachedStudents, setCachedStudents] = useState<StudentOut[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    cacheStorage.getCachedStudents().then(setCachedStudents).catch(() => {});
  }, []);

  const handleProfessorLogin = async () => {
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
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify credentials.';
      setErrorMessage(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentAccess = async () => {
    if (!studentRollNo.trim()) {
      setErrorMessage('Please enter your Student Roll Number');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      await loginAsStudent(studentRollNo.trim(), studentName.trim() || undefined);
      router.replace('/(tabs)/student-portal');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not initialize student session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSelectStudent = (student: StudentOut) => {
    setStudentRollNo(student.roll_no);
    setStudentName(student.name);
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
          showsVerticalScrollIndicator={false}
        >
          {/* Prominent Connection Status Banner */}
          <View style={styles.bannerWrapper}>
            <ConnectionStatusBanner />
          </View>

          {/* App Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="scan-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.appTitle}>AttendX</Text>
            <Text style={styles.appSubtitle}>
              Automated AI Face Recognition Attendance
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Role Switcher Tabs */}
            <View style={styles.roleTabs}>
              <TouchableOpacity
                style={[styles.roleTab, activeTab === 'professor' && styles.roleTabActive]}
                onPress={() => {
                  setActiveTab('professor');
                  setErrorMessage(null);
                }}
              >
                <Ionicons
                  name="school-outline"
                  size={16}
                  color={activeTab === 'professor' ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.roleTabText,
                    activeTab === 'professor' && styles.roleTabTextActive,
                  ]}
                >
                  Faculty Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleTab, activeTab === 'student' && styles.roleTabActive]}
                onPress={() => {
                  setActiveTab('student');
                  setErrorMessage(null);
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={activeTab === 'student' ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.roleTabText,
                    activeTab === 'student' && styles.roleTabTextActive,
                  ]}
                >
                  Student Portal
                </Text>
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            {/* Professor Login Form */}
            {activeTab === 'professor' ? (
              <View>
                <Input
                  label="Academic Email"
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
                  title="Sign In as Professor"
                  onPress={handleProfessorLogin}
                  loading={isLoading}
                  size="lg"
                  style={styles.submitBtn}
                />

                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>New Professor? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                    <Text style={styles.linkText}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Student Access Form */
              <View>
                <Input
                  label="Student Roll Number"
                  placeholder="e.g. 21BCE1001"
                  value={studentRollNo}
                  onChangeText={setStudentRollNo}
                  autoCapitalize="characters"
                  leftIcon={<Ionicons name="card-outline" size={18} color={Colors.textMuted} />}
                />

                <Input
                  label="Full Name (Optional)"
                  placeholder="e.g. Alan Turing"
                  value={studentName}
                  onChangeText={setStudentName}
                  leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
                />

                <Button
                  title="Open Student Dashboard"
                  onPress={handleStudentAccess}
                  loading={isLoading}
                  size="lg"
                  style={styles.submitBtn}
                />

                {/* Quick Select from Registered Students if present */}
                {cachedStudents.length > 0 && (
                  <View style={styles.quickSelectContainer}>
                    <Text style={styles.quickSelectLabel}>Quick Select Registered Student:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.quickChipsRow}>
                        {cachedStudents.slice(0, 5).map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={styles.quickChip}
                            onPress={() => handleQuickSelectStudent(s)}
                          >
                            <Text style={styles.quickChipText}>{s.roll_no}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
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
  bannerWrapper: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  roleTabActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  roleTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
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
    marginTop: Spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  quickSelectContainer: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
  quickSelectLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickChip: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
});
