import React, { createContext, useContext, useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Globe } from 'lucide-react-native';

export type Language = 'th' | 'en';

export const translations = {
  th: {
    // App & Roles
    app_title: 'Marketing Field Pro',
    app_subtitle: 'ระบบติดตามการเข้าพบลูกค้า',
    role_marketing: 'ฝ่ายการตลาดและลูกค้าสัมพันธ์',
    staff_id: 'รหัสพนักงาน',
    login_email_label: 'อีเมลพนักงาน',
    login_password_label: 'รหัสผ่าน',
    login_btn: 'เข้าสู่ระบบ',
    login_demo: 'โหมดทดลองใช้งาน',
    remember_me: 'จดจำการเข้าสู่ระบบ',

    // Common Buttons & Actions (สั้นกระชับ)
    btn_start_now: 'เริ่มทันที',
    btn_schedule: 'นัดล่วงหน้า',
    btn_confirm: 'ยืนยัน',
    btn_save: 'บันทึก',
    btn_cancel: 'ยกเลิก',
    btn_delete: 'ลบ',
    btn_edit: 'แก้ไข',
    btn_apply: 'นำไปใช้',
    btn_submit: 'ส่งรายงาน',
    btn_next: 'ถัดไป',
    btn_back: 'กลับ',
    btn_close: 'ปิด',
    btn_check_in: 'เช็คอินเข้าพบ',
    btn_finish: 'เสร็จสิ้น',
    btn_add_client: 'เพิ่มลูกค้า',
    btn_reoptimize: 'AI จัดลำดับ',
    btn_open_maps: 'เปิดแผนที่',
    btn_take_photo: 'ถ่ายภาพ',
    btn_attach_slip: 'แนบสลิป',
    btn_save_draft: 'บันทึกร่าง',
    btn_start_trip: 'เริ่มเดินทาง',
    btn_view_all: 'ดูทั้งหมด',

    // Dashboard
    dash_active_trips: 'แผนงานวันนี้',
    dash_total_clients: 'ลูกค้า',
    dash_completed_visits: 'เข้าพบแล้ว',
    dash_new_plan: 'สร้างแผนงาน',
    dash_all_schedule: 'ดูทั้งหมด',
    dash_pending_approval: 'รออนุมัติรายงาน',
    dash_in_progress: 'กำลังเดินทาง',
    dash_scheduled: 'นัดหมายไว้',
    dash_recent_history: 'ประวัติที่อนุมัติแล้ว',
    dash_unconfirmed_badge: 'ไม่สมบูรณ์',
    dash_confirmed_badge: 'ข้อมูลครบ',
    dash_pending_start_badge: 'รอดำเนินการ',
    dash_unconfirmed_tag: 'ไม่สมบูรณ์',
    dash_confirmed_tag: 'ครบ 100%',
    report_unconfirmed_status_text: 'ยังไม่ยืนยัน',
    report_confirmed_status_text: 'ยืนยันแล้ว',

    // Create Plan (NewAppointment)
    plan_title: 'สร้างแผนเข้าพบ',
    plan_mode_instant: 'เริ่มทันที',
    plan_mode_scheduled: 'นัดล่วงหน้า',
    plan_trip_name: 'ชื่องาน / แผนงาน',
    plan_vehicle: 'ยานพาหนะ',
    plan_origin: 'จุดเริ่มต้น',
    plan_origin_confirmed: 'ยืนยันแล้ว',
    plan_origin_pending: 'รอยืนยัน',
    plan_clients_list: 'ลำดับลูกค้า',
    plan_add_stop: 'เพิ่มลูกค้า',
    plan_date_time: 'วัน-เวลานัด',
    plan_confirm_start_btn: 'ยืนยันพิกัด',
    plan_start_btn: 'เริ่มเดินทาง',
    plan_save_btn: 'บันทึกแผน',
    plan_unconfirmed_hint: 'กดยืนยันพิกัดก่อนเริ่ม',

    // Add Client (AddNewDrop)
    add_client_title: 'เพิ่มลูกค้า',
    add_contact_name: 'ผู้ติดต่อ',
    add_contact_placeholder: 'ชื่อผู้ติดต่อ / ตำแหน่ง',
    add_phone: 'เบอร์โทร',
    add_phone_optional: 'ไม่บังคับ',
    add_phone_placeholder: 'เช่น 098-xxx-xxxx หรือ +66 89 xxx xxxx',
    add_company: 'ชื่อบริษัท / ลูกค้า',
    add_company_placeholder: 'ชื่อบริษัท / ร้านค้า',
    add_agenda: 'วาระ / สื่อนำเสนอ',
    add_agenda_placeholder: 'หัวข้อประชุม หรือสื่อที่ใช้',
    add_location: 'สถานที่นัดพบ',
    add_location_placeholder: 'สถานที่ / ชั้น / อาคาร',
    add_search_placeholder: 'ค้นหาสถานที่...',
    add_live_gps: 'พิกัดสด',

    // Route Preview
    preview_title: 'เส้นทางเข้าพบ',
    preview_sequence: 'ลำดับเข้าพบ',
    preview_origin: 'จุดเริ่ม',
    preview_client: 'ลูกค้า',
    preview_distance: 'ระยะทาง',
    preview_est_time: 'เวลาโดยประมาณ',
    preview_clients_count: 'จำนวนลูกค้า',
    preview_agenda_tag: 'วาระ',
    preview_start_odo: 'เลขไมล์เริ่มต้น (Start Odo)',
    preview_start_odo_sub: 'กรอกหรือตรวจสอบเลขไมล์ก่อนกดเริ่มเดินทาง',
    preview_refresh_gps: 'ดึงพิกัด GPS ปัจจุบัน',
    summary_start_location: 'จุดเริ่มต้นเดินทาง',
    summary_edit_start_odo: 'แก้ไขเลขไมล์เริ่มต้น',

    // Active Tracker & Telemetry
    tracker_title: 'ติดตามการเข้าพบ',
    tracker_progress: 'ความคืบหน้า',
    tracker_visited_of: 'เข้าพบแล้ว',
    tracker_of_clients: 'ราย',
    tracker_reorder_btn: 'เพิ่ม/เปลี่ยนเส้นทาง',
    tracker_current_loc: 'ตำแหน่งของคุณ',
    tracker_next_client: 'ลูกค้ารายถัดไป',
    tracker_contact_label: 'ผู้ติดต่อ',
    tracker_all_done: 'เข้าพบครบทุกจุด!',
    tracker_all_done_sub: 'บันทึกข้อมูลเรียบร้อย',
    tracker_telemetry_battery: 'แบตเตอรี่',
    tracker_telemetry_charging: 'ชาร์จไฟ',
    tracker_telemetry_speed: 'ความเร็ว',
    tracker_telemetry_odometer: 'เลขไมล์',
    tracker_telemetry_gps: 'ความแม่นยำ GPS',
    tracker_status_done: 'เข้าพบแล้ว',
    tracker_status_going: 'กำลังไปพบ',
    tracker_status_pending: 'รอดำเนินการ',

    // Edit Trip & AI Optimization
    edit_title: 'แก้ไขแผนเข้าพบ',
    edit_notice: 'เลื่อนขึ้น-ลง หรือใช้ AI ช่วยจัดลำดับ',
    edit_modal_title: 'AI จัดลำดับเส้นทาง',
    edit_modal_sub: 'เลือกจุดเริ่มต้นคำนวณ',
    edit_opt_live_gps: 'GPS ปัจจุบัน',
    edit_opt_manual: 'ปักหมุดเอง',
    edit_opt_original: 'จุดเริ่มต้นเดิม',
    edit_gps_hint: 'คำนวณจากตำแหน่งปัจจุบันไปยังลูกค้าที่เหลือ',
    edit_manual_hint: 'คำนวณโดยเริ่มจากจุดที่ปักหมุด',
    edit_original_hint: 'คำนวณจากจุดเริ่มต้นดั้งเดิม',
    edit_snap_gps_btn: 'ดึงพิกัดปัจจุบัน',

    // Drop Reporting
    report_title: 'บันทึกการเข้าพบ',
    report_confirm_status: 'ยืนยันเข้าพบ',
    report_confirm_sub: 'เปิดสวิตช์เมื่อเข้าพบแล้ว',
    report_odometer: 'เลขไมล์ (กม.)',
    report_odometer_sub: 'บันทึกเลขไมล์ล่าสุด',
    report_meeting_notes: 'บันทึกการประชุม',
    report_meeting_notes_sub: 'สรุปผลและข้อตกลง',
    report_quick_notes: 'ข้อความด่วน',
    report_expenses: 'ค่าใช้จ่าย & สลิป',
    report_expenses_sub: 'ทางด่วน ที่จอดรถ เลี้ยงรับรอง',
    report_add_expense_btn: 'เพิ่มค่าใช้จ่าย',
    report_photos: 'รูปถ่าย & เอกสาร',
    report_photos_sub: 'รูปหน้างาน นามบัตร หรือสลิป',
    report_save_return: 'บันทึก & กลับ',
    report_save_next: 'บันทึก & ถัดไป',
    report_modal_expense_title: 'บันทึกค่าใช้จ่าย',
    report_expense_category: 'ประเภท',
    report_expense_amount: 'จำนวนเงิน (บาท)',
    report_expense_note: 'หมายเหตุ',

    // Summary
    summary_title: 'สรุปรายงานการเข้าพบ',
    summary_total_visits: 'เข้าพบรวม',
    summary_total_distance: 'ระยะทางรวม',
    summary_total_time: 'เวลารวม',
    summary_total_expenses: 'ค่าใช้จ่ายรวม',
    summary_client_expenses: 'ค่าใช้จ่ายแยกตามลูกค้า',
    summary_client_subtotal: 'รวมของลูกค้านี้',
    summary_grand_total: 'ยอดรวมทั้งหมด',
    summary_no_expenses: 'ไม่มีค่าใช้จ่าย',
    summary_items: 'รายการ',
    summary_logs: 'ประวัติการเข้าพบ',
    summary_logs_sub: 'แตะเพื่อแก้ไขย้อนหลัง',
    summary_submit_btn: 'ส่งรายงาน & ขอเบิก',
    summary_draft_btn: 'บันทึกร่าง',

    // Profile & Settings
    profile_title: 'ข้อมูลผู้ใช้งาน',
    profile_sign_out: 'ออกจากระบบ',
    profile_vehicle: 'ยานพาหนะที่ได้รับมอบหมาย',
    profile_license: 'ใบอนุญาตขับขี่',
    profile_phone: 'เบอร์โทรศัพท์',
    profile_email: 'อีเมล',
    profile_stats_completed: 'เข้าพบสำเร็จ',
    profile_stats_rating: 'คะแนนประเมิน',
    profile_stats_ontime: 'ตรงต่อเวลา',
    lang_label: 'ภาษา',

    // Bottom Navigation
    nav_dashboard: 'หน้าหลัก',
    nav_calendar: 'ปฏิทินงาน',
    nav_profile: 'โปรไฟล์',

    // Calendar Screen
    cal_title: 'ปฏิทินงานเข้าพบ',
    cal_month_view: 'ทั้งเดือน',
    cal_week_view: 'สัปดาห์',
    cal_day_view: 'รายวัน',
    cal_today: 'วันนี้',
    cal_legend_title: 'สัญลักษณ์สถานะ',
    cal_legend_scheduled: 'นัดล่วงหน้า',
    cal_legend_in_progress: 'กำลังดำเนินการ',
    cal_legend_unconfirmed: 'ยังไม่ครบทุกจุด',
    cal_legend_completed: 'เสร็จสิ้นแล้ว',
    cal_no_trips_for_day: 'ไม่มีนัดหมายในวันที่เลือก',
    cal_create_trip_for_date: 'สร้างแผนเข้าพบในวันนี้',
    cal_appointments_count: 'นัดหมาย',
    cal_timeline_heading: 'ไทม์ไลน์รายชั่วโมง',
  },
  en: {
    // App & Roles
    app_title: 'Marketing Field Pro',
    app_subtitle: 'Field Marketing Client Visit Tracker',
    role_marketing: 'Field Marketing Specialist',
    staff_id: 'Staff ID',
    login_email_label: 'Staff Email',
    login_password_label: 'Password',
    login_btn: 'Sign In',
    login_demo: 'Demo Mode',
    remember_me: 'Remember Me',

    // Common Buttons & Actions (Crisp & Short)
    btn_start_now: 'Start Now',
    btn_schedule: 'Schedule',
    btn_confirm: 'Confirm',
    btn_save: 'Save',
    btn_cancel: 'Cancel',
    btn_delete: 'Delete',
    btn_edit: 'Edit',
    btn_apply: 'Apply',
    btn_submit: 'Submit Report',
    btn_next: 'Next',
    btn_back: 'Back',
    btn_close: 'Close',
    btn_check_in: 'Check-in',
    btn_finish: 'Finish',
    btn_add_client: 'Add Client',
    btn_reoptimize: 'AI Re-Order',
    btn_open_maps: 'Open Maps',
    btn_take_photo: 'Take Photo',
    btn_attach_slip: 'Attach Slip',
    btn_save_draft: 'Save Draft',
    btn_start_trip: 'Start Route',
    btn_view_all: 'View All',

    // Dashboard
    dash_active_trips: "Today's Visits",
    dash_total_clients: 'Clients',
    dash_completed_visits: 'Visited',
    dash_new_plan: 'New Plan',
    dash_all_schedule: 'View All',
    dash_pending_approval: 'Pending Approval',
    dash_in_progress: 'In Progress',
    dash_scheduled: 'Scheduled',
    dash_recent_history: 'Approved History',
    dash_unconfirmed_badge: 'Incomplete',
    dash_confirmed_badge: 'Complete',
    dash_pending_start_badge: 'Pending',
    dash_unconfirmed_tag: 'Incomplete',
    dash_confirmed_tag: 'Complete',
    report_unconfirmed_status_text: 'Unconfirmed',
    report_confirmed_status_text: 'Confirmed',

    // Create Plan (NewAppointment)
    plan_title: 'Create Visit Plan',
    plan_mode_instant: 'Start Now',
    plan_mode_scheduled: 'Schedule',
    plan_trip_name: 'Plan Name',
    plan_vehicle: 'Vehicle',
    plan_origin: 'Start Location',
    plan_origin_confirmed: 'Confirmed',
    plan_origin_pending: 'Pending',
    plan_clients_list: 'Client Sequence',
    plan_add_stop: 'Add Client',
    plan_date_time: 'Date & Time',
    plan_confirm_start_btn: 'Confirm Location',
    plan_start_btn: 'Start Route',
    plan_save_btn: 'Save Plan',
    plan_unconfirmed_hint: 'Confirm location first',

    // Add Client (AddNewDrop)
    add_client_title: 'Add Client',
    add_contact_name: 'Contact',
    add_contact_placeholder: 'Name and designation',
    add_phone: 'Phone',
    add_phone_optional: 'Optional',
    add_phone_placeholder: 'e.g. 098-xxx-xxxx or +66 89 xxx xxxx',
    add_company: 'Company / Client',
    add_company_placeholder: 'Company or store name',
    add_agenda: 'Agenda / Materials',
    add_agenda_placeholder: 'Topic or materials',
    add_location: 'Location',
    add_location_placeholder: 'Address / Floor / Building',
    add_search_placeholder: 'Search location...',
    add_live_gps: 'Live GPS',

    // Route Preview
    preview_title: 'Route Preview',
    preview_sequence: 'Sequence',
    preview_origin: 'Origin',
    preview_client: 'Client',
    preview_distance: 'Distance',
    preview_est_time: 'Est. Duration',
    preview_clients_count: 'Clients',
    preview_agenda_tag: 'Agenda',
    preview_start_odo: 'Starting Odometer',
    preview_start_odo_sub: 'Input or verify odometer before starting route',
    preview_refresh_gps: 'Use Live Device GPS',
    summary_start_location: 'Trip Starting Origin',
    summary_edit_start_odo: 'Edit Start Odometer',

    // Active Tracker & Telemetry
    tracker_title: 'Live Tracker',
    tracker_progress: 'Progress',
    tracker_visited_of: 'Completed',
    tracker_of_clients: 'clients',
    tracker_reorder_btn: 'Edit Route',
    tracker_current_loc: 'Current Location',
    tracker_next_client: 'Next Client',
    tracker_contact_label: 'Contact',
    tracker_all_done: 'All Visits Complete!',
    tracker_all_done_sub: 'All clients logged',
    tracker_telemetry_battery: 'Battery',
    tracker_telemetry_charging: 'Charging',
    tracker_telemetry_speed: 'Speed',
    tracker_telemetry_odometer: 'Odometer',
    tracker_telemetry_gps: 'GPS Accuracy',
    tracker_status_done: 'Visited',
    tracker_status_going: 'En Route',
    tracker_status_pending: 'Pending',

    // Edit Trip & AI Optimization
    edit_title: 'Edit Plan',
    edit_notice: 'Reorder manually or use AI',
    edit_modal_title: 'AI Route Optimizer',
    edit_modal_sub: 'Select origin point',
    edit_opt_live_gps: 'Live GPS',
    edit_opt_manual: 'Manual Pin',
    edit_opt_original: 'Original Start',
    edit_gps_hint: 'Optimize from current live GPS',
    edit_manual_hint: 'Optimize from custom map pin',
    edit_original_hint: 'Optimize from original start point',
    edit_snap_gps_btn: 'Snap to Live GPS',

    // Drop Reporting
    report_title: 'Visit Report',
    report_confirm_status: 'Confirm Visit',
    report_confirm_sub: 'Toggle on when meeting done',
    report_odometer: 'Odometer (km)',
    report_odometer_sub: 'Current vehicle mileage',
    report_meeting_notes: 'Meeting Minutes',
    report_meeting_notes_sub: 'Notes and agreements',
    report_quick_notes: 'Quick Notes',
    report_expenses: 'Expenses & Slips',
    report_expenses_sub: 'Tolls, parking, client meals',
    report_add_expense_btn: 'Add Expense',
    report_photos: 'Photos & Proof',
    report_photos_sub: 'Meeting photos or slips',
    report_save_return: 'Save & Return',
    report_save_next: 'Save & Next',
    report_modal_expense_title: 'Add Expense',
    report_expense_category: 'Category',
    report_expense_amount: 'Amount (THB)',
    report_expense_note: 'Note',

    // Summary
    summary_title: 'Field Visit Summary',
    summary_total_visits: 'Total Visits',
    summary_total_distance: 'Total Distance',
    summary_total_time: 'Total Time',
    summary_total_expenses: 'Total Expenses',
    summary_client_expenses: 'Expenses by Client',
    summary_client_subtotal: 'Client Subtotal',
    summary_grand_total: 'Grand Total',
    summary_no_expenses: 'No expenses',
    summary_items: 'items',
    summary_logs: 'Visit Logs',
    summary_logs_sub: 'Tap to review & edit',
    summary_submit_btn: 'Submit Report',
    summary_draft_btn: 'Save Draft',

    // Profile & Settings
    profile_title: 'User Profile',
    profile_sign_out: 'Sign Out',
    profile_vehicle: 'Assigned Fleet Vehicle',
    profile_license: 'Driving License',
    profile_phone: 'Phone Number',
    profile_email: 'Email Address',
    profile_stats_completed: 'Completed Visits',
    profile_stats_rating: 'Rating Score',
    profile_stats_ontime: 'On-Time Rate',
    lang_label: 'Language',

    // Bottom Navigation
    nav_dashboard: 'Dashboard',
    nav_calendar: 'Calendar',
    nav_profile: 'Profile',

    // Calendar Screen
    cal_title: 'Visit Calendar',
    cal_month_view: 'Month',
    cal_week_view: 'Week',
    cal_day_view: 'Day',
    cal_today: 'Today',
    cal_legend_title: 'Status Indicators',
    cal_legend_scheduled: 'Scheduled',
    cal_legend_in_progress: 'In Progress',
    cal_legend_unconfirmed: 'Incomplete Visits',
    cal_legend_completed: 'Completed',
    cal_no_trips_for_day: 'No appointments on this date',
    cal_create_trip_for_date: 'Create Plan for this Date',
    cal_appointments_count: 'Visits',
    cal_timeline_heading: 'Hourly Timeline',
  },
};

