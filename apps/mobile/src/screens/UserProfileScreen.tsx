import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  LogOut,
  Award,
  Car,
  Phone,
  Mail,
  FileCheck,
  Moon,
  Sun,
  Globe,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { stopLivePresenceTracking } from '../lib/presenceService';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';
import FloatingBottomNav from '../components/FloatingBottomNav';

export default function UserProfileScreen({ navigation }: any) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, colors, isDark } = useTheme();
  const [profile, setProfile] = useState<any>({
    name: 'กำลังโหลด...',
    staffId: '...',
    role: 'Field Marketing Specialist',
    department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
    email: '',
    phone: '',
    vehicle: 'Isuzu D-Max (1กข-4452)',
    licenseClass: 'Corporate Transport Class B',
    safetyScore: 98,
    rating: 4.9,
    tripsCompleted: 0,
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profData } = await (supabase
            .from('profiles' as any) as any)
            .select('*, staff(*)')
            .eq('id', user.id)
            .single();

          const staffObj = Array.isArray(profData?.staff) ? profData.staff[0] : profData?.staff;

          setProfile({
            name: profData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'พนักงานการตลาด',
            staffId: staffObj?.staff_id || user.user_metadata?.staff_id || 'AITS10002772',
            role: profData?.position || staffObj?.position || (profData?.role === 'admin' ? 'System Administrator' : 'Field Marketing Specialist'),
            department: profData?.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
            territory: staffObj?.territory || 'Bangkok Central (B2B)',
            email: profData?.email || user.email,
            phone: profData?.phone || '081-000-0000',
            vehicle: staffObj?.assigned_vehicle || 'Isuzu D-Max (1กข-4452)',
            licenseClass: 'Corporate Transport Class B',
            safetyScore: staffObj?.safety_score || 98,
            rating: staffObj?.rating || 4.9,
            tripsCompleted: staffObj?.total_trips || 0,
            avatar: profData?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
          });
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    }

    loadUserProfile();
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserProfile();
    });
    return unsubscribe;
  }, [navigation]);

  const [pushNotif, setPushNotif] = useState(true);
  const [telemetrySync, setTelemetrySync] = useState(true);

  const handleLogout = async () => {
    Alert.alert(t('profile_sign_out'), language === 'th' ? 'คุณต้องการออกจากระบบใช่หรือไม่?' : 'Are you sure you want to sign out?', [
      { text: t('btn_cancel'), style: 'cancel' },
      {
        text: t('profile_sign_out'),
        style: 'destructive',
        onPress: async () => {
          stopLivePresenceTracking();
          await supabase.auth.signOut();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSubtle }]} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profile_title')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.logoutIconButton} onPress={handleLogout}>
            <LogOut size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Image source={{ uri: profile.avatar }} style={[styles.avatarImage, { borderColor: colors.border }]} />
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
            <Text style={[styles.profileRole, { color: colors.textSecondary }]}>{profile.role}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.staffIdBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.staffIdText, { color: colors.primary }]}>{profile.staffId}</Text>
              </View>
              <View style={[styles.safetyBadge, { backgroundColor: colors.successLight }]}>
                <Award size={12} color={colors.success} />
                <Text style={[styles.safetyBadgeText, { color: colors.successText }]}>Safety Score {profile.safetyScore}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statBoxLabel, { color: colors.textSecondary }]}>{t('profile_stats_completed')}</Text>
            <Text style={[styles.statBoxValue, { color: colors.text }]}>{profile.tripsCompleted}</Text>
          </View>
          <View style={[styles.statBoxDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statBoxLabel, { color: colors.textSecondary }]}>{t('profile_stats_rating')}</Text>
            <Text style={[styles.statBoxValue, { color: '#F59E0B' }]}>⭐ {profile.rating}</Text>
          </View>
          <View style={[styles.statBoxDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statBoxLabel, { color: colors.textSecondary }]}>{t('profile_stats_ontime')}</Text>
            <Text style={[styles.statBoxValue, { color: colors.success }]}>99.2%</Text>
          </View>
        </View>

        {/* Section 1: Assigned Vehicle & Credentials */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>{t('plan_vehicle')}</Text>

          <View style={styles.infoRow}>
            <Car size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile_vehicle')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile.vehicle}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <FileCheck size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile_license')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile.licenseClass}</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Contact Information */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>{language === 'th' ? 'ข้อมูลติดต่อ' : 'Contact Information'}</Text>

          <View style={styles.infoRow}>
            <Phone size={18} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile_phone')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile.phone}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Mail size={18} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile_email')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile.email}</Text>
            </View>
          </View>
        </View>

        {/* Section 3: App Preferences (Language & Theme Mode) */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>{language === 'th' ? 'การตั้งค่าแอปพลิเคชัน' : 'App Preferences'}</Text>

          {/* Language Selector */}
          <View style={{ gap: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Globe size={16} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary, fontWeight: '700' }]}>
                {language === 'th' ? 'ภาษาที่ใช้แสดงผล' : 'Display Language'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setLanguage('th')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: language === 'th' ? colors.primary : colors.border,
                  backgroundColor: language === 'th' ? colors.primaryLight : colors.surfaceSubtle,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 16 }}>🇹🇭</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: language === 'th' ? colors.primary : colors.textSecondary }}>
                  ภาษาไทย (TH)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLanguage('en')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: language === 'en' ? colors.primary : colors.border,
                  backgroundColor: language === 'en' ? colors.primaryLight : colors.surfaceSubtle,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 16 }}>🇬🇧</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: language === 'en' ? colors.primary : colors.textSecondary }}>
                  English (EN)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Theme Mode Selector */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Moon size={16} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary, fontWeight: '700' }]}>
                {language === 'th' ? 'ธีมการแสดงผล' : 'Appearance Theme'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setTheme('light')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: theme === 'light' ? colors.primary : colors.border,
                  backgroundColor: theme === 'light' ? colors.primaryLight : colors.surfaceSubtle,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Sun size={15} color={theme === 'light' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme === 'light' ? colors.primary : colors.textSecondary }}>
                  {language === 'th' ? 'สว่าง' : 'Light'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTheme('dark')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: theme === 'dark' ? colors.primary : colors.border,
                  backgroundColor: theme === 'dark' ? colors.primaryLight : colors.surfaceSubtle,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Moon size={15} color={theme === 'dark' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme === 'dark' ? colors.primary : colors.textSecondary }}>
                  {language === 'th' ? 'มืด' : 'Dark'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTheme('system')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: theme === 'system' ? colors.primary : colors.border,
                  backgroundColor: theme === 'system' ? colors.primaryLight : colors.surfaceSubtle,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme === 'system' ? colors.primary : colors.textSecondary }}>
                  {language === 'th' ? 'ตามระบบ' : 'System'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.logoutButtonText}>{t('profile_sign_out')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <FloatingBottomNav activeTab="profile" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E3E6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#03246B',
  },
  logoutIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 16,
    paddingBottom: 110,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E3E6',
    gap: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F4F7',
    borderWidth: 2,
    borderColor: '#E0E3E6',
  },
  profileMeta: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#03246B',
  },
  profileRole: {
    fontSize: 12,
    color: '#64748B',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  staffIdBadge: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  staffIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#03246B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  safetyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  statsRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E3E6',
  },
  statBox: {
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#03246B',
  },
  statBoxSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  statBoxDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E0E3E6',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E3E6',
    gap: 14,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#03246B',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#03246B',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#03246B',
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
