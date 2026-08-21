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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Bell,
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Trash2,
  User,
  Users,
  Briefcase,
  Play,
  Navigation,
  ChevronRight,
  Eye,
  Send,
  Edit3,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { startLivePresenceTracking } from '../lib/presenceService';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';
import FloatingBottomNav from '../components/FloatingBottomNav';

function parsePhotos(photoField?: any): string[] {
  if (!photoField) return [];
  const results: string[] = [];

  const extract = (val: any) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(extract);
      return;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('"{') && trimmed.endsWith('}"')) ||
        (trimmed.startsWith('"[') && trimmed.endsWith(']"'))
      ) {
        try {
          const unescaped = trimmed.startsWith('"') && trimmed.endsWith('"') ? JSON.parse(trimmed) : trimmed;
          const parsed = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped;
          extract(parsed);
          return;
        } catch (e) {}
      }
      if (trimmed.includes('||')) {
        trimmed.split('||').forEach((s) => extract(s.trim()));
        return;
      }
      if (trimmed.length > 5 && !trimmed.startsWith('[') && !trimmed.endsWith(']')) {
        results.push(trimmed);
      }
    }
  };

  extract(photoField);
  return Array.from(new Set(results));
}

export default function DashboardScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const { colors, isDark } = useTheme();

  const [profile, setProfile] = useState<any>({
    name: 'กำลังโหลด...',
    role: 'Field Marketing Specialist',
    initials: 'MK',
    avatar: null,
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'unconfirmed' | 'scheduled'>('all');
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [rejectedTrips, setRejectedTrips] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const fetchDashboardData = async () => {
    try {
      setLoadingData(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile
      const { data: prof } = await (supabase
        .from('profiles' as any) as any)
        .select('*, staff(*)')
        .eq('id', user.id)
        .single();

      const fullName = prof?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'พนักงานการตลาด';
      const initials = fullName
        ? fullName.split(' ').slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('')
        : 'MK';

      setProfile({
        name: fullName,
        role: prof?.position || (prof?.role === 'admin' ? 'System Administrator' : 'Field Marketing Specialist'),
        initials,
        avatar: prof?.avatar_url || null,
      });

      // 2. Fetch Real Trips for this Specialist
      const { data: tripsData } = await supabase
        .from('trips')
        .select('*, appointments(*), expenses(*)')
        .eq('staff_id', user.id)
        .order('created_at', { ascending: false });

      if (tripsData) {
        const upcoming: any[] = [];
        const rejected: any[] = [];
        const pending: any[] = [];
        const history: any[] = [];
        const todayStr = new Date().toISOString().split('T')[0];

        const reverseCatMap: Record<string, string> = {
          'toll': 'ค่าทางด่วน',
          'parking': 'ค่าที่จอดรถ',
          'fuel': 'ค่าน้ำมัน',
          'entertainment': 'ค่าอาหาร / เลี้ยงรับรอง',
          'other': 'อื่นๆ',
        };

        tripsData.forEach((t: any) => {
          const rawAppts = t.appointments || [];
          const tripExpenses = t.expenses || [];
          const sortedAppts = [...rawAppts].sort(
            (a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)
          );
          const visitedCount = sortedAppts.filter((a: any) => !!a.confirmation_status).length;
          const completedDataCount = sortedAppts.filter((a: any) => !!a.confirmation_status && (a.status === 'completed' || a.status === 'Completed')).length;
          const totalCount = sortedAppts.length;
          
          const isFullyVisited = totalCount > 0 && visitedCount === totalCount;
          const isFullyCompleted = totalCount > 0 && completedDataCount === totalCount;
          
          // A trip is considered to have unconfirmed/incomplete drops if not fully completed
          const hasIncompleteDrops = totalCount > 0 && completedDataCount < totalCount;
          const tripDateStr = t.trip_date || todayStr;
          const isPastDate = tripDateStr < todayStr;

          // Trip has active draft / progress if in_progress, has visited/confirmed stops, or has logged expenses
          const hasDraftOrProgress = t.status === 'in_progress' || visitedCount > 0 || completedDataCount > 0 || (t.total_expenses && Number(t.total_expenses) > 0);

          // Overdue Lock: Only past trips that were NEVER started, NEVER saved draft, and NOT submitted/approved/revision
          const isOverdue = isPastDate && !hasDraftOrProgress && t.status !== 'completed' && t.approval_status !== 'approved' && t.approval_status !== 'revision_requested';

          let dateDisplay = language === 'th' ? 'วันนี้' : 'Today';
          if (t.trip_date) {
            if (t.trip_date === todayStr) {
              dateDisplay = language === 'th' ? 'วันนี้' : 'Today';
            } else if (isOverdue) {
              const d = new Date(t.trip_date);
              dateDisplay = language === 'th'
                ? `ค้าง (${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`
                : `Overdue (${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})`;
            } else if (isPastDate && hasDraftOrProgress) {
              const d = new Date(t.trip_date);
              dateDisplay = language === 'th'
                ? `แบบร่าง (${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`
                : `Draft (${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})`;
            } else {
              dateDisplay = new Date(t.trip_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' });
            }
          }

          const tripObj = {
            id: t.id,
            tripCode: t.trip_code || `TRP-${t.id.slice(0, 6)}`,
            date: dateDisplay,
            rawDate: t.trip_date,
            isOverdue: isOverdue,
            route: t.title || 'เส้นทางเข้าพบลูกค้า',
            status: t.status === 'in_progress' ? 'In Progress' : (t.status === 'completed' ? 'Completed' : 'Scheduled'),
            approvalStatus: (t.approval_status as 'draft' | 'pending' | 'approved' | 'revision_requested') || 'draft',
            dropsCount: totalCount,
            visitedDropsCount: visitedCount,
            completedDropsCount: completedDataCount,
            isFullyVisited: isFullyVisited,
            isFullyCompleted: isFullyCompleted,
            hasIncompleteDrops: hasIncompleteDrops,
            isStarted: t.status === 'in_progress',
            startOdometer: t.start_odometer?.toString() || '45200',
            startLocation: t.start_location || {
              name: 'สำนักงาน / จุดปล่อยรถ (Depot)',
              address: 'ถนนสุขุมวิท เขตคลองเตย กรุงเทพมหานคร',
              latitude: 13.7563,
              longitude: 100.5018,
            },
            drops: sortedAppts.map((a: any) => {
              const apptExps = tripExpenses.filter((e: any) => e.appointment_id === a.id);
              const mappedExps = apptExps.map((e: any) => ({
                id: e.id,
                category: reverseCatMap[e.category] || e.category,
                amount: String(e.amount),
                receiptUri: e.receipt_url || e.receipt_image_path,
                receiptName: e.title || (e.receipt_url ? 'Slip.jpg' : undefined),
                note: e.notes || '',
              }));

              let apptPhotos = parsePhotos(a.client_photo_url);
              let apptExpsFinal = mappedExps;

              if (a.driver_notes && typeof a.driver_notes === 'string' && (a.driver_notes.includes('hasDraft') || a.driver_notes.includes('draftPhotos'))) {
                try {
                  const draftData = JSON.parse(a.driver_notes);
                  if (draftData && (draftData.hasDraft || Array.isArray(draftData.draftPhotos))) {
                    apptPhotos = Array.isArray(draftData.draftPhotos) ? parsePhotos(draftData.draftPhotos) : [];
                    if (Array.isArray(draftData.draftExpenses)) {
                      apptExpsFinal = draftData.draftExpenses;
                    }
                  }
                } catch (e) {}
              }

              return {
                id: a.id,
                appointmentId: a.id,
                name: a.company_name,
                recipient: a.recipient_name || a.customer_name || '',
                phone: a.recipient_phone || '',
                items: a.agenda || '',
                address: a.destination_address || '',
                latitude: a.destination_lat || undefined,
                longitude: a.destination_lng || undefined,
                isConfirmed: !!a.confirmation_status,
                isDataComplete: a.status === 'completed' || a.status === 'Completed',
                status: a.status || (a.confirmation_status ? 'incomplete' : 'pending'),
                meetingMinutes: a.meeting_notes || '',
                photos: apptPhotos,
                expenses: apptExpsFinal,
              };
            }),
          };

          if (t.approval_status === 'revision_requested') {
            const revMatch = t.manager_feedback?.match(/\[(?:รอบที่|REV:)\s*(\d+)\]/i);
            const revCount = revMatch ? parseInt(revMatch[1], 10) : (Number(t.revision_count) || 1);
            const cleanFeedback = t.manager_feedback?.replace(/\[(?:รอบที่|REV:)\s*\d+\]\s*/i, '').trim() || t.manager_feedback || 'กรุณาตรวจสอบข้อมูลและแนบเอกสารเพิ่มเติม';

            rejected.push({
              ...tripObj,
              revisionCount: revCount,
              managerFeedback: cleanFeedback,
            });
          } else if (t.approval_status === 'approved') {
            const tripDist = t.end_odometer && t.start_odometer ? Math.max(0, t.end_odometer - t.start_odometer) : (t.total_distance_km || 0);
            const tripExpTotal = tripExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            history.push({
              id: t.id,
              tripCode: tripObj.tripCode,
              title: t.title,
              date: tripObj.date,
              dropsCount: totalCount,
              status: 'Approved',
              distance: `${tripDist} กม.`,
              expenses: `฿${tripExpTotal.toLocaleString()}`,
              drops: tripObj.drops,
              startLocation: tripObj.startLocation,
              startOdometer: tripObj.startOdometer,
            });
          } else if (t.approval_status === 'pending') {
            pending.push({
              id: t.id,
              tripCode: tripObj.tripCode,
              title: t.title,
              dropsCount: totalCount,
              completedDropsCount: completedDataCount,
              hasIncompleteDrops: hasIncompleteDrops,
              info: hasIncompleteDrops
                ? (language === 'th'
                    ? `ไม่สมบูรณ์ ${totalCount - completedDataCount} จุด • รออนุมัติ`
                    : `Incomplete (${totalCount - completedDataCount} stops) • Pending`)
                : (language === 'th'
                    ? `ข้อมูลครบ ${totalCount}/${totalCount} จุด • รออนุมัติ`
                    : `All ${totalCount} stops complete • Pending Review`),
              tag: 'Pending Review',
              drops: tripObj.drops,
              startLocation: tripObj.startLocation,
              startOdometer: tripObj.startOdometer,
            });
          } else {
            // Any uncompleted trip (scheduled, in_progress, draft, overdue) is an active/upcoming trip
            upcoming.push(tripObj);
          }
        });

        // Prioritize in-progress and overdue trips first
        upcoming.sort((a, b) => {
          if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
          if (b.status === 'In Progress' && a.status !== 'In Progress') return 1;
          if (a.isOverdue && !b.isOverdue) return -1;
          if (b.isOverdue && !a.isOverdue) return 1;
          return 0;
        });

        setUpcomingTrips(upcoming);
        setRejectedTrips(rejected);
        setPendingActions(pending);
        setRecentHistory(history);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const ensurePermissionsAndFetch = async () => {
      try {
        const fg = await Location.getForegroundPermissionsAsync();
        let bgStatus = Location.PermissionStatus.UNDETERMINED;
        if (Platform.OS === 'android') {
          try {
            const bg = await Location.getBackgroundPermissionsAsync();
            bgStatus = bg.status;
          } catch (e) {}
        } else {
          bgStatus = fg.status;
        }

        const isPermitted = Platform.OS === 'ios'
          ? (fg.status === 'granted')
          : (fg.status === 'granted' && bgStatus === 'granted');

        if (!isPermitted) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'PrivacyConsent' }],
          });
          return;
        }
      } catch (err) {
        console.warn('Error checking permissions in Dashboard:', err);
      }

      startLivePresenceTracking();
      fetchDashboardData();
    };

    ensurePermissionsAndFetch();
    const unsubscribe = navigation.addListener('focus', () => {
      ensurePermissionsAndFetch();
    });
    return unsubscribe;
  }, [navigation]);

  const handleDeleteUpcoming = (id: string) => {
    Alert.alert(
      language === 'th' ? 'ลบแผนงาน / ทริป' : 'Delete Visit Plan',
      language === 'th'
        ? 'คุณต้องการลบแผนงานนี้ออกจากระบบถาวรใช่หรือไม่?'
        : 'Are you sure you want to permanently delete this plan and its stops?',
      [
        { text: t('btn_cancel'), style: 'cancel' },
        {
          text: t('btn_delete'),
          style: 'destructive',
          onPress: async () => {
            if (isDeleting) return;
            setIsDeleting(true);
            try {
              // 1. Delete associated appointments & expenses
              await supabase.from('appointments').delete().eq('trip_id', id);
              await supabase.from('expenses').delete().eq('trip_id', id);
              // 2. Delete trip
              const { error } = await supabase.from('trips').delete().eq('id', id);
              if (error) throw error;

              setUpcomingTrips((prev) => prev.filter((t) => t.id !== id));
              Alert.alert(
                language === 'th' ? 'ลบสำเร็จ' : 'Deleted',
                language === 'th' ? 'ลบแผนงานออกจากระบบเรียบร้อยแล้ว' : 'Visit plan deleted successfully.'
              );
            } catch (err: any) {
              console.error('Delete trip error:', err);
              Alert.alert(
                language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
                err.message || 'Could not delete trip'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleTripCardPress = (trip: any) => {
    if (trip.isOverdue) {
      // Overdue trip: Read-only preview (freeze and view details only)
      navigation.navigate('RoutePreview', {
        tripId: trip.id,
        tripCode: trip.tripCode,
        tripTitle: trip.route,
        scheduledDate: trip.date,
        drops: trip.drops,
        startLocation: trip.startLocation,
        startOdometer: trip.startOdometer,
        isOverdue: true,
      });
      return;
    }

    if (trip.approvalStatus === 'approved') {
      navigation.navigate('TripSummary', {
        tripId: trip.id,
        tripCode: trip.tripCode,
        tripTitle: trip.route,
        drops: trip.drops,
        startLocation: trip.startLocation,
        startOdometer: trip.startOdometer,
        isApproved: true,
      });
      return;
    }

    if (trip.approvalStatus === 'pending') {
      navigation.navigate('TripSummary', {
        tripId: trip.id,
        tripCode: trip.tripCode,
        tripTitle: trip.route,
        drops: trip.drops,
        startLocation: trip.startLocation,
        startOdometer: trip.startOdometer,
        isPendingReview: true,
      });
      return;
    }

    if (trip.approvalStatus === 'revision_requested') {
      navigation.navigate('TripSummary', {
        tripId: trip.id,
        tripCode: trip.tripCode,
        tripTitle: trip.route,
        drops: trip.drops,
        startLocation: trip.startLocation,
        startOdometer: trip.startOdometer,
        isRevision: true,
        revisionCount: trip.revisionCount,
        managerFeedback: trip.managerFeedback,
      });
      return;
    }

    if (trip.status === 'In Progress') {
      if (trip.isFullyVisited || trip.isFullyCompleted) {
        navigation.navigate('TripSummary', {
          tripId: trip.id,
          tripCode: trip.tripCode,
          tripTitle: trip.route,
          drops: trip.drops,
          startLocation: trip.startLocation,
          startOdometer: trip.startOdometer,
        });
      } else {
        navigation.navigate('ActiveTracker', {
          tripId: trip.id,
          tripCode: trip.tripCode,
          tripTitle: trip.route,
          dropsCount: trip.dropsCount,
          drops: trip.drops,
          startLocation: trip.startLocation,
          startOdometer: trip.startOdometer,
        });
      }
    } else {
      navigation.navigate('RoutePreview', {
        tripId: trip.id,
        tripCode: trip.tripCode,
        tripTitle: trip.route,
        scheduledDate: trip.date,
        drops: trip.drops,
        startLocation: trip.startLocation,
        startOdometer: trip.startOdometer,
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => navigation.navigate('UserProfile')}
            activeOpacity={0.8}
          >
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={[styles.avatarImage, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
                <Text style={[styles.avatarInitials, { color: colors.primary }]}>{profile.initials || 'MK'}</Text>
              </View>
            )}
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.greetingText, { color: colors.textSecondary }]} numberOfLines={1}>
                {profile.role || t('role_marketing')}
              </Text>
              <Text style={[styles.userNameText, { color: colors.text }]} numberOfLines={1}>
                {profile.name}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Right Action Icons: Language Switcher & Notifications */}
          <View style={styles.headerRightActions}>
            <LanguageTogglePill />
            <TouchableOpacity
              style={[styles.bellButton, { backgroundColor: colors.surfaceSubtle }]}
              onPress={() => Alert.alert('Notifications', 'No new system alerts.')}
            >
              <Bell size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary CTA: Create New Visit Plan */}
        <TouchableOpacity
          style={[styles.createTripButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('NewAppointment')}
          activeOpacity={0.9}
        >
          <Plus size={18} color="#ffffff" strokeWidth={2.5} />
          <Text style={styles.createTripButtonText}>{t('dash_new_plan')}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1D4ED8']}
            tintColor="#1D4ED8"
          />
        }
      >
        {/* REVISION ALERT BANNER (If Manager Rejected / Requested Revision) */}
        {rejectedTrips.map((revTrip) => (
          <View key={revTrip.id} style={styles.rejectedBannerContainer}>
            <View style={styles.rejectedBannerTop}>
              <View style={styles.rejectedPillBadge}>
                <AlertTriangle size={12} color="#DC2626" />
                <Text style={styles.rejectedPillBadgeText}>
                  {language === 'th'
                    ? `⚠️ ส่งกลับแก้ไข (รอบที่ ${revTrip.revisionCount})`
                    : `⚠️ Revision Required (#${revTrip.revisionCount})`}
                </Text>
              </View>
              <Text style={styles.rejectedTripCode}>{revTrip.tripCode}</Text>
            </View>

            <Text style={styles.rejectedTripTitle}>{revTrip.title}</Text>

            <View style={styles.managerFeedbackCard}>
              <Text style={styles.managerFeedbackTitle}>
                {language === 'th' ? '💬 สิ่งที่ต้องแก้ไข:' : '💬 Feedback:'}
              </Text>
              <Text style={styles.managerFeedbackBody}>"{revTrip.managerFeedback}"</Text>
            </View>

            <TouchableOpacity
              style={styles.resubmitActionBtn}
              onPress={() =>
                navigation.navigate('TripSummary', {
                  tripId: revTrip.id,
                  tripCode: revTrip.tripCode,
                  tripTitle: revTrip.title,
                  isRevision: true,
                  revisionCount: revTrip.revisionCount,
                  managerFeedback: revTrip.managerFeedback,
                  startOdometer: revTrip.startOdometer,
                  drops: revTrip.drops,
                })
              }
              activeOpacity={0.85}
            >
              <Edit3 size={14} color="#FFFFFF" />
              <Text style={styles.resubmitActionBtnText}>
                {language === 'th' ? 'แก้ไขและส่งใหม่' : 'Edit & Resubmit'}
              </Text>
              <ChevronRight size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Section 1: Upcoming & Active Trips */}
        <View style={styles.section}>
          {/* Filter Pills: All / Overdue / Incomplete / Scheduled */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'all' && styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter('all')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                {language === 'th' ? 'ทั้งหมด' : 'All'} ({upcomingTrips.length})
              </Text>
            </TouchableOpacity>

            {upcomingTrips.some((t) => t.isOverdue) && (
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'overdue' && styles.filterPillActiveRose,
                ]}
                onPress={() => setActiveFilter('overdue')}
              >
                <AlertTriangle size={12} color={activeFilter === 'overdue' ? '#FFFFFF' : '#E11D48'} />
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'overdue'
                      ? styles.filterPillTextActiveRose
                      : { color: '#E11D48' },
                  ]}
                >
                  {language === 'th' ? 'งานค้าง' : 'Overdue'} ({upcomingTrips.filter((t) => t.isOverdue).length})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'unconfirmed' && styles.filterPillActiveAmber,
              ]}
              onPress={() => setActiveFilter('unconfirmed')}
            >
              <AlertTriangle size={12} color={activeFilter === 'unconfirmed' ? '#FFFFFF' : '#D97706'} />
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'unconfirmed'
                    ? styles.filterPillTextActiveAmber
                    : { color: '#B45309' },
                ]}
              >
                {language === 'th' ? 'ไม่สมบูรณ์' : 'Incomplete'} ({upcomingTrips.filter((t) => !t.isOverdue && t.hasIncompleteDrops).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'scheduled' && styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter('scheduled')}
            >
              <Clock size={12} color={activeFilter === 'scheduled' ? '#FFFFFF' : '#64748B'} />
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'scheduled' && styles.filterPillTextActive,
                ]}
              >
                {t('dash_scheduled')} ({upcomingTrips.filter((t) => t.status === 'Scheduled' && !t.isOverdue).length})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Overdue Hint Banner if there are pending past trips */}
          {upcomingTrips.some((t) => t.isOverdue) && activeFilter !== 'scheduled' && (
            <View style={styles.overdueNoticeBox}>
              <AlertTriangle size={16} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.overdueNoticeTitle}>
                  {language === 'th' ? 'มีแผนงานค้างจากวันก่อนหน้า' : 'Overdue Visits (Locked)'}
                </Text>
                <Text style={styles.overdueNoticeSub}>
                  {language === 'th'
                    ? 'แผนงานที่เลยกำหนดจะล็อคไว้ให้ดูรายละเอียดเท่านั้น'
                    : 'Overdue plans are read-only. Please create a new visit plan.'}
                </Text>
              </View>
            </View>
          )}

          {upcomingTrips.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Briefcase size={26} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {language === 'th' ? 'ยังไม่มีแผนงานสำหรับวันนี้' : 'No Trips Planned Today'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {language === 'th'
                  ? 'แตะปุ่มด้านล่างเพื่อเริ่มวางแผนเส้นทางและบันทึกการเข้าพบลูกค้ารายแรกของคุณ'
                  : 'Tap below to plan your route and log client visits.'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyCtaButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('NewAppointment')}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.emptyCtaButtonText}>
                  {language === 'th' ? 'สร้างแผนงานใหม่ทันที' : 'Create New Trip'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {(Array.isArray(upcomingTrips)
                ? upcomingTrips.filter((trip) => {
                    if (activeFilter === 'overdue') return trip.isOverdue;
                    if (activeFilter === 'unconfirmed') return !trip.isOverdue && trip.hasIncompleteDrops;
                    if (activeFilter === 'scheduled') return trip.status === 'Scheduled' && !trip.isOverdue;
                    return true;
                  })
                : []
              ).map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={[
                  styles.tripCard,
                  trip.isOverdue && styles.tripCardOverdueBorder,
                  !trip.isOverdue && trip.hasIncompleteDrops && styles.tripCardUnconfirmedBorder,
                ]}
                activeOpacity={0.92}
                onPress={() => handleTripCardPress(trip)}
              >
                <View style={styles.tripCardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.tripDate, trip.isOverdue && { color: '#E11D48', fontWeight: '800' }]}>
                      {trip.date}
                    </Text>
                    <Text style={styles.tripRoute} numberOfLines={2}>
                      {trip.route}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      trip.isOverdue
                        ? styles.statusOverdue
                        : trip.status === 'In Progress'
                        ? (trip.isFullyCompleted
                            ? styles.statusCompletedGreen
                            : (trip.isFullyVisited ? styles.statusIncompleteAmber : styles.statusInProgress))
                        : styles.statusScheduled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        trip.isOverdue
                          ? { color: '#BE123C' }
                          : trip.status === 'In Progress'
                          ? (trip.isFullyCompleted
                              ? { color: '#166534' }
                              : (trip.isFullyVisited ? { color: '#B45309' } : { color: '#166534' }))
                          : { color: '#1D4ED8' },
                      ]}
                    >
                      {trip.isOverdue
                        ? (language === 'th' ? '⚠️ งานค้าง' : '⚠️ Overdue')
                        : trip.status === 'In Progress'
                        ? (trip.isFullyCompleted
                            ? (language === 'th' ? '✓ ร่างสรุปผล' : '✓ Summary Draft')
                            : (trip.isFullyVisited
                                ? (language === 'th' ? '⚠️ ร่าง (ไม่สมบูรณ์)' : '⚠️ Incomplete Draft')
                                : (language === 'th' ? 'กำลังเดินทาง' : 'In Progress')))
                        : (language === 'th' ? 'นัดหมายไว้' : 'Scheduled')}
                    </Text>
                  </View>
                </View>

                {/* Meta Row: Client Count & Drop Confirmation Status */}
                <View style={styles.tripCardMeta}>
                  <View style={styles.tripMetaItem}>
                    <Users size={14} color="#1D4ED8" />
                    <Text style={styles.tripMetaText}>
                      {trip.dropsCount} {language === 'th' ? 'ลูกค้า' : 'Clients'}
                    </Text>
                  </View>

                  {trip.status === 'In Progress' && (
                    <View
                      style={[
                        styles.confirmationBadgePill,
                        trip.isFullyCompleted
                          ? styles.confirmationBadgeGreen
                          : styles.confirmationBadgeAmber,
                      ]}
                    >
                      {trip.isFullyCompleted ? (
                        <CheckCircle2 size={11} color="#166534" />
                      ) : (
                        <AlertTriangle size={11} color="#B45309" />
                      )}
                      <Text
                        style={[
                          styles.confirmationBadgeText,
                          trip.isFullyCompleted
                            ? { color: '#166534' }
                            : { color: '#B45309' },
                        ]}
                      >
                        {trip.isFullyCompleted
                          ? (language === 'th' ? `✓ ครบ ${trip.dropsCount}/${trip.dropsCount} จุด (พร้อมส่ง)` : `✓ ${trip.dropsCount}/${trip.dropsCount} Complete`)
                          : (language === 'th' ? `⚠️ ขาด ${trip.dropsCount - trip.completedDropsCount} จุด` : `⚠️ Missing ${trip.dropsCount - trip.completedDropsCount} stops`)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress Bar for In Progress Trips */}
                {trip.status === 'In Progress' && (
                  <View style={styles.tripProgressBarTrack}>
                    <View
                      style={[
                        styles.tripProgressBarFill,
                        {
                          width: `${Math.min(100, Math.round((trip.completedDropsCount / trip.dropsCount) * 100))}%`,
                          backgroundColor: trip.isFullyCompleted ? '#10B981' : '#F59E0B',
                        },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.tripCardActions}>
                  {trip.isOverdue ? (
                    /* Read-only Details Button for Overdue Trips */
                    <TouchableOpacity
                      style={styles.actionBtnOverdueDetails}
                      onPress={() =>
                        navigation.navigate('RoutePreview', {
                          tripId: trip.id,
                          tripCode: trip.tripCode || `TRP-${trip.id.slice(0, 6).toUpperCase()}`,
                          tripTitle: trip.route,
                          scheduledDate: trip.date,
                          drops: trip.drops,
                          startLocation: trip.startLocation,
                          startOdometer: trip.startOdometer,
                          isOverdue: true,
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <Eye size={14} color="#BE123C" />
                      <Text style={styles.actionBtnOverdueDetailsText}>
                        {language === 'th' ? 'ดูรายละเอียด' : 'View Details'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.actionBtnPrimary,
                        trip.status === 'In Progress' && trip.isFullyCompleted
                          ? styles.actionBtnPrimaryGreen
                          : trip.status === 'In Progress' && trip.isFullyVisited
                          ? styles.actionBtnPrimaryAmber
                          : styles.actionBtnPrimary,
                      ]}
                      onPress={() => {
                        if (trip.status === 'In Progress') {
                          if (trip.isFullyVisited || trip.isFullyCompleted) {
                            navigation.navigate('TripSummary', {
                              tripId: trip.id,
                              tripCode: trip.tripCode,
                              tripTitle: trip.route,
                              drops: trip.drops,
                              startLocation: trip.startLocation,
                              startOdometer: trip.startOdometer,
                            });
                          } else {
                            navigation.navigate('ActiveTracker', {
                              tripId: trip.id,
                              tripCode: trip.tripCode,
                              tripTitle: trip.route,
                              dropsCount: trip.dropsCount,
                              drops: trip.drops,
                              startLocation: trip.startLocation,
                              startOdometer: trip.startOdometer,
                            });
                          }
                        } else {
                          navigation.navigate('RoutePreview', {
                            tripId: trip.id,
                            tripCode: trip.tripCode,
                            tripTitle: trip.route,
                            scheduledDate: trip.date,
                            rawDate: trip.rawDate,
                            drops: trip.drops,
                            startLocation: trip.startLocation,
                            startOdometer: trip.startOdometer,
                          });
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      {trip.status === 'In Progress' ? (
                        trip.isFullyCompleted ? (
                          <>
                            <Send size={14} color="#FFFFFF" />
                            <Text style={styles.actionBtnPrimaryText}>
                              {language === 'th' ? 'ตรวจทาน & ส่งสรุปผล' : 'Review & Submit'}
                            </Text>
                          </>
                        ) : trip.isFullyVisited ? (
                          <>
                            <FileText size={14} color="#FFFFFF" />
                            <Text style={styles.actionBtnPrimaryText}>
                              {language === 'th' ? 'แก้ไขแบบร่างสรุปผล' : 'Edit Summary Draft'}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                            <Text style={styles.actionBtnPrimaryText}>
                              {language === 'th' ? 'เข้าพบต่อ' : 'Continue Visits'}
                            </Text>
                          </>
                        )
                      ) : (
                        <>
                          <Navigation size={14} color="#FFFFFF" />
                          <Text style={styles.actionBtnPrimaryText}>{t('preview_title')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {!trip.isOverdue && (
                    <TouchableOpacity
                      style={styles.actionBtnSecondary}
                      onPress={() => handleDeleteUpcoming(trip.id)}
                    >
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

        {/* Section 2: Pending Approval & Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dash_pending_approval')}</Text>
          <View style={styles.pendingList}>
            {pendingActions.map((action) => (
              <View
                key={action.id}
                style={[
                  styles.pendingCard,
                  action.hasIncompleteDrops && styles.pendingCardUnconfirmed,
                ]}
              >
                <TouchableOpacity
                  style={styles.pendingCardMainRow}
                  onPress={() => navigation.navigate('TripSummary', {
                    tripId: action.id,
                    tripCode: action.tripCode,
                    tripTitle: action.title,
                    drops: action.drops,
                    startLocation: action.startLocation,
                    startOdometer: action.startOdometer,
                    isPendingReview: true,
                  })}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.pendingIconBox,
                      action.hasIncompleteDrops
                        ? { backgroundColor: '#FEF3C7' }
                        : { backgroundColor: '#DCFCE7' },
                    ]}
                  >
                    {action.hasIncompleteDrops ? (
                      <AlertTriangle size={20} color="#D97706" />
                    ) : (
                      <CheckCircle2 size={20} color="#16A34A" />
                    )}
                  </View>
                  <View style={styles.pendingInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={[styles.pendingTitle, { flex: 1 }]} numberOfLines={1}>{action.title}</Text>
                      <View
                        style={[
                          styles.pendingTagBadge,
                          action.hasIncompleteDrops
                            ? styles.pendingTagBadgeAmber
                            : styles.pendingTagBadgeGreen,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pendingTagBadgeText,
                            action.hasIncompleteDrops
                              ? { color: '#B45309' }
                              : { color: '#166534' },
                          ]}
                        >
                          {action.hasIncompleteDrops
                            ? (language === 'th' ? 'ข้อมูลไม่สมบูรณ์' : 'Incomplete')
                            : (language === 'th' ? 'รอ Admin อนุมัติ' : 'Pending Approval')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.pendingMeta} numberOfLines={1}>{action.info}</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* Bottom Action Row: View Report */}
                <View style={styles.pendingActionRow}>
                  <TouchableOpacity
                    style={[styles.viewSummaryBtn, { flex: 1, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}
                    onPress={() => navigation.navigate('TripSummary', {
                      tripId: action.id,
                      tripCode: action.tripCode,
                      tripTitle: action.title,
                      drops: action.drops,
                      startLocation: action.startLocation,
                      startOdometer: action.startOdometer,
                      isPendingReview: true,
                    })}
                    activeOpacity={0.8}
                  >
                    <Eye size={14} color="#1D4ED8" />
                    <Text style={[styles.viewSummaryBtnText, { color: '#1D4ED8', fontWeight: '700' }]}>
                      {language === 'th' ? 'ดูรายงานที่ส่งไป' : 'View Submitted Report'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Section 3: Recent History (ประวัติที่อนุมัติแล้ว) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dash_recent_history')}</Text>
            {recentHistory.length > 0 && (
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountBadgeText}>
                  {recentHistory.length} {language === 'th' ? 'รายการ' : 'trips'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.historyList}>
            {recentHistory.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <CheckCircle2 size={24} color="#94A3B8" />
                <Text style={styles.emptyHistoryText}>
                  {language === 'th' ? 'ยังไม่มีรายการที่อนุมัติแล้ว' : 'No approved trips yet'}
                </Text>
              </View>
            ) : (
              recentHistory.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() =>
                    navigation.navigate('TripSummary', {
                      tripId: item.id,
                      tripCode: item.tripCode,
                      tripTitle: item.title,
                      drops: item.drops,
                      startLocation: item.startLocation,
                      startOdometer: item.startOdometer,
                      isApproved: true,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <View style={styles.historyCardTop}>
                    <View style={styles.historyIconBox}>
                      <CheckCircle2 size={18} color="#166534" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.historyTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyDate}>
                        {item.date} • {item.dropsCount} {language === 'th' ? 'ลูกค้า' : 'clients'}
                      </Text>
                    </View>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>
                        {language === 'th' ? '✓ อนุมัติแล้ว' : '✓ Approved'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#94A3B8" />
                  </View>

                  <View style={styles.historyActionRow}>
                    <Text style={styles.historyMetaText}>
                      {item.distance} • {item.expenses}
                    </Text>
                    <View style={styles.historyViewBtn}>
                      <Eye size={13} color="#166534" />
                      <Text style={styles.historyViewBtnText}>
                        {language === 'th' ? 'ดูรายละเอียด' : 'View Details'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <FloatingBottomNav activeTab="dashboard" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userInfo: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTripButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  createTripButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },
  section: {
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  filterPillActiveAmber: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillTextActiveAmber: {
    color: '#FFFFFF',
  },
  filterPillActiveRose: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  filterPillTextActiveRose: {
    color: '#FFFFFF',
  },
  filterPillActiveGreen: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  filterPillTextActiveGreen: {
    color: '#FFFFFF',
  },
  overdueNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  overdueNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9F1239',
  },
  overdueNoticeSub: {
    fontSize: 11,
    color: '#BE123C',
    marginTop: 1,
  },
  horizontalList: {
    gap: 14,
    paddingRight: 20,
  },
  tripCard: {
    width: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  tripCardOverdueBorder: {
    borderColor: '#FDA4AF',
    borderWidth: 1.5,
    backgroundColor: '#FFFDFD',
  },
  tripCardUnconfirmedBorder: {
    borderColor: '#FCD34D',
    borderWidth: 1.5,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  tripDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  tripRoute: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusOverdue: {
    backgroundColor: '#FFE4E6',
  },
  statusInProgress: {
    backgroundColor: '#DCFCE7',
  },
  statusCompletedGreen: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusIncompleteAmber: {
    backgroundColor: '#FEF3C7',
  },
  statusScheduled: {
    backgroundColor: '#DBEAFE',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tripCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tripMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tripMetaText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  confirmationBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confirmationBadgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  confirmationBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  confirmationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  confirmationBadgeGray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confirmationBadgeGrayText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  tripProgressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tripProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  tripCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtnOverdueDetails: {
    flex: 1,
    backgroundColor: '#FFE4E6',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  actionBtnOverdueDetailsText: {
    color: '#BE123C',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnRollOver: {
    flex: 1,
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnRollOverText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnPrimaryAmber: {
    backgroundColor: '#D97706',
  },
  actionBtnPrimaryGreen: {
    backgroundColor: '#16A34A',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingList: {
    gap: 10,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  pendingCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  recallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  viewSummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewSummaryBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  pendingCardUnconfirmed: {
    borderColor: '#FCD34D',
    borderWidth: 1.5,
    backgroundColor: '#FFFDF5',
  },
  pendingTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingTagBadgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  pendingTagBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  pendingTagBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  pendingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pendingMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyCountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  historyCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  historyList: {
    gap: 10,
  },
  emptyHistoryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  historyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  historyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  historyViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  historyViewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  rejectedBannerContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginBottom: 16,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  rejectedBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rejectedPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectedPillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectedTripCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectedTripTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  managerFeedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  managerFeedbackTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  managerFeedbackBody: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  resubmitActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
  },
  resubmitActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 16,
    gap: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyCtaButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
