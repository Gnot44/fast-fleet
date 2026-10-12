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
  Switch,
  BackHandler,
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
  ShieldAlert,
  Lock,
  Unlock,
  MapPin,
  Radio,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { startLivePresenceTracking, stopLivePresenceTracking } from '../lib/presenceService';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';
import FloatingBottomNav from '../components/FloatingBottomNav';

export default function UserProfileScreen({ navigation }: any) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [profile, setProfile] = useState<any>({
    name: 'กำลังโหลด...',
    initials: '...',
    staffId: '-',
    role: '-',
    department: '-',
    territory: '-',
    email: '-',
    phone: '-',
    vehicle: '-',
    licenseClass: '-',
    safetyScore: null,
    rating: null,
    tripsCompleted: 0,
    onTimeRate: null,
    avatar: null,
    isTrackingEnforced: true,
    userTrackingEnabled: true,
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profData } = await (supabase
            .from('profiles' as any) as any)
            .select('*')
            .eq('id', user.id)
            .single();

          // Fetch trip stats: completed count & average safety score
          const { data: tripStats } = await (supabase
            .from('trips' as any) as any)
            .select('status, safety_score')
            .eq('staff_id', user.id);

          const completedTrips = tripStats?.filter((t: any) => t.status === 'completed') || [];
          const avgSafety = completedTrips.length > 0
            ? Math.round(completedTrips.reduce((sum: number, t: any) => sum + (Number(t.safety_score) || 0), 0) / completedTrips.length)
            : null;

          // Fetch on-time rate from appointments
          const { data: apptStats } = await (supabase
            .from('appointments' as any) as any)
            .select('scheduled_at, arrived_at, status')
            .eq('staff_id', user.id)
            .in('status', ['completed', 'checked_in', 'checked_out']);

          let onTimeRate: number | null = null;
          if (apptStats && apptStats.length > 0) {
            const onTimeCount = apptStats.filter((a: any) => {
              if (!a.arrived_at || !a.scheduled_at) return false;
              const arrived = new Date(a.arrived_at).getTime();
              const scheduled = new Date(a.scheduled_at).getTime();
              return arrived <= scheduled + 15 * 60 * 1000; // within 15 min grace
            }).length;
            onTimeRate = Math.round((onTimeCount / apptStats.length) * 1000) / 10;
          }

          const fullName = profData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'พนักงานการตลาด';
          const initials = fullName
            ? fullName.split(' ').slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('')
            : 'MK';

          // Build vehicle display string from real DB fields
          let vehicleDisplay = '-';
          if (profData?.assigned_vehicle_plate) {
            vehicleDisplay = profData.assigned_vehicle_model
              ? `${profData.assigned_vehicle_model} (${profData.assigned_vehicle_plate})`
              : profData.assigned_vehicle_plate;
          }

          setProfile({
            name: fullName,
            initials,
            staffId: profData?.employee_id || user.user_metadata?.staff_id || '-',
            role: profData?.position || (profData?.role === 'admin' ? 'System Administrator' : '-'),
            department: profData?.department || '-',
            territory: profData?.territory || '-',
            email: profData?.email || user.email,
            phone: profData?.phone || '-',
            vehicle: vehicleDisplay,
            licenseClass: profData?.driving_license_type || '-',
            safetyScore: avgSafety,
            rating: null,
            tripsCompleted: completedTrips.length,
            onTimeRate,
            avatar: profData?.avatar_url || null,
            isTrackingEnforced: profData?.is_tracking_enabled !== false,
            userTrackingEnabled: profData?.user_tracking_enabled !== false,
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

  const handleToggleTracking = async (value: boolean) => {
    if (profile.isTrackingEnforced) {
      Alert.alert(
        language === 'th' ? '🔒 นโยบายความปลอดภัยองค์กร' : '🔒 Organization Policy',
        language === 'th'
          ? 'ผู้ดูแลระบบกำหนดให้นโยบายความปลอดภัยต้องเปิดการติดตามพิกัดตลอดเวลาเพื่อความปลอดภัยและการคำนวณเบี้ยเลี้ยง ไม่สามารถปิดได้'
          : 'Location tracking is enforced by organization policy and cannot be disabled.'
      );
      return;
    }

    try {
      setIsUpdatingTracking(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase.from('profiles' as any) as any)
        .update({ user_tracking_enabled: value })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev: any) => ({
        ...prev,
        userTrackingEnabled: value,
      }));

      if (value) {
        await startLivePresenceTracking();
        Alert.alert(
          language === 'th' ? '🟢 เปิดการติดตามตำแหน่ง' : '🟢 Tracking Activated',
          language === 'th'
            ? 'ระบบเริ่มส่งสัญญาณพิกัด GPS เพื่อการทำงานแบบเรียลไทม์เรียบร้อยแล้ว'
            : 'Live GPS telemetry is now active.'
        );
      } else {
        await stopLivePresenceTracking();
        Alert.alert(
          language === 'th' ? '⚪ ปิดการติดตามตำแหน่ง' : '⚪ Tracking Paused',
          language === 'th'
            ? 'ระบบหยุดการส่งพิกัด GPS เรียบร้อยแล้ว (ไม่ระบุตำแหน่ง)'
            : 'Live GPS telemetry has been paused.'
        );
      }
    } catch (err: any) {
      console.error('Error updating tracking setting:', err);
      Alert.alert(
        language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        err.message || 'ไม่สามารถอัปเดตการตั้งค่าได้'
      );
    } finally {
      setIsUpdatingTracking(false);
    }
  };

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

  const handleProfileGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Dashboard');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleProfileGoBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSubtle }]} onPress={handleProfileGoBack}>
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
              {profile.safetyScore != null && (
                <View style={[styles.safetyBadge, { backgroundColor: colors.successLight }]}>
                  <Award size={12} color={colors.success} />
                  <Text style={[styles.safetyBadgeText, { color: colors.successText }]}>Safety Score {profile.safetyScore}%</Text>
                </View>
              )}
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
            <Text style={[styles.statBoxValue, { color: '#F59E0B' }]}>{profile.rating != null ? `⭐ ${profile.rating}` : '-'}</Text>
          </View>
          <View style={[styles.statBoxDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statBoxLabel, { color: colors.textSecondary }]}>{t('profile_stats_ontime')}</Text>
            <Text style={[styles.statBoxValue, { color: colors.success }]}>{profile.onTimeRate != null ? `${profile.onTimeRate}%` : '-'}</Text>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
              {language === 'th' ? 'ระบบความปลอดภัย & การติดตาม' : 'Safety & Tracking System'}
            </Text>
            <View
              style={[
                styles.trackingPolicyBadge,
                {
                  backgroundColor: profile.isTrackingEnforced ? '#EFF6FF' : '#F1F5F9',
                  borderColor: profile.isTrackingEnforced ? '#BFDBFE' : '#CBD5E1',
                },
              ]}
            >
              {profile.isTrackingEnforced ? (
                <Lock size={11} color="#2563EB" />
              ) : (
                <Unlock size={11} color="#64748B" />
              )}
              <Text
                style={[
                  styles.trackingPolicyBadgeText,
                  { color: profile.isTrackingEnforced ? '#1E40AF' : '#475569' },
                ]}
              >
                {profile.isTrackingEnforced
                  ? language === 'th' ? 'บังคับโดยองค์กร' : 'Enforced'
                  : language === 'th' ? 'เลือกเปิด/ปิดเองได้' : 'User Managed'}
              </Text>
            </View>
          </View>

          {/* Location Tracking Interactive Switch Card */}
          <View
            style={[
              styles.trackingControlCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, gap: 3, paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin
                  size={16}
                  color={
                    (profile.isTrackingEnforced || profile.userTrackingEnabled)
                      ? colors.primary
                      : colors.textSecondary
                  }
                />
                <Text style={[styles.trackingToggleTitle, { color: colors.text }]}>
                  {language === 'th' ? 'การส่งพิกัดตำแหน่ง GPS' : 'Live GPS Telemetry'}
                </Text>
              </View>
              <Text style={[styles.trackingToggleDesc, { color: colors.textSecondary }]}>
                {profile.isTrackingEnforced
                  ? language === 'th'
                    ? '🔒 องค์กรบังคับเปิดการติดตามพิกัดตลอดเวลาเพื่อความปลอดภัยและการคำนวณเบี้ยเลี้ยง ไม่สามารถปิดได้'
                    : '🔒 Location tracking is required by company safety policy and locked to ON.'
                  : profile.userTrackingEnabled
                  ? language === 'th'
                    ? '🟢 กำลังส่งสัญญาณพิกัด GPS แบบเรียลไทม์ (แตะสวิตช์เพื่อปิดการติดตาม)'
                    : '🟢 Real-time GPS active. Tap switch to turn off tracking.'
                  : language === 'th'
                    ? '⚪ ปิดการส่งพิกัดตำแหน่งอยู่ (แตะสวิตช์เพื่อเริ่มส่งพิกัด)'
                    : '⚪ GPS tracking is paused. Tap switch to enable.'}
              </Text>
            </View>

            {isUpdatingTracking ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={profile.isTrackingEnforced ? true : !!profile.userTrackingEnabled}
                disabled={profile.isTrackingEnforced || isUpdatingTracking}
                onValueChange={handleToggleTracking}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                ios_backgroundColor="#CBD5E1"
              />
            )}
          </View>

          {/* Privacy & Presence Information Box */}
          <View style={styles.presenceInfoBox}>
            <ShieldCheck size={18} color={colors.success} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.presenceTitle, { color: colors.text }]}>
                {language === 'th' ? 'การปกป้องข้อมูลและความปลอดภัย' : 'Data Privacy & Security'}
              </Text>
              <Text style={[styles.presenceDesc, { color: colors.textSecondary }]}>
                {language === 'th'
                  ? 'ข้อมูลพิกัดจะถูกเข้ารหัสความปลอดภัยตามมาตรฐาน PDPA และระบบจะหยุดส่งทันทีเมื่อกดออกจากระบบ'
                  : 'Telemetry is securely encrypted under enterprise privacy standards and stops upon logout.'}
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingBottom: 120,
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
  trackingPolicyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  trackingPolicyBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  trackingControlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  trackingToggleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  trackingToggleDesc: {
    fontSize: 11,
    lineHeight: 15,
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
