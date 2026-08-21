import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  ArrowRight,
  Briefcase,
  ShieldCheck,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { startLivePresenceTracking } from '../lib/presenceService';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';

export default function LoginScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(
        language === 'th' ? 'กรุณากรอกข้อมูล' : 'Information Required',
        language === 'th' ? 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน' : 'Please enter your email and password'
      );
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      setLoading(false);

      if (error) {
        Alert.alert(
          language === 'th' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Authentication Failed',
          language === 'th'
            ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบหรือติดต่อผู้ดูแลระบบ'
            : (error.message || 'Invalid email or password. Please check your credentials.')
        );
      } else {
        // Direct every login to PrivacyConsent to review terms and consent
        navigation.reset({
          index: 0,
          routes: [{ name: 'PrivacyConsent' }],
        });
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert(
        language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        err.message || (language === 'th' ? 'ไม่สามารถเชื่อมต่อระบบได้' : 'Unable to connect to server')
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Floating Language Switcher */}
          <View style={styles.topLangBar}>
            <LanguageTogglePill />
          </View>

          <View style={styles.innerContainer}>
            {/* Top: Logo & Branding */}
            <View style={styles.header}>
              <View style={[styles.logoCircle, { backgroundColor: colors.primaryLight }]}>
                <Briefcase size={30} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t('app_title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('app_subtitle')}</Text>
            </View>

            {/* Center: Login Card */}
            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('login_email_label')}</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Mail color={colors.textSecondary} size={18} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={language === 'th' ? 'ระบุอีเมลพนักงาน' : 'specialist@company.com'}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('login_password_label')}</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <KeyRound color={colors.textSecondary} size={18} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    {showPassword ? <EyeOff color={colors.textSecondary} size={18} /> : <Eye color={colors.textSecondary} size={18} />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                {rememberMe ? (
                  <CheckSquare color={colors.primary} size={18} />
                ) : (
                  <Square color={colors.border} size={18} />
                )}
                <Text style={[styles.checkboxText, { color: colors.textSecondary }]}>{t('remember_me')}</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>{t('login_btn')}</Text>
                    <ArrowRight color="#FFFFFF" size={18} />
                  </>
                )}
              </TouchableOpacity>

              {/* Enterprise Security Notice */}
              <View style={[styles.securityNotice, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <ShieldCheck size={16} color={colors.primary} />
                <Text style={[styles.securityNoticeText, { color: colors.textSecondary }]}>
                  {language === 'th'
                    ? 'บัญชีผู้ใช้งานถูกจัดการและกำหนดสิทธิ์โดยผู้ดูแลระบบ (Admin Console)'
                    : 'Specialist accounts are provisioned by your System Administrator.'}
                </Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.versionText, { color: colors.textMuted }]}>FastFleet Marketing Field Pro v2.4 (2026)</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  content: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  topLangBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  innerContainer: {
    paddingHorizontal: 20,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(29, 78, 216, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#03246B',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E0E3E6',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  eyeIcon: {
    padding: 6,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  checkboxText: {
    fontSize: 13,
    color: '#475569',
  },
  loginButton: {
    backgroundColor: '#1D4ED8',
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  securityNoticeText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
