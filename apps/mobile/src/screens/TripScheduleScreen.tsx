import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Car,
  Play,
  Navigation,
  Plus,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Briefcase,
  Users,
  Eye,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';
import FloatingBottomNav from '../components/FloatingBottomNav';

type ViewMode = 'month' | 'week' | 'day';

interface TripItem {
  id: string;
  title: string;
  dateKey: string; // YYYY-MM-DD
  time: string;
  startTime: string; // e.g. "08:30"
  endTime: string; // e.g. "11:45"
  dropsCount: number;
  confirmedDropsCount: number;
  hasUnconfirmedDrops: boolean;
  vehicle: string;
  status: 'In Progress' | 'Scheduled' | 'Completed';
  stops?: {
    time: string;
    client: string;
    contact: string;
    location: string;
    status: 'done' | 'active' | 'pending';
    agenda: string;
  }[];
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES_TH = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const WEEKDAY_NAMES_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TripScheduleScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const { colors, isDark } = useTheme();

  // Current calendar view state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(today.toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [allTrips, setAllTrips] = useState<TripItem[]>([]);

  useEffect(() => {
    async function loadScheduleTrips() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: tripsData } = await supabase
          .from('trips')
          .select('*, appointments(*)')
          .eq('staff_id', user.id)
          .order('trip_date', { ascending: true });

        if (tripsData) {
          const mapped: TripItem[] = tripsData.map((t: any) => {
            const appts = t.appointments || [];
            const confirmedCount = appts.filter((a: any) => a.confirmation_status).length;
            const hasUnconfirmed = confirmedCount < appts.length;
            const dateStr = t.trip_date || new Date().toISOString().split('T')[0];

            return {
              id: t.id,
              title: t.title || 'เส้นทางเข้าพบลูกค้า',
              dateKey: dateStr,
              time: '08:30 AM - 05:00 PM',
              startTime: '08:30',
              endTime: '17:00',
              dropsCount: appts.length,
              confirmedDropsCount: confirmedCount,
              hasUnconfirmedDrops: hasUnconfirmed,
              vehicle: 'Isuzu D-Max (1กข-4452)',
              status: t.status === 'in_progress' ? 'In Progress' : (t.status === 'completed' ? 'Completed' : 'Scheduled'),
              stops: appts.map((a: any) => ({
                time: '09:00 AM',
                client: a.company_name,
                contact: `${a.contact_person || 'ผู้จัดการ'} (${a.contact_phone || '081-000-0000'})`,
                location: a.destination_address,
                status: a.confirmation_status ? 'done' : 'pending',
                agenda: a.visit_agenda || 'demo',
              })),
            };
          });

          setAllTrips(mapped);
        }
      } catch (err) {
        console.error('Error fetching trips for schedule:', err);
      }
    }

    loadScheduleTrips();
    const unsubscribe = navigation.addListener('focus', () => {
      loadScheduleTrips();
    });
    return unsubscribe;
  }, [navigation]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setSelectedDateKey(d.toISOString().split('T')[0]);
  };

  // Get trips for a specific date key (YYYY-MM-DD)
  const getTripsForDate = (dateKey: string) => {
    return allTrips.filter((trip: TripItem) => trip.dateKey === dateKey);
  };

  // Get all dots/badges for a date
  const getDateDots = (dateKey: string) => {
    const trips = getTripsForDate(dateKey);
    if (trips.length === 0) return [];

    const dots: { color: string; id: string }[] = [];
    trips.forEach((trip: TripItem) => {
      if (trip.status === 'In Progress') {
        dots.push({ color: '#10B981', id: trip.id + '-progress' }); // Green
      } else if (trip.hasUnconfirmedDrops) {
        dots.push({ color: '#F59E0B', id: trip.id + '-amber' }); // Amber
      } else if (trip.status === 'Completed') {
        dots.push({ color: '#94A3B8', id: trip.id + '-done' }); // Gray / Done
      } else {
        dots.push({ color: '#1D4ED8', id: trip.id + '-sched' }); // Blue
      }
    });
    return dots.slice(0, 3); // Max 3 dots in cell
  };

  // Helper to build calendar grid for currentMonth & currentYear
  const buildMonthGrid = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // In JS, getDay(): 0 is Sunday, 1 is Mon... 6 is Sat
    // Convert to Monday=0, Tuesday=1 ... Sunday=6
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    // Empty lead cells
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, dateKey: '' });
    }

    // Actual month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
      days.push({
        day: d,
        dateKey,
        isToday: dateKey === '2026-08-19',
      });
    }

    return days;
  };

  // Trips for currently selected date
  const selectedDayTrips = getTripsForDate(selectedDateKey);

  // Formatted date string for selected date
  const formatSelectedDateTitle = () => {
    const parts = selectedDateKey.split('-');
    if (parts.length !== 3) return selectedDateKey;
    const yearNum = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10) - 1;
    const dayNum = parseInt(parts[2], 10);

    const monthName = language === 'th' ? THAI_MONTHS[monthNum] : ENGLISH_MONTHS[monthNum];
    const yearDisplay = language === 'th' ? yearNum + 543 : yearNum;
    return `${dayNum} ${monthName} ${yearDisplay}`;
  };

  const handleTripAction = (trip: TripItem) => {
    if (trip.status === 'In Progress') {
      navigation.navigate('ActiveTracker', {
        tripTitle: trip.title,
        selectedVehicle: trip.vehicle,
      });
    } else {
      navigation.navigate('RoutePreview', {
        tripTitle: trip.title,
        selectedVehicle: trip.vehicle,
        scheduledDate: trip.time,
      });
    }
  };

  // 7 Days of the active week (around selected date)
  const buildWeekStrip = () => {
    const selectedDate = new Date(selectedDateKey);
    // Find Monday of the selected week
    let dayOfWeek = selectedDate.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - dayOfWeek);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dayNum}`;

      const weekdayLabel =
        language === 'th' ? WEEKDAY_NAMES_TH[i] : WEEKDAY_NAMES_EN[i];

      weekDays.push({
        dateKey,
        dayNum: d.getDate(),
        weekdayLabel,
        isToday: dateKey === '2026-08-19',
        isSelected: dateKey === selectedDateKey,
        dots: getDateDots(dateKey),
        tripsCount: getTripsForDate(dateKey).length,
      });
    }
    return weekDays;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surfaceSubtle }]}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.8}
          >
            <ArrowLeft size={18} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('cal_title')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {language === 'th'
                ? `${THAI_MONTHS[currentMonth]} ${currentYear + 543}`
                : `${ENGLISH_MONTHS[currentMonth]} ${currentYear}`}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <LanguageTogglePill />
          <TouchableOpacity
            style={[styles.todayButton, { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder }]}
            onPress={handleJumpToToday}
            activeOpacity={0.8}
          >
            <Text style={[styles.todayButtonText, { color: colors.primary }]}>{t('cal_today')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addTripButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('NewAppointment')}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main View Mode Selector (Month / Week / Day) */}
      <View style={styles.viewModeContainer}>
        <View style={[styles.viewModePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.viewModeTab,
              viewMode === 'month' && styles.viewModeTabActive,
            ]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.8}
          >
            <CalendarIcon
              size={14}
              color={viewMode === 'month' ? '#1D4ED8' : '#64748B'}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'month' && styles.viewModeTextActive,
              ]}
            >
              {t('cal_month_view')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeTab,
              viewMode === 'week' && styles.viewModeTabActive,
            ]}
            onPress={() => setViewMode('week')}
            activeOpacity={0.8}
          >
            <CalendarRange
              size={14}
              color={viewMode === 'week' ? '#1D4ED8' : '#64748B'}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'week' && styles.viewModeTextActive,
              ]}
            >
              {t('cal_week_view')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeTab,
              viewMode === 'day' && styles.viewModeTabActive,
            ]}
            onPress={() => setViewMode('day')}
            activeOpacity={0.8}
          >
            <Clock
              size={14}
              color={viewMode === 'day' ? '#1D4ED8' : '#64748B'}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'day' && styles.viewModeTextActive,
              ]}
            >
              {t('cal_day_view')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* MODE 1: MONTH VIEW (ตารางทั้งเดือน)                        */}
        {/* ========================================================= */}
        {viewMode === 'month' && (
          <View style={styles.calendarCard}>
            {/* Month Header Navigation */}
            <View style={styles.calendarNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color="#03246B" />
              </TouchableOpacity>

              <View style={styles.monthTitleWrapper}>
                <Text style={styles.monthTitleText}>
                  {language === 'th'
                    ? `${THAI_MONTHS[currentMonth]} ${currentYear + 543}`
                    : `${ENGLISH_MONTHS[currentMonth]} ${currentYear}`}
                </Text>
                <Text style={styles.monthTotalAppointmentsText}>
                  {allTrips.filter((t: TripItem) =>
                    t.dateKey.startsWith(
                      `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
                    )
                  ).length}{' '}
                  {t('cal_appointments_count')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <ChevronRight size={20} color="#03246B" />
              </TouchableOpacity>
            </View>

            {/* Weekday Names Header */}
            <View style={styles.weekdaysRow}>
              {(language === 'th' ? WEEKDAY_NAMES_TH : WEEKDAY_NAMES_EN).map(
                (name, idx) => (
                  <View key={idx} style={styles.weekdayCell}>
                    <Text
                      style={[
                        styles.weekdayText,
                        idx >= 5 && styles.weekendText,
                      ]}
                    >
                      {name}
                    </Text>
                  </View>
                )
              )}
            </View>

            {/* Calendar Grid Matrix */}
            <View style={styles.gridContainer}>
              {buildMonthGrid().map((cell, index) => {
                if (!cell.day) {
                  return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                }

                const isSelected = cell.dateKey === selectedDateKey;
                const dots = getDateDots(cell.dateKey);

                return (
                  <TouchableOpacity
                    key={cell.dateKey}
                    style={[
                      styles.dayCell,
                      cell.isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDateKey(cell.dateKey)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        cell.isToday && styles.dayNumberTodayText,
                        isSelected && styles.dayNumberSelectedText,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {/* Status Color Dots */}
                    <View style={styles.dotsRow}>
                      {dots.map((dot) => (
                        <View
                          key={dot.id}
                          style={[
                            styles.dotIndicator,
                            {
                              backgroundColor: isSelected ? '#FFFFFF' : dot.color,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* MODE 2: WEEK VIEW (สัปดาห์)                                */}
        {/* ========================================================= */}
        {viewMode === 'week' && (
          <View style={styles.weekCardWrapper}>
            <View style={styles.weekHeaderRow}>
              <Text style={styles.weekHeaderTitle}>
                {language === 'th' ? 'สัปดาห์นี้' : 'This Week'}
              </Text>
              <Text style={styles.weekHeaderSub}>
                {formatSelectedDateTitle()}
              </Text>
            </View>

            {/* Horizontal 7-Day Strip */}
            <View style={styles.weekDaysGrid}>
              {buildWeekStrip().map((item) => (
                <TouchableOpacity
                  key={item.dateKey}
                  style={[
                    styles.weekDayPill,
                    item.isToday && styles.weekDayPillToday,
                    item.isSelected && styles.weekDayPillSelected,
                  ]}
                  onPress={() => setSelectedDateKey(item.dateKey)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.weekDayName,
                      item.isSelected && styles.weekDayTextSelected,
                    ]}
                  >
                    {item.weekdayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNumber,
                      item.isSelected && styles.weekDayTextSelected,
                    ]}
                  >
                    {item.dayNum}
                  </Text>

                  {/* Dots in Week Pill */}
                  <View style={styles.weekPillDots}>
                    {item.dots.map((dot) => (
                      <View
                        key={dot.id}
                        style={[
                          styles.dotIndicatorSmall,
                          {
                            backgroundColor: item.isSelected
                              ? '#FFFFFF'
                              : dot.color,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* MODE 3: DAY VIEW (รายวัน Timeline)                          */}
        {/* ========================================================= */}
        {viewMode === 'day' && (
          <View style={styles.dayTimelineWrapper}>
            {/* Day Header Info */}
            <View style={styles.dayViewHeader}>
              <View>
                <Text style={styles.dayViewDateTitle}>
                  {formatSelectedDateTitle()}
                </Text>
                <Text style={styles.dayViewSubtitle}>
                  {selectedDayTrips.length}{' '}
                  {language === 'th'
                    ? 'แผนการเดินทางในวันนี้'
                    : 'Scheduled trips today'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.dayAddBtn}
                onPress={() => navigation.navigate('NewAppointment')}
                activeOpacity={0.8}
              >
                <Plus size={14} color="#1D4ED8" />
                <Text style={styles.dayAddBtnText}>
                  {language === 'th' ? 'เพิ่มนัด' : 'Add Stop'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hourly Agenda / Timeline */}
            <View style={styles.timelineCard}>
              <Text style={styles.timelineCardHeading}>
                {t('cal_timeline_heading')}
              </Text>

              {selectedDayTrips.length === 0 ? (
                <View style={styles.emptyDayBox}>
                  <Clock size={32} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>{t('cal_no_trips_for_day')}</Text>
                  <TouchableOpacity
                    style={styles.createTripBtn}
                    onPress={() => navigation.navigate('NewAppointment')}
                    activeOpacity={0.85}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.createTripBtnText}>
                      {t('cal_create_trip_for_date')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {selectedDayTrips.map((trip: TripItem) => (
                    <View key={trip.id} style={styles.timelineTripSection}>
                      <View style={styles.timelineTripHeader}>
                        <View style={styles.tripBadgePill}>
                          <Text style={styles.tripBadgeText}>{trip.id}</Text>
                        </View>
                        <Text style={styles.timelineTripTitle}>
                          {trip.title}
                        </Text>
                      </View>

                      {/* Stops timeline */}
                      {trip.stops?.map((stop: any, sIdx: number) => (
                        <View key={sIdx} style={styles.timelineItemRow}>
                          <View style={styles.timelineTimeColumn}>
                            <Text style={styles.timelineTimeText}>
                              {stop.time}
                            </Text>
                          </View>

                          <View style={styles.timelineNodeColumn}>
                            <View
                              style={[
                                styles.timelineNodeDot,
                                stop.status === 'done' && styles.nodeDone,
                                stop.status === 'active' && styles.nodeActive,
                                stop.status === 'pending' && styles.nodePending,
                              ]}
                            >
                              {stop.status === 'done' ? (
                                <CheckCircle2 size={10} color="#FFFFFF" />
                              ) : (
                                <CircleDot size={8} color="#FFFFFF" />
                              )}
                            </View>
                            {sIdx < (trip.stops?.length || 0) - 1 && (
                              <View style={styles.timelineLine} />
                            )}
                          </View>

                          <View style={styles.timelineContentCard}>
                            <View style={styles.stopCardHeader}>
                              <Text style={styles.stopClientName}>
                                {stop.client}
                              </Text>
                              <View
                                style={[
                                  styles.stopStatusBadge,
                                  stop.status === 'done' && styles.badgeDone,
                                  stop.status === 'active' && styles.badgeActive,
                                  stop.status === 'pending' && styles.badgePending,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.stopStatusBadgeText,
                                    stop.status === 'done' && {
                                      color: '#166534',
                                    },
                                    stop.status === 'active' && {
                                      color: '#1D4ED8',
                                    },
                                    stop.status === 'pending' && {
                                      color: '#64748B',
                                    },
                                  ]}
                                >
                                  {stop.status === 'done'
                                    ? t('btn_finish')
                                    : stop.status === 'active'
                                    ? t('dash_in_progress')
                                    : t('dash_scheduled')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.stopMetaRow}>
                              <Users size={12} color="#64748B" />
                              <Text style={styles.stopMetaText}>
                                {stop.contact}
                              </Text>
                            </View>

                            <View style={styles.stopMetaRow}>
                              <MapPin size={12} color="#1D4ED8" />
                              <Text
                                style={[styles.stopMetaText, { color: '#0F172A' }]}
                                numberOfLines={1}
                              >
                                {stop.location}
                              </Text>
                            </View>

                            <View style={styles.stopAgendaRow}>
                              <Briefcase size={12} color="#64748B" />
                              <Text style={styles.stopAgendaText}>
                                {stop.agenda}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}

                      {/* Quick Start Action inside Day Timeline */}
                      <TouchableOpacity
                        style={[
                          styles.timelineActionBtn,
                          trip.status === 'In Progress' && {
                            backgroundColor: '#10B981',
                          },
                        ]}
                        onPress={() => handleTripAction(trip)}
                        activeOpacity={0.85}
                      >
                        <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={styles.timelineActionBtnText}>
                          {trip.status === 'In Progress'
                            ? t('btn_start_now')
                            : t('btn_start_trip')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* LEGEND BOX (สัญลักษณ์จุดสี)                               */}
        {/* ========================================================= */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>{t('cal_legend_title')}</Text>
          <View style={styles.legendItemsRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: '#1D4ED8' }]}
              />
              <Text style={styles.legendText}>{t('cal_legend_scheduled')}</Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: '#10B981' }]}
              />
              <Text style={styles.legendText}>
                {t('cal_legend_in_progress')}
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: '#F59E0B' }]}
              />
              <Text style={styles.legendText}>
                {t('cal_legend_unconfirmed')}
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: '#94A3B8' }]}
              />
              <Text style={styles.legendText}>{t('cal_legend_completed')}</Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* SELECTED DATE TRIPS LIST (for Month & Week views)         */}
        {/* ========================================================= */}
        {viewMode !== 'day' && (
          <View style={styles.tripsSection}>
            <View style={styles.tripsSectionHeader}>
              <View>
                <Text style={styles.sectionHeaderTitle}>
                  {language === 'th' ? 'รายการนัดหมาย' : 'Visits on'}{' '}
                  {formatSelectedDateTitle()}
                </Text>
                <Text style={styles.sectionHeaderSub}>
                  {selectedDayTrips.length}{' '}
                  {language === 'th'
                    ? 'แผนงานที่บันทึกไว้'
                    : 'Scheduled plans for this date'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addPlanSmallBtn}
                onPress={() => navigation.navigate('NewAppointment')}
                activeOpacity={0.8}
              >
                <Plus size={14} color="#1D4ED8" />
                <Text style={styles.addPlanSmallBtnText}>
                  {language === 'th' ? 'เพิ่มแผน' : 'Add Plan'}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedDayTrips.length === 0 ? (
              <View style={styles.emptyTripsCard}>
                <CalendarIcon size={36} color="#94A3B8" />
                <Text style={styles.emptyTripsTitle}>
                  {t('cal_no_trips_for_day')}
                </Text>
                <Text style={styles.emptyTripsSub}>
                  {language === 'th'
                    ? 'ไม่มีแผนเข้าพบลูกค้าที่กำหนดไว้ในวันที่เลือก'
                    : 'No field visit schedules on the selected date.'}
                </Text>
                <TouchableOpacity
                  style={styles.createTripBtn}
                  onPress={() => navigation.navigate('NewAppointment')}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.createTripBtnText}>
                    {t('cal_create_trip_for_date')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tripsList}>
                {selectedDayTrips.map((trip: TripItem) => (
                  <View key={trip.id} style={styles.tripCard}>
                    {/* Header */}
                    <View style={styles.tripHeaderFlex}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.codeRow}>
                          <Text style={styles.tripCode}>{trip.id}</Text>
                          {trip.hasUnconfirmedDrops && (
                            <View style={styles.unconfirmedBadge}>
                              <AlertTriangle size={10} color="#B45309" />
                              <Text style={styles.unconfirmedBadgeText}>
                                {t('dash_unconfirmed_badge')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.tripTitle}>{trip.title}</Text>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          trip.status === 'In Progress'
                            ? styles.statusActive
                            : trip.status === 'Completed'
                            ? styles.statusCompleted
                            : styles.statusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            trip.status === 'In Progress'
                              ? { color: '#10B981' }
                              : trip.status === 'Completed'
                              ? { color: '#64748B' }
                              : { color: '#1D4ED8' },
                          ]}
                        >
                          {trip.status === 'In Progress'
                            ? t('dash_in_progress')
                            : trip.status === 'Completed'
                            ? t('btn_finish')
                            : t('dash_scheduled')}
                        </Text>
                      </View>
                    </View>

                    {/* Trip details */}
                    <View style={styles.tripDetailsBox}>
                      <View style={styles.detailRow}>
                        <Clock size={13} color="#64748B" />
                        <Text style={styles.detailText}>{trip.time}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MapPin size={13} color="#1D4ED8" />
                        <Text style={styles.detailText}>
                          {trip.dropsCount} {t('dash_total_clients')}
                          {trip.confirmedDropsCount > 0 &&
                            ` (${trip.confirmedDropsCount} ${t('dash_completed_visits')})`}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Car size={13} color="#64748B" />
                        <Text style={styles.detailText}>{trip.vehicle}</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.tripCardActionsRow}>
                      <TouchableOpacity
                        style={styles.previewBtn}
                        onPress={() =>
                          navigation.navigate('RoutePreview', {
                            tripTitle: trip.title,
                            selectedVehicle: trip.vehicle,
                            scheduledDate: trip.time,
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <Eye size={14} color="#1D4ED8" />
                        <Text style={styles.previewBtnText}>
                          {language === 'th' ? 'ดูเส้นทาง' : 'Preview'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.startTripButton,
                          trip.status === 'In Progress' && {
                            backgroundColor: '#10B981',
                          },
                        ]}
                        onPress={() => handleTripAction(trip)}
                        activeOpacity={0.85}
                      >
                        <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={styles.startTripButtonText}>
                          {trip.status === 'In Progress'
                            ? t('btn_start_now')
                            : t('btn_start_trip')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <FloatingBottomNav activeTab="calendar" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#03246B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  todayButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  addTripButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  viewModeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  viewModePill: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 3,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 13,
    gap: 6,
  },
  viewModeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 14,
    paddingBottom: 110, // Extra space for Floating Bottom Nav
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthTitleWrapper: {
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#03246B',
  },
  monthTotalAppointmentsText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  weekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  weekendText: {
    color: '#94A3B8',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.285%',
    height: 48,
  },
  dayCell: {
    width: '14.285%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginVertical: 2,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  dayCellSelected: {
    backgroundColor: '#1D4ED8',
  },
  dayNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dayNumberTodayText: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  dayNumberSelectedText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    height: 6,
  },
  dotIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotIndicatorSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  weekCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  weekHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  weekDaysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  weekDayPillToday: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  weekDayPillSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  weekDayNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  weekDayTextSelected: {
    color: '#FFFFFF',
  },
  weekPillDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 6,
  },
  dayTimelineWrapper: {
    gap: 12,
  },
  dayViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayViewDateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  dayViewSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dayAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 4,
  },
  dayAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  timelineCardHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#03246B',
  },
  emptyDayBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  timelineList: {
    gap: 20,
  },
  timelineTripSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  timelineTripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripBadgePill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tripBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timelineTripTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03246B',
    flex: 1,
  },
  timelineItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timelineTimeColumn: {
    width: 65,
    paddingTop: 2,
  },
  timelineTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  timelineNodeColumn: {
    alignItems: 'center',
    width: 16,
    paddingTop: 4,
  },
  timelineNodeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: {
    backgroundColor: '#10B981',
  },
  nodeActive: {
    backgroundColor: '#1D4ED8',
  },
  nodePending: {
    backgroundColor: '#94A3B8',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 50,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  timelineContentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stopClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  stopStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeDone: {
    backgroundColor: '#DCFCE7',
  },
  badgeActive: {
    backgroundColor: '#DBEAFE',
  },
  badgePending: {
    backgroundColor: '#F1F5F9',
  },
  stopStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  stopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  stopAgendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  stopAgendaText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  timelineActionBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  timelineActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  legendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  tripsSection: {
    gap: 12,
    marginTop: 4,
  },
  tripsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  sectionHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addPlanSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 4,
  },
  addPlanSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  emptyTripsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTripsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  emptyTripsSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
  },
  createTripBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  createTripBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tripsList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  tripHeaderFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  unconfirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unconfirmedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  tripTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
    marginTop: 3,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusPending: {
    backgroundColor: 'rgba(29, 78, 216, 0.1)',
  },
  statusCompleted: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tripDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#475569',
  },
  tripCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  startTripButton: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  startTripButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
