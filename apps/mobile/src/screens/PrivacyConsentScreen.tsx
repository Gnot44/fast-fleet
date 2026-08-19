import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  AppState,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Settings,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  LogOut,
  RefreshCw,
  CheckSquare,
  Square,
  Lock,
  PowerOff,
  Navigation,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { startLivePresenceTracking, stopLivePresenceTracking } from '../lib/presenceService';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';

export default function PrivacyConsentScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const { colors, isDark } = useTheme();

  // Acknowledge checkbox starts UNCHECKED by default
  const [hasConsented, setHasConsented] = useState(false);
  const [foregroundStatus, setForegroundStatus] = useState<Location.PermissionStatus | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<Location.PermissionStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [hasRequestedSettings, setHasRequestedSettings] = useState(false);

  // Check current device permission state without auto-navigating
  const checkCurrentPermissionsStatus = async () => {
    try {
      setChecking(true);
      const fg = await Location.getForegroundPermissionsAsync();
      setForegroundStatus(fg.status);

      let currentBgStatus = Location.PermissionStatus.UNDETERMINED;
      if (Platform.OS === 'android') {
        try {
          const bg = await Location.getBackgroundPermissionsAsync();
          currentBgStatus = bg.status;
          setBackgroundStatus(bg.status);
        } catch (e) {}
      } else {
        currentBgStatus = fg.status;
        setBackgroundStatus(fg.status);
      }
    } catch (err) {
      console.warn('Error checking location permissions:', err);
    } finally {
      setChecking(false);
    }
  };

  // Initial check on mount
  useEffect(() => {
    checkCurrentPermissionsStatus();
  }, []);

  // When returning from Phone Settings (App becomes active) after user tapped "Go to Settings"
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        await checkCurrentPermissionsStatus();
        if (hasRequestedSettings && hasConsented) {
          const fg = await Location.getForegroundPermissionsAsync();
          let bgStatus = fg.status;
          if (Platform.OS === 'android') {
            try {
              const bg = await Location.getBackgroundPermissionsAsync();
              bgStatus = bg.status;
            } catch (e) {}
          }
          const granted = Platform.OS === 'ios'
            ? (fg.status === 'granted')
            : (fg.status === 'granted' && bgStatus === 'granted');

          if (granted) {
            setHasRequestedSettings(false);
            setShowPermissionModal(false);
            await startLivePresenceTracking();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            });
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasRequestedSettings, hasConsented]);

  // Handle user clicking "ถัดไป (Next)"
  const handleNextPress = async () => {
    // 1. Must tick the acknowledge checkbox first
    if (!hasConsented) {
      Alert.alert(
        language === 'th' ? 'กรุณากดยินยอมข้อตกลง' : 'Consent Required',
        language === 'th'
          ? 'กรุณาแตะเลือกยอมรับข้อตกลงการรับพิกัดตำแหน่งเพื่อปฏิบัติงานก่อนดำเนินการต่อ'
          : 'Please check the acknowledgment box to accept the location tracking terms before proceeding.'
      );
      return;
    }

    try {
      setRequesting(true);

      // 2. Check permissions
      const fg = await Location.getForegroundPermissionsAsync();
      setForegroundStatus(fg.status);

      let currentBg = Location.PermissionStatus.UNDETERMINED;
      if (Platform.OS === 'android') {
        try {
          const bg = await Location.getBackgroundPermissionsAsync();
          currentBg = bg.status;
          setBackgroundStatus(bg.status);
        } catch (e) {}
      } else {
        currentBg = fg.status;
        setBackgroundStatus(fg.status);
      }

      const isGranted = Platform.OS === 'ios'
        ? (fg.status === 'granted')
        : (fg.status === 'granted' && currentBg === 'granted');

      if (isGranted) {
        // Permission granted! Start tracking and proceed to Dashboard
        await startLivePresenceTracking();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
        return;
      }

      // 3. If foreground not yet requested, trigger native prompt
      if (fg.status !== 'granted') {
        const fgReq = await Location.requestForegroundPermissionsAsync();
        setForegroundStatus(fgReq.status);

        if (fgReq.status === 'granted') {
          if (Platform.OS === 'android') {
            try {
              const bgReq = await Location.requestBackgroundPermissionsAsync();
              setBackgroundStatus(bgReq.status);
              if (bgReq.status === 'granted') {
                await startLivePresenceTracking();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Dashboard' }],
                });
                return;
              }
            } catch (bgErr) {
              // ignore
            }
          } else {
            // iOS: Foreground granted unlocks live tracking
            await startLivePresenceTracking();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            });
            return;
          }
        }
      } else if (Platform.OS === 'android' && currentBg !== 'granted') {
        try {
          const bgReq = await Location.requestBackgroundPermissionsAsync();
          setBackgroundStatus(bgReq.status);
          if (bgReq.status === 'granted') {
            await startLivePresenceTracking();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            });
            return;
          }
        } catch (bgErr) {
          // ignore
        }
      }

      // 4. If still not granted: Show modal prompting user to open Phone Settings
      setShowPermissionModal(true);
    } catch (err: any) {
      console.error('Error during permission request:', err);
      setShowPermissionModal(true);
    } finally {
      setRequesting(false);
    }
  };

  // User confirms on modal -> Force navigate to Phone Settings
  const handleAcceptAndOpenSettings = () => {
    setShowPermissionModal(false);
    setHasRequestedSettings(true);
    Linking.openSettings();
  };

  const handleSignOut = async () => {
    await stopLivePresenceTracking();
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const isLocationGranted = Platform.OS === 'ios'
    ? (foregroundStatus === 'granted')
    : (foregroundStatus === 'granted' && backgroundStatus === 'granted');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Floating Language Switcher */}
      <View style={styles.topLangBar}>
        <LanguageTogglePill />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero & Policy Header Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIconWrapper, { backgroundColor: isLocationGranted ? '#DCFCE7' : '#EFF6FF' }]}>
            {isLocationGranted ? (
              <ShieldCheck size={40} color="#16A34A" />
            ) : (
              <ShieldAlert size={40} color="#2563EB" />
            )}
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {language === 'th'
              ? 'ข้อตกลงการติดตามตำแหน่งตลอดเวลา'
              : 'Privacy & Always Location Consent'}
          </Text>

          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {language === 'th'
              ? 'แอปพลิเคชันจำเป็นต้องเข้าถึงพิกัด GPS แบบ "ตลอดเวลา" (Always Allow) เพื่อความปลอดภัย บันทึกระยะทาง และยืนยันการเข้าพบลูกค้าตามมาตรฐานงาน'
              : 'This app requires continuous background GPS telemetry during shifts to guarantee safety, calculate allowances, and verify client visits.'}
          </Text>

          {/* Privacy Terms Points Grid */}
          <View style={[styles.pointsContainer, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <View style={styles.pointRow}>
              <View style={[styles.pointIconBox, { backgroundColor: '#DBEAFE' }]}>
                <Navigation size={15} color="#2563EB" />
              </View>
              <View style={styles.pointContent}>
                <Text style={[styles.pointTitle, { color: colors.text }]}>
                  {language === 'th' ? 'ติดตามเส้นทางและระยะทางอัตโนมัติ' : 'Automated Trip & Mileage Tracking'}
                </Text>
                <Text style={[styles.pointDesc, { color: colors.textSecondary }]}>
                  {language === 'th'
                    ? 'บันทึกพิกัดทุกๆ 20 วินาที แม้พับแอปหรือล็อคหน้าจอ เพื่อคำนวณระยะทางและค่าน้ำมันจริง'
                    : 'Records GPS pings every 20s even when locked or minimized to calculate true mileage.'}
                </Text>
              </View>
            </View>

            <View style={styles.pointRow}>
              <View style={[styles.pointIconBox, { backgroundColor: '#DCFCE7' }]}>
                <MapPin size={15} color="#16A34A" />
              </View>
              <View style={styles.pointContent}>
                <Text style={[styles.pointTitle, { color: colors.text }]}>
                  {language === 'th' ? 'ยืนยันการเข้าพบลูกค้าและส่งมอบงาน' : 'Proof of Visit & Drop Verification'}
                </Text>
                <Text style={[styles.pointDesc, { color: colors.textSecondary }]}>
                  {language === 'th'
                    ? 'ตรวจสอบความถูกต้องของพิกัดเมื่อเดินทางถึงสถานที่นัดหมายของลูกค้า'
                    : 'Validates accurate coordinates upon arrival at client destinations.'}
                </Text>
              </View>
            </View>

            <View style={styles.pointRow}>
              <View style={[styles.pointIconBox, { backgroundColor: '#FEE2E2' }]}>
                <PowerOff size={15} color="#DC2626" />
              </View>
              <View style={styles.pointContent}>
                <Text style={[styles.pointTitle, { color: colors.text }]}>
                  {language === 'th' ? 'หยุดส่งตำแหน่งทันทีเมื่อกดออกจากระบบ' : 'Stop Tracking on Sign Out'}
                </Text>
                <Text style={[styles.pointDesc, { color: colors.textSecondary }]}>
                  {language === 'th'
                    ? 'ระบบจะหยุดการดึงพิกัดทันทีเมื่อพนักงานกด "ออกจากระบบ (Logout)" และขึ้นสถานะออฟไลน์'
                    : 'Tracking stops completely and turns Offline immediately when you log out.'}
                </Text>
              </View>
            </View>

            <View style={styles.pointRow}>
              <View style={[styles.pointIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Lock size={15} color="#D97706" />
              </View>
              <View style={styles.pointContent}>
                <Text style={[styles.pointTitle, { color: colors.text }]}>
                  {language === 'th' ? 'การรักษาความปลอดภัยข้อมูล' : 'Encrypted & Confidential'}
                </Text>
                <Text style={[styles.pointDesc, { color: colors.textSecondary }]}>
                  {language === 'th'
                    ? 'ข้อมูลถูกเข้ารหัสและเข้าถึงได้เฉพาะผู้ดูแลระบบและหัวหน้างานที่ได้รับมอบหมายเท่านั้น'
                    : 'Encrypted telemetry accessible strictly by authorized fleet dispatchers.'}
                </Text>
              </View>
            </View>
          </View>

          {/* Agreement Checkbox - User must manually tick */}
          <TouchableOpacity
            style={[styles.checkboxContainer, { borderColor: hasConsented ? '#2563EB' : colors.border }]}
            onPress={() => setHasConsented(!hasConsented)}
            activeOpacity={0.8}
          >
            {hasConsented ? (
              <CheckSquare size={22} color="#2563EB" />
            ) : (
              <Square size={22} color="#94A3B8" />
            )}
            <Text style={[styles.checkboxText, { color: colors.text }]}>
              {language === 'th'
                ? 'ข้าพเจ้าได้อ่าน เข้าใจ และยินยอมให้ระบบเข้าถึงพิกัดตำแหน่งในเบื้องหลัง "ตลอดเวลา" (Always Allow) เพื่อการปฏิบัติงาน'
                : 'I acknowledge and agree to operational background location tracking (Always Allow).'}
            </Text>
          </TouchableOpacity>

          {/* Current Status Indicator Banner */}
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: isLocationGranted ? '#F0FDF4' : '#FEF3C7',
                borderColor: isLocationGranted ? '#86EFAC' : '#FDE68A',
              },
            ]}
          >
            {isLocationGranted ? (
              <>
                <CheckCircle2 size={20} color="#16A34A" />
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusTitle, { color: '#14532D' }]}>
                    {language === 'th' ? 'สิทธิ์ตำแหน่งพร้อมใช้งาน' : 'Location Permission Active'}
                  </Text>
                  <Text style={[styles.statusSub, { color: '#166534' }]}>
                    {language === 'th' ? 'ติ๊กถูกที่ช่องข้อตกลงแล้วกด "ถัดไป" เพื่อเริ่มงาน' : 'Check acknowledgment and tap "Next" to enter'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <AlertTriangle size={20} color="#D97706" />
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusTitle, { color: '#78350F' }]}>
                    {language === 'th' ? 'ยังไม่ได้เปิดสิทธิ์ตำแหน่ง' : 'Permission Required'}
                  </Text>
                  <Text style={[styles.statusSub, { color: '#92400E' }]}>
                    {language === 'th'
                      ? 'ติ๊กถูกที่ช่องข้อตกลงแล้วกดปุ่ม "ถัดไป" ด้านล่าง'
                      : 'Check acknowledgment and tap "Next" below'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 2. Step-by-Step OS Settings Guide Card */}
        <View style={[styles.guideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.guideHeader}>
            <Smartphone size={18} color={colors.primary} />
            <Text style={[styles.guideHeaderText, { color: colors.text }]}>
              {language === 'th'
                ? `ขั้นตอนการเปิดสิทธิ์สำหรับ ${Platform.OS === 'ios' ? 'iPhone (iOS)' : 'Android'}`
                : `Setup steps for ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`}
            </Text>
          </View>

          {Platform.OS === 'ios' ? (
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {language === 'th' ? 'ติ๊กถูกที่ช่องข้อตกลงแล้วกดปุ่ม ' : 'Tick checkbox and tap '}
                  <Text style={{ fontWeight: 'bold', color: colors.primary }}>
                    {language === 'th' ? '"ถัดไป (Next)"' : '"Next"'}
                  </Text>
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {language === 'th' ? 'เมื่อมีหน้าต่างถาม ให้เลือก ' : 'When prompted, select '}
                  <Text style={{ fontWeight: 'bold' }}>
                    {language === 'th' ? '"อนุญาตในระหว่างใช้แอป" (Allow While Using App)' : '"Allow While Using App"'}
                  </Text>
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={[styles.stepNumber, { backgroundColor: '#2563EB' }]}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {language === 'th' ? 'เปิดสวิตช์ ' : 'Turn ON '}
                  <Text style={{ fontWeight: 'bold', color: '#2563EB' }}>
                    {language === 'th' ? '"ตำแหน่งที่แน่นอน" (Precise Location: เปิด)' : '"Precise Location: ON"'}
                  </Text>
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {language === 'th' ? 'ติ๊กถูกที่ช่องข้อตกลงแล้วกดปุ่ม ' : 'Tick checkbox and tap '}
                  <Text style={{ fontWeight: 'bold', color: colors.primary }}>
                    {language === 'th' ? '"ถัดไป (Next)"' : '"Next"'}
                  </Text>
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {language === 'th' ? 'หากมีป๊อปอัป ให้เลือก ' : 'If popup appears, tap '}
                  <Text style={{ fontWeight: 'bold' }}>
                    {language === 'th' ? '"ไปที่การตั้งค่า" (Open Settings)' : '"Open Settings"'}
                  </Text>
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={[styles.stepNumber, { backgroundColor: '#2563EB' }]}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {language === 'th' ? 'เลือก ' : 'Select '}
                  <Text style={{ fontWeight: 'bold', color: '#2563EB' }}>
                    {language === 'th' ? '"อนุญาตตลอดเวลา" (Allow all the time)' : '"Allow all the time"'}
                  </Text>
                  {language === 'th' ? ' แล้วกด Back กลับมาที่แอป' : ' and return to app'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 3. Action Buttons */}
        <View style={styles.actionsWrapper}>
          {/* Main Next Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!hasConsented || requesting) && { opacity: 0.6 },
            ]}
            onPress={handleNextPress}
            disabled={requesting}
            activeOpacity={0.85}
          >
            {requesting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ArrowRight size={20} color="#FFFFFF" />
            )}
            <Text style={styles.primaryButtonText}>
              {language === 'th' ? 'ถัดไป (Next)' : 'Next'}
            </Text>
          </TouchableOpacity>

          {/* Re-check Status */}
          <TouchableOpacity
            style={styles.checkButton}
            onPress={() => checkCurrentPermissionsStatus()}
            disabled={checking}
            activeOpacity={0.7}
          >
            <RefreshCw size={15} color={colors.textSecondary} />
            <Text style={[styles.checkButtonText, { color: colors.textSecondary }]}>
              {checking
                ? (language === 'th' ? 'กำลังตรวจสอบสิทธิ์...' : 'Checking...')
                : (language === 'th' ? 'ตรวจสอบสถานะสิทธิ์อีกครั้ง' : 'Re-check Permission Status')}
            </Text>
          </TouchableOpacity>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <LogOut size={15} color="#EF4444" />
            <Text style={styles.signOutButtonText}>
              {language === 'th' ? 'ออกจากระบบ / กลับไปหน้า Login' : 'Sign Out / Return to Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mandatory Permission Popup Modal */}
      <Modal
        visible={showPermissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalIconBox}>
              <MapPin size={32} color="#2563EB" />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {language === 'th'
                ? 'กรุณาเปิดสิทธิ์ตำแหน่งตลอดเวลา'
                : 'Please Enable Location Access'}
            </Text>

            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              {language === 'th'
                ? 'เพื่อเข้าใช้งานแอพพลิเคชันและบันทึกพิกัดการทำงาน กรุณาตั้งค่าตำแหน่งในหน้าการตั้งค่าโทรศัพท์'
                : 'To access the application and record shifts, please enable location permission in your device settings.'}
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowPermissionModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textSecondary }]}>
                  {language === 'th' ? 'ปิด' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAcceptBtn}
                onPress={handleAcceptAndOpenSettings}
                activeOpacity={0.85}
              >
                <Settings size={18} color="#FFFFFF" />
                <Text style={styles.modalAcceptBtnText}>
                  {language === 'th' ? 'ไปที่การตั้งค่า (ยอมรับ)' : 'Open Settings'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topLangBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    gap: 14,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  heroIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  pointsContainer: {
    width: '100%',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pointIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pointContent: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 1,
  },
  pointDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  checkboxContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  checkboxText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  statusBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  statusSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  guideCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  guideHeaderText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepsList: {
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  actionsWrapper: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  checkButtonText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  signOutButtonText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 10,
    gap: 12,
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalAcceptBtn: {
    flex: 2,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  modalAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