export const QUICK_EXPENSE_CATEGORIES = {
  th: [
    'ค่าทางด่วน',
    'ค่าอาหาร / เลี้ยงรับรองลูกค้า',
    'ค่าที่จอดรถ',
    'ค่าน้ำมัน',
    'อื่นๆ (โปรดระบุ)',
  ],
  en: [
    'Toll Fee',
    'Meals & Client Hospitality',
    'Parking Fee',
    'Fuel',
    'Other (Please specify)',
  ],
};

export const QUICK_NOTE_TEMPLATES = {
  th: [
    'นำเสนอแผนการตลาดและผลิตภัณฑ์เรียบร้อย ลูกค้าสนใจขอใบเสนอราคา',
    'ประชุมติดตามความคืบหน้าโปรเจกต์ ลูกค้าพึงพอใจ นัดส่งมอบงวดถัดไป',
    'เข้าพบบอร์ดบริหารเพื่อแนะนำโซลูชันใหม่ พร้อมส่งมอบเอกสารและตัวอย่าง',
    'ลูกค้าขอปรับลดสเปกและขอนัดประชุมร่วมกับทีมเทคนิคในสัปดาห์หน้า',
  ],
  en: [
    'Presented marketing plan and product demo. Client requested price quotation.',
    'Follow-up meeting completed. Client satisfied, scheduled next phase delivery.',
    'Met with executive team to introduce solutions and handed over brochures & samples.',
    'Client requested specification adjustments and follow-up technical call next week.',
  ],
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations['th']) => string;
  expenseCategories: string[];
  noteTemplates: string[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'th',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.th[key] || (key as string),
  expenseCategories: QUICK_EXPENSE_CATEGORIES.th,
  noteTemplates: QUICK_NOTE_TEMPLATES.th,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('th');

  useEffect(() => {
    AsyncStorage.getItem('app_lang').then((saved) => {
      if (saved === 'en' || saved === 'th') {
        setLanguageState(saved);
      }
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('app_lang', lang).catch(() => {});
  };

  const toggleLanguage = () => {
    const next = language === 'th' ? 'en' : 'th';
    setLanguage(next);
  };

  const t = (key: keyof typeof translations['th']): string => {
    return translations[language]?.[key] || translations.th[key] || (key as string);
  };

  const expenseCategories = QUICK_EXPENSE_CATEGORIES[language] || QUICK_EXPENSE_CATEGORIES.th;
  const noteTemplates = QUICK_NOTE_TEMPLATES[language] || QUICK_NOTE_TEMPLATES.th;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, expenseCategories, noteTemplates }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

/**
 * Modern, clean Language Switcher Toggle Pill
 */
export const LanguageTogglePill = ({ style }: { style?: any }) => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <TouchableOpacity
      style={[styles.toggleContainer, style]}
      onPress={toggleLanguage}
      activeOpacity={0.8}
    >
      <Globe size={13} color="#1D4ED8" />
      <View style={styles.badgeWrapper}>
        <Text style={[styles.langText, language === 'th' && styles.langTextActive]}>TH</Text>
        <Text style={styles.divider}>/</Text>
        <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 18,
    gap: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  langText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  langTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  divider: {
    fontSize: 10,
    color: '#CBD5E1',
  },
});
