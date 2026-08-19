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
  ActivityIndicator,
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
  User,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { stopLivePresenceTracking } from '../lib/presenceService';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';
import FloatingBottomNav from '../components/FloatingBottomNav';

export default function UserProfileScreen({ navigation }: any) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>({
    name: 'กำลังโหลด...',
    initials: 'MK',
    staffId: '-',
    role: 'Field Marketing Specialist',
    department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
    territory: 'Bangkok Central (B2B)',
    email: '-',
    phone: '-',
    vehicle: '-',
    licenseClass: 'Corporate Transport Class B',
    safetyScore: 98,
    rating: 5.0,
    tripsCompleted: 0,
    avatar: null,
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profData } = await (supabase
            .from('profiles' as any) as any)
            .select('*, staff(*)')
            .eq('id', user.id)
            .single();

          const staffObj = Array.isArray(profData?.staff) ? profData.staff[0] : profData?.staff;
          const fullName = profData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'พนักงานการตลาด';
          const initials = fullName
            ? fullName.split(' ').slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('')
            : 'MK';

          setProfile({
            name: fullName,
            initials,
            staffId: staffObj?.staff_id || user.user_metadata?.staff_id || 'FM-SPECIALIST',
            role: profData?.position || staffObj?.position || (profData?.role === 'admin' ? 'System Administrator' : 'Field Marketing Specialist'),
            department: profData?.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
            territory: staffObj?.territory || 'Bangkok Central (B2B)',
            email: profData?.email || user.email,
            phone: profData?.phone || '-',
            vehicle: staffObj?.assigned_vehicle || profData?.assigned_vehicle_plate || 'ยานพาหนะประจำการ',
            licenseClass: 'Corporate Transport Class B',
            safetyScore: staffObj?.safety_score || 98,
            rating: staffObj?.rating || 5.0,
            tripsCompleted: staffObj?.total_trips || 0,
            avatar: profData?.avatar_url || null,
          });
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
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
          await stopLivePresenceTracking();
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
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={[styles.avatarImage, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
              <Text style={[styles.avatarInitials, { color: colors.primary }]}>{profile.initials || 'MK'}</Text>
            </View>
          )}

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
                style={[
                  styles.prefSegmentBtn,
                  { borderColor: language === 'th' ? colors.primary : colors.border },
                  language === 'th' && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text style={[styles.prefSegmentText, { color: language === 'th' ? colors.primary : colors.text }]}>🇹🇭 ภาษาไทย</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLanguage('en')}
                style={[
                  styles.prefSegmentBtn,
                  { borderColor: language === 'en' ? colors.primary : colors.border },
                  language === 'en' && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text style={[styles.prefSegmentText, { color: language === 'en' ? colors.primary : colors.text }]}>🇬🇧 English</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Theme Mode Selector */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isDark ? <Moon size={16} color={colors.primary} /> : <Sun size={16} color={colors.primary} />}
              <Text style={[styles.infoLabel, { color: colors.textSecondary, fontWeight: '700' }]}>
                {language === 'th' ? 'ธีมการแสดงผล' : 'Color Theme'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setTheme('light')}
                style={[
                  styles.prefSegmentBtn,
                  { borderColor: theme === 'light' ? colors.primary : colors.border },
                  theme === 'light' && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Sun size={14} color={theme === 'light' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.prefSegmentText, { color: theme === 'light' ? colors.primary : colors.text }]}>
                  {language === 'th' ? 'โหมดสว่าง' : 'Light Mode'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTheme('dark')}
                style={[
                  styles.prefSegmentBtn,
                  { borderColor: theme === 'dark' ? colors.primary : colors.border },
                  theme === 'dark' && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Moon size={14} color={theme === 'dark' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.prefSegmentText, { color: theme === 'dark' ? colors.primary : colors.text }]}>
                  {language === 'th' ? 'โหมดมืด' : 'Dark Mode'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 4: Privacy & Presence System */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
            {language === 'th' ? 'ระบบความปลอดภัย & การติดตาม' : 'Safety & Tracking System'}
          </Text>

          <View style={styles.presenceInfoBox}>
            <ShieldCheck size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.presenceTitle, { color: colors.text }]}>
                {language === 'th' ? 'ระบบส่งพิกัดการทำงานแบบเรียลไทม์' : 'Real-time Presence System'}
              </Text>
              <Text style={[styles.presenceDesc, { color: colors.textSecondary }]}>
                {language === 'th'
                  ? 'ระบบจะส่งพิกัดอย่างต่อเนื่องเพื่อความปลอดภัยและการคำนวณเบี้ยเลี้ยง และจะหยุดส่งทันทีเมื่อกดออกจากระบบ'
                  : 'Continuous GPS telemetry active for safety and route analytics. Stops automatically upon signing out.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 5: App Version Info */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>Fleet Marketing Specialist Pro v1.2.0 (Production Build)</Text>
          <Text style={[styles.versionSub, { color: colors.textSecondary }]}>Connected to Secure Supabase Cloud DB</Text>
        </View>
      </ScrollView>

      {/* Floating Bottom Nav */}
      <FloatingBottomNav activeTab="profile" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 110,
    gap: 14,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  profileCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    alignItems: 'center',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  staffIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  staffIdText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  safetyBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statBoxDivider: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  cardSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  prefSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  prefSegmentText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  presenceInfoBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  presenceTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  presenceDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  versionContainer: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  versionSub: {
    fontSize: 10,
  },
});
