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
  Plus,
  Bell,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  LayoutGrid,
  User,
  Users,
  Briefcase,
  Play,
  Navigation,
  ChevronRight,
  RefreshCw,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { startLivePresenceTracking } from '../lib/presenceService';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';
import FloatingBottomNav from '../components/FloatingBottomNav';

export default function DashboardScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const { colors, isDark } = useTheme();

  const [profile, setProfile] = useState<any>({
    name: 'กำลังโหลด...',
    role: 'Field Marketing Specialist',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'unconfirmed' | 'scheduled'>('all');
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [rejectedTrips, setRejectedTrips] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

      setProfile({
        name: prof?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'พนักงานการตลาด',
        role: prof?.position || (prof?.role === 'admin' ? 'System Administrator' : 'Field Marketing Specialist'),
        avatar: prof?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      });

      // 2. Fetch Real Trips for this Specialist
      const { data: tripsData } = await supabase
        .from('trips')
        .select('*, appointments(*)')
        .eq('staff_id', user.id)
        .order('created_at', { ascending: false });

      if (tripsData) {
        const upcoming: any[] = [];
        const rejected: any[] = [];
        const pending: any[] = [];
        const history: any[] = [];

        tripsData.forEach((t: any) => {
          const appts = t.appointments || [];
          const confirmedCount = appts.filter((a: any) => a.confirmation_status).length;
          const totalCount = appts.length;
          const hasUnconfirmed = confirmedCount < totalCount;

          const tripObj = {
            id: t.id,
            tripCode: t.trip_code || `TRP-${t.id.slice(0, 6)}`,
            date: t.trip_date ? new Date(t.trip_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'วันนี้',
            route: t.title || 'เส้นทางเข้าพบลูกค้า',
            status: t.status === 'in_progress' ? 'In Progress' : (t.status === 'completed' ? 'Completed' : 'Scheduled'),
            dropsCount: totalCount,
            confirmedDropsCount: confirmedCount,
            hasUnconfirmedDrops: hasUnconfirmed,
            isStarted: t.status === 'in_progress',
            startOdometer: t.start_odometer?.toString() || '45200',
            drops: appts.map((a: any) => ({
              id: a.id,
              name: a.company_name,
              address: a.destination_address,
              isConfirmed: a.confirmation_status,
              meetingMinutes: a.meeting_notes,
              photos: a.client_photo_url ? [a.client_photo_url] : [],
            })),
          };

          if (t.approval_status === 'revision_requested') {
            rejected.push({
              ...tripObj,
              revisionCount: 1,
              managerFeedback: t.manager_feedback || 'กรุณาตรวจสอบข้อมูลและแนบเอกสารเพิ่มเติม',
            });
          } else if (t.approval_status === 'pending') {
            pending.push({
              id: t.id,
              tripCode: tripObj.tripCode,
              title: t.title,
              dropsCount: totalCount,
              confirmedDropsCount: confirmedCount,
              hasUnconfirmedDrops: hasUnconfirmed,
              info: `เข้าพบแล้ว ${confirmedCount}/${totalCount} จุด • รอผู้จัดการอนุมัติ`,
              tag: 'Pending Review',
            });
          } else if (t.approval_status === 'approved') {
            history.push({
              id: t.id,
              tripCode: tripObj.tripCode,
              title: t.title,
              date: tripObj.date,
              dropsCount: totalCount,
              status: 'Approved',
              distance: `${t.total_distance_km || 0} km`,
              expenses: `฿${t.total_expenses || 0}`,
            });
          } else {
            upcoming.push(tripObj);
          }
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
    startLivePresenceTracking();
    fetchDashboardData();
    const unsubscribe = navigation.addListener('focus', () => {
      startLivePresenceTracking();
      fetchDashboardData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleDeleteUpcoming = (id: string) => {
    Alert.alert(
      language === 'th' ? 'ยกเลิกแผนเข้าพบ' : 'Cancel Visit Plan',
      language === 'th' ? 'คุณต้องการยกเลิกแผนงานนี้ใช่หรือไม่?' : 'Are you sure you want to cancel this plan?',
      [
        { text: t('btn_cancel'), style: 'cancel' },
        {
          text: t('btn_delete'),
          style: 'destructive',
          onPress: () => {
            setUpcomingTrips((prev) => prev.filter((t) => t.id !== id));
          },
        },
      ]
    );
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
            <Image source={{ uri: profile.avatar }} style={[styles.avatarImage, { borderColor: colors.border }]} />
            <View>
              <Text style={[styles.greetingText, { color: colors.textSecondary }]}>{profile.role || t('role_marketing')}</Text>
              <Text style={[styles.userNameText, { color: colors.text }]}>{profile.name}</Text>
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
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
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
                {language === 'th' ? '💬 ข้อความระบุสิ่งที่ต้องแก้ไขจากหัวหน้างาน:' : '💬 Manager Feedback:'}
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
              <Edit2 size={14} color="#FFFFFF" />
              <Text style={styles.resubmitActionBtnText}>
                {language === 'th' ? 'แก้ไขข้อมูลและส่งรายงานใหม่ (Resubmit)' : 'Edit & Resubmit Report'}
              </Text>
              <ChevronRight size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Section 1: Upcoming & Active Trips */}
        <View style={styles.section}>
          {/* Filter Pills: All / Incomplete / Scheduled */}
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
                {t('dash_unconfirmed_badge')} ({upcomingTrips.filter((t) => t.hasUnconfirmedDrops).length})
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
                {t('dash_scheduled')} ({upcomingTrips.filter((t) => t.status === 'Scheduled').length})
              </Text>
            </TouchableOpacity>
          </ScrollView>

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
                    if (activeFilter === 'unconfirmed') return trip.hasUnconfirmedDrops;
                    if (activeFilter === 'scheduled') return trip.status === 'Scheduled';
                    return true;
                  })
                : []
              ).map((trip) => (
              <View
                key={trip.id}
                style={[
                  styles.tripCard,
                  trip.hasUnconfirmedDrops && styles.tripCardUnconfirmedBorder,
                ]}
              >
                <View style={styles.tripCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripDate}>{trip.date}</Text>
                    <Text style={styles.tripRoute} numberOfLines={1}>
                      {trip.route}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      trip.status === 'In Progress'
                        ? (trip.hasUnconfirmedDrops ? styles.statusIncompleteAmber : styles.statusInProgress)
                        : styles.statusScheduled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        trip.status === 'In Progress'
                          ? (trip.hasUnconfirmedDrops ? { color: '#B45309' } : { color: '#166534' })
                          : { color: '#1D4ED8' },
                      ]}
                    >
                      {trip.status === 'In Progress'
                        ? (trip.hasUnconfirmedDrops ? t('dash_unconfirmed_badge') : t('dash_in_progress'))
                        : t('dash_scheduled')}
                    </Text>
                  </View>
                </View>

                {/* Meta Row: Client Count & Drop Confirmation Status */}
                <View style={styles.tripCardMeta}>
                  <View style={styles.tripMetaItem}>
                    <Users size={14} color="#1D4ED8" />
                    <Text style={styles.tripMetaText}>
                      {trip.dropsCount} {t('dash_total_clients')}
                    </Text>
                  </View>

                  {trip.status === 'In Progress' && (
                    <View
                      style={[
                        styles.confirmationBadgePill,
                        trip.hasUnconfirmedDrops
                          ? styles.confirmationBadgeAmber
                          : styles.confirmationBadgeGreen,
                      ]}
                    >
                      {trip.hasUnconfirmedDrops ? (
                        <AlertTriangle size={11} color="#B45309" />
                      ) : (
                        <CheckCircle2 size={11} color="#166534" />
                      )}
                      <Text
                        style={[
                          styles.confirmationBadgeText,
                          trip.hasUnconfirmedDrops
                            ? { color: '#B45309' }
                            : { color: '#166534' },
                        ]}
                      >
                        {trip.hasUnconfirmedDrops
                          ? `${t('dash_unconfirmed_badge')} (${trip.confirmedDropsCount}/${trip.dropsCount})`
                          : `${t('dash_confirmed_badge')} (${trip.dropsCount}/${trip.dropsCount})`}
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
                          width: `${Math.min(100, Math.round((trip.confirmedDropsCount / trip.dropsCount) * 100))}%`,
                          backgroundColor: trip.hasUnconfirmedDrops ? '#F59E0B' : '#10B981',
                        },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.tripCardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtnPrimary,
                      trip.hasUnconfirmedDrops && styles.actionBtnPrimaryAmber,
                    ]}
                    onPress={() => {
                      if (trip.status === 'In Progress') {
                        navigation.navigate('ActiveTracker', {
                          tripTitle: trip.route,
                          dropsCount: trip.dropsCount,
                        });
                      } else {
                        navigation.navigate('RoutePreview', {
                          tripTitle: trip.route,
                          scheduledDate: trip.date,
                        });
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    {trip.status === 'In Progress' ? (
                      <>
                        <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={styles.actionBtnPrimaryText}>
                          {trip.hasUnconfirmedDrops
                            ? (language === 'th' ? 'เข้าพบต่อ' : 'Continue Visits')
                            : t('btn_start_now')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Navigation size={14} color="#FFFFFF" />
                        <Text style={styles.actionBtnPrimaryText}>{t('preview_title')}</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() =>
                      navigation.navigate('NewAppointment', {
                        tripId: trip.id,
                        tripTitle: trip.route,
                      })
                    }
                  >
                    <Edit2 size={14} color="#03246B" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => handleDeleteUpcoming(trip.id)}
                  >
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

        {/* Section 2: Pending Approval & Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dash_pending_approval')}</Text>
          <View style={styles.pendingList}>
            {pendingActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.pendingCard,
                  action.hasUnconfirmedDrops && styles.pendingCardUnconfirmed,
                ]}
                onPress={() => navigation.navigate('TripSummary', { tripTitle: action.title })}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.pendingIconBox,
                    action.hasUnconfirmedDrops
                      ? { backgroundColor: '#FEF3C7' }
                      : { backgroundColor: '#DCFCE7' },
                  ]}
                >
                  {action.hasUnconfirmedDrops ? (
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
                        action.hasUnconfirmedDrops
                          ? styles.pendingTagBadgeAmber
                          : styles.pendingTagBadgeGreen,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pendingTagBadgeText,
                          action.hasUnconfirmedDrops
                            ? { color: '#B45309' }
                            : { color: '#166534' },
                        ]}
                      >
                        {action.hasUnconfirmedDrops
                          ? t('dash_unconfirmed_badge')
                          : t('dash_confirmed_badge')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.pendingMeta} numberOfLines={1}>{action.info}</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section 3: Recent History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('summary_logs')}</Text>
          <View style={styles.historyList}>
            {recentHistory.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyIconBox}>
                  <CheckCircle2 size={18} color="#166534" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyDate}>{item.date}</Text>
                </View>
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>{t('btn_finish')}</Text>
                </View>
              </View>
            ))}
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
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingVertical: 13,
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
    paddingTop: 20,
    paddingBottom: 110,
    gap: 24,
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
  statusInProgress: {
    backgroundColor: '#DCFCE7',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
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
  historyList: {
    gap: 10,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
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
    fontWeight: '600',
    color: '#0F172A',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
