import React, { createContext, useContext, useState } from 'react';

export type Language = 'th' | 'en';

export const translations = {
  th: {
    // Brand & App
    brand_title: 'การตลาดภาคสนาม',
    brand_subtitle: 'ศูนย์วิเคราะห์ข้อมูล',
    role_admin: 'ผู้ดูแลระบบ',
    connected_status: 'เชื่อมต่อระบบเรียบร้อย',
    data_refresh: 'อัปเดตข้อมูลล่าสุด:',

    // Global Actions & Buttons
    btn_save: 'บันทึกข้อมูล',
    btn_save_changes: 'บันทึกการตั้งค่า',
    btn_cancel: 'ยกเลิก',
    btn_close: 'ปิดหน้าต่าง',
    btn_edit: 'แก้ไข',
    btn_delete: 'ลบ',
    btn_confirm: 'ยืนยัน',
    remember_me: 'จดจำการเข้าสู่ระบบ',
    btn_search: 'ค้นหา...',
    btn_export_csv: 'ส่งออก CSV',
    btn_print: 'พิมพ์รายงาน',
    btn_view_details: 'ดูรายละเอียด',
    btn_copy: 'คัดลอก',
    btn_copy_login: 'คัดลอกข้อมูลเข้าสู่ระบบ',
    btn_today: 'วันนี้',
    btn_all: 'ทั้งหมด',
    btn_approve: 'อนุมัติรายงาน',
    btn_reject: 'ส่งกลับแก้ไข',
    btn_resubmit: 'ส่งรายงานใหม่',
    btn_focus_point: 'แสดงเฉพาะคนนี้บนแผนที่',

    // Sidebar & Navigation (Pure Thai)
    nav_dashboard: 'ติดตามพิกัดสด',
    nav_playback: 'ดูเส้นทางย้อนหลัง',
    nav_schedule: 'ปฏิทินแผนงาน',
    nav_history: 'ตรวจรับรายงาน',
    nav_drivers: 'ทีมการตลาด',
    nav_reports: 'รายงานและวิเคราะห์',
    nav_settings: 'ตั้งค่าระบบ',
    nav_profile: 'ข้อมูลส่วนตัว',

    // Header Bar
    header_search_placeholder: 'ค้นหาทริป, พนักงาน, ลูกค้า...',
    header_calendar_btn: 'ปฏิทินงาน',
    header_date_range: 'เลือกช่วงวัน',

    // 1. Live Tracking (Dashboard)
    live_title: 'ติดตามพิกัดสดและจุดหมายถัดไป',
    live_subtitle: 'ติดตามพิกัด ความเร็ว แบตเตอรี่ ทริปปัจจุบัน และจุดหมายถัดไปของทีมการตลาด',
    live_badge: 'สัญญาณพิกัดสด',
    live_filter_all: 'พนักงานทุกคน',
    live_filter_moving: 'กำลังเดินทาง',
    live_filter_stationary: 'หยุดนิ่ง',
    live_current_location: 'พิกัดปัจจุบัน:',
    live_speed: 'ความเร็ว:',
    live_battery: 'แบตเตอรี่:',
    live_charging: 'กำลังชาร์จ',
    live_next_drop: 'จุดหมายถัดไป:',
    live_active_trip: 'ทริปที่กำลังทำ:',
    live_plan_progress: 'ความคืบหน้าจุดเข้าพบ:',
    live_status_running: 'กำลังเดินทาง',
    live_status_stopped: 'หยุดนิ่ง',
    live_status_complete: 'เข้าพบครบทุกจุด',
    live_open_google_maps: 'เปิดแผนที่นำทาง',
    live_focus_single: 'แสดงเฉพาะคนนี้',
    live_show_all: 'แสดงทุกคนบนแผนที่',

    // 2. Trip Schedules & Planning Calendar
    schedule_title: 'ปฏิทินแผนงานและภาระงานทีมการตลาด',
    schedule_subtitle: 'ตรวจดูแผนงานล่วงหน้าและประวัติทริปที่ปิดแล้วรายบุคคล พร้อมเปรียบเทียบภาระงาน',
    schedule_badge: 'ปฏิทินแผนงาน',
    schedule_tab_calendar: 'มุมมองปฏิทิน',
    schedule_tab_timeline: 'มุมมองไทม์ไลน์',
    schedule_workload_title: 'สรุปเปรียบเทียบภาระงานรายบุคคล',
    schedule_all_specialists: 'ดูทุกคน',
    schedule_total_plans: 'แผนรวม',
    schedule_upcoming_plans: 'ล่วงหน้า',
    schedule_completed_plans: 'ปิดแล้ว',
    schedule_density: 'ความหนาแน่นงาน',
    schedule_status_scheduled: 'แผนงานล่วงหน้า',
    schedule_status_inprogress: 'กำลังปฏิบัติงาน',
    schedule_status_completed: 'ปิดทริปสำเร็จ',
    schedule_days_sun: 'อาทิตย์',
    schedule_days_mon: 'จันทร์',
    schedule_days_tue: 'อังคาร',
    schedule_days_wed: 'พุธ',
    schedule_days_thu: 'พฤหัสบดี',
    schedule_days_fri: 'ศุกร์',
    schedule_days_sat: 'เสาร์',
    schedule_modal_title: 'รายละเอียดทริปและผลการเข้าพบย้อนหลัง',
    schedule_origin: 'จุดเริ่มต้นเดินทาง',
    schedule_odometer: 'เลขไมล์เริ่มต้น:',
    schedule_meeting_minutes: 'สรุปบันทึกการประชุมและผลการเจรจา:',
    schedule_photos: 'รูปถ่ายการเข้าพบ:',
    schedule_expenses: 'ค่าใช้จ่ายจุดนี้:',

    // 3. Trip Approvals (VisitHistory)
    approvals_title: 'ตรวจสอบและอนุมัติทริปเข้าพบลูกค้า',
    approvals_subtitle: 'ตรวจสอบทริปที่ปิดจุดเข้าพบครบถ้วน ตรวจสอบรูปถ่ายหน้างาน และสลิปค่าใช้จ่ายแยกแต่ละจุด',
    approvals_tab_pending: 'รออนุมัติ',
    approvals_tab_approved: 'อนุมัติแล้ว',
    approvals_tab_revision: 'ส่งกลับแก้ไข',
    approvals_kpi_pending: 'รอตรวจรับรายงาน',
    approvals_kpi_approved_this_month: 'อนุมัติแล้วเดือนนี้',
    approvals_kpi_total_distance: 'ระยะทางวิ่งจริงรวม',
    approvals_kpi_total_expenses: 'ยอดเบิกจ่ายรวม',
    approvals_modal_audit_title: 'ตรวจรับรายงานทริปแบบละเอียด',
    approvals_reject_reason_label: 'ระบุเหตุผลและสิ่งที่ต้องแก้ไขให้พนักงานทราบ:',
    approvals_reject_placeholder: 'เช่น กรุณาแนบสลิปค่าทางด่วนใหม่อีกครั้ง หรือระบุสรุปการประชุมของจุดที่ 2 เพิ่มเติม...',

    // 4. Marketing Specialists & User Management
    specialists_title: 'จัดการบัญชีผู้ใช้ทีมการตลาด',
    specialists_subtitle: 'จัดการข้อมูลส่วนตัว กำหนดบทบาท สิทธิ์การเข้าใช้งานแอป และข้อมูลบัญชีสำหรับพนักงานภาคสนาม',
    specialists_add_btn: 'เพิ่มพนักงานการตลาด',
    specialists_search_placeholder: 'ค้นหาชื่อ, รหัสพนักงาน, เบอร์โทร, แผนก...',
    specialists_filter_all_dept: 'ทุกแผนก',
    specialists_view_cards: 'การ์ด',
    specialists_view_table: 'ตาราง',
    specialists_modal_add: 'เพิ่มพนักงานการตลาดใหม่',
    specialists_modal_edit: 'แก้ไขข้อมูลพนักงาน',
    specialists_form_fullname: 'ชื่อ - นามสกุล *',
    specialists_form_nickname: 'ชื่อเล่น',
    specialists_form_phone: 'เบอร์โทรศัพท์ติดต่อด่วน *',
    specialists_form_empid: 'รหัสพนักงาน *',
    specialists_form_position: 'ตำแหน่งงาน *',
    specialists_form_department: 'แผนก / ฝ่าย *',
    specialists_form_territory: 'โซนพื้นที่รับผิดชอบ *',
    specialists_form_photo: 'รูปถ่ายโปรไฟล์',
    specialists_form_upload_btn: 'เลือกรูปจากเครื่อง',
    specialists_form_active_toggle: 'เปิดให้เข้าใช้งานแอป',
    specialists_form_active_desc: 'หากปิด พนักงานจะไม่สามารถเข้าสู่ระบบบนแอปมือถือได้',
    specialists_form_login_title: 'ข้อมูลเข้าสู่ระบบแอปพนักงาน',
    specialists_form_email: 'อีเมลเข้าสู่ระบบ *',
    specialists_form_password: 'รหัสผ่าน *',
    specialists_form_generate_pwd: 'สุ่มรหัสผ่าน',
    specialists_form_notes: 'บันทึกเพิ่มเติม',

    // 5. Reports & Analytics
    reports_title: 'สรุปรายงานและวิเคราะห์การเข้าพบลูกค้า',
    reports_subtitle: 'วิเคราะห์สัดส่วนวัตถุประสงค์การเข้าพบ ระยะทางไมล์จริง ค่าใช้จ่ายแยกประเภท และประสิทธิภาพทีมการตลาด',
    reports_preset_today: 'วันนี้',
    reports_preset_last7: '7 วันล่าสุด',
    reports_preset_last30: '30 วันล่าสุด',
    reports_preset_this_month: 'เดือนนี้',
    reports_preset_custom: 'กำหนดช่วงวันเอง',
    reports_period_label: 'ช่วงเวลาที่วิเคราะห์:',
    reports_kpi_visits: 'ยอดเข้าพบลูกค้าทั้งหมด',
    reports_kpi_distance: 'ระยะทางวิ่งจริงทั้งหมด',
    reports_kpi_expenses: 'ค่าใช้จ่ายภาคสนามรวม',
    reports_kpi_avg_cost: 'เฉลี่ยต่อการเข้าพบ 1 จุด',
    reports_kpi_completion: 'สัดส่วนเข้าพบสำเร็จ',
    reports_agenda_distribution_title: 'สัดส่วนวัตถุประสงค์การเข้าพบ',
    reports_agenda_distribution_desc: 'จัดกลุ่มตามตัวเลือก 5 หมวดหมู่วาระการเข้าพบ',
    reports_agenda_pitch: 'นำเสนอโปรเจกต์',
    reports_agenda_renewal: 'ต่อสัญญาและข้อตกลง',
    reports_agenda_healthcheck: 'ตรวจระบบ',
    reports_agenda_demo: 'แนะนำสินค้าและเดโม',
    reports_agenda_other: 'อื่นๆ',
    reports_expense_audit_title: 'การตรวจสอบค่าใช้จ่ายภาคสนาม',
    reports_expense_fuel: 'ค่าน้ำมันรถ',
    reports_expense_tolls: 'ค่าทางด่วน',
    reports_expense_hospitality: 'ค่าอาหารและเลี้ยงรับรอง',
    reports_expense_parking: 'ค่าที่จอดรถ',
    reports_expense_other: 'ค่าใช้จ่ายอื่นๆ',
    reports_leaderboard_title: 'ตารางจัดอันดับผลงานทีมการตลาด',
    reports_sort_visits: 'เรียงตาม: ยอดเข้าพบ',
    reports_sort_distance: 'เรียงตาม: ระยะทาง',
    reports_sort_completion: 'เรียงตาม: อัตราสำเร็จ',
    reports_sort_expenses: 'เรียงตาม: ค่าใช้จ่าย',
    reports_sort_rating: 'เรียงตาม: คะแนนรีวิว',

    // 6. System Settings
    settings_title: 'การตั้งค่าระบบ',
    settings_subtitle: 'จัดการภาษา ธีม และเกณฑ์คำนวณตำแหน่งจากสมาร์ทโฟน',
    settings_tab_general: 'ทั่วไปและภาษา',
    settings_tab_gps: 'ระบบพิกัดและสัญญาณแกว่ง',
    settings_tab_policies: 'กฎการอนุมัติและเบิกจ่าย',
    settings_tab_api: 'การเชื่อมต่อระบบ',
    settings_language_label: 'ภาษาที่ใช้แสดงผล',
    settings_theme_label: 'ธีมการแสดงผล',
    settings_theme_light: '☀️ สว่าง',
    settings_theme_dark: '🌙 มืด',
    settings_theme_system: '💻 ตามระบบ',
    settings_company_name: 'ชื่อหน่วยงาน',
    settings_timezone: 'เขตเวลา',
    settings_operating_hours: 'เวลาทำการภาคสนาม',
    settings_notifications_title: 'การแจ้งเตือนงานทริป',
    settings_gps_title: 'ระบบคำนวณตำแหน่งและป้องกันสัญญาณแกว่งจากสมาร์ทโฟน',
    settings_gps_desc: 'เกณฑ์คำนวณ 3 สถานะสำหรับสมาร์ทโฟน เพื่อความแม่นยำและแสดงผลบนแผนที่สด',
    settings_gps_reset_btn: 'คืนค่าเริ่มต้นสมาร์ทโฟน',
    settings_gps_moving_header: '1. ตรวจการเคลื่อนที่ (สถานะ: กำลังเดินทาง)',
    settings_gps_moving_speed: 'ความเร็วขั้นต่ำ:',
    settings_gps_moving_dist: 'ระยะขยับขั้นต่ำ:',
    settings_gps_static_header: '2. หยุดนิ่งและป้องกันแกว่ง (สถานะ: หยุดนิ่ง / กรองออก)',
    settings_gps_static_speed: 'ความเร็วหยุดนิ่ง:',
    settings_gps_static_radius: 'รัศมีหยุดนิ่ง:',
    settings_gps_drop_label: 'กรองพิกัดสัญญาณแกว่งทิ้งอัตโนมัติ',
    settings_gps_drop_desc: 'ไม่บันทึกพิกัดที่แกว่งหลุดเกณฑ์ลงฐานข้อมูล เพื่อป้องกันเส้นทางกระโดด',
    settings_gps_sandbox_title: 'ทดสอบจำลองค่าจากมือถือ',
    settings_policies_title: 'นโยบายการส่งรายงานทริปและค่าใช้จ่าย',
    settings_api_title: 'การเชื่อมต่อระบบแบบเรียลไทม์',

    // 7. Admin Profile
    profile_title: 'ข้อมูลส่วนตัวผู้ดูแลระบบ',
    profile_subtitle: 'จัดการข้อมูลบัญชีผู้ใช้ ความปลอดภัย และสิทธิ์การเข้าถึงระบบ',
    profile_personal_tab: 'ข้อมูลทั่วไป',
    profile_security_tab: 'ความปลอดภัย & รหัสผ่าน',
    profile_permissions_tab: 'สิทธิ์การเข้าถึงระบบ',
    profile_preferences_tab: 'การตั้งค่าแสดงผล',
    profile_fullname: 'ชื่อ - นามสกุล',
    profile_employee_id: 'รหัสประจำตัว',
    profile_role_title: 'ตำแหน่ง / บทบาท',
    profile_department: 'ฝ่าย / แผนก',
    profile_email: 'อีเมลเข้าสู่ระบบ',
    profile_phone: 'เบอร์โทรศัพท์ติดต่อ',
    profile_location: 'สถานที่ปฏิบัติงาน',
    profile_phase1_badge: 'ข้อมูลเข้าสู่ระบบเริ่มต้น (เฟส 1)',
    profile_phase1_desc: 'บัญชีผู้ดูแลระบบมาตรฐานที่สร้างไว้ในฐานข้อมูลสำหรับทดสอบระบบ',
    profile_current_pwd: 'รหัสผ่านปัจจุบัน',
    profile_new_pwd: 'รหัสผ่านใหม่',
    profile_confirm_pwd: 'ยืนยันรหัสผ่านใหม่',
    profile_update_pwd_btn: 'เปลี่ยนรหัสผ่าน',
    profile_pwd_updated_toast: 'บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว!',
    profile_perms_title: 'สิทธิ์การทำงานที่ได้รับอนุญาต',
    profile_perms_desc: 'บัญชีระดับ Administrator มีสิทธิ์เข้าถึงและควบคุมทุกโมดูลในระบบ',
  },
  en: {
    // Brand & App
    brand_title: 'Field Marketing',
    brand_subtitle: 'Intelligence Hub',
    role_admin: 'Administrator',
    connected_status: 'System Connected',
    data_refresh: 'Last data refresh:',

    // Global Actions & Buttons
    btn_save: 'Save',
    btn_save_changes: 'Save Settings',
    btn_cancel: 'Cancel',
    btn_close: 'Close',
    btn_edit: 'Edit',
    btn_delete: 'Delete',
    btn_confirm: 'Confirm',
    remember_me: 'Remember me',
    btn_search: 'Search...',
    btn_export_csv: 'Export CSV',
    btn_print: 'Print Report',
    btn_view_details: 'View Details',
    btn_copy: 'Copy',
    btn_copy_login: 'Copy Login Info',
    btn_today: 'Today',
    btn_all: 'All',
    btn_approve: 'Approve Trip',
    btn_reject: 'Request Revision',
    btn_resubmit: 'Resubmit Report',
    btn_focus_point: 'Focus Specialist on Map',

    // Sidebar & Navigation (Pure English)
    nav_dashboard: 'Live Tracking',
    nav_playback: 'Route Playback',
    nav_schedule: 'Trip Schedules',
    nav_history: 'Trip Approvals',
    nav_drivers: 'Marketing Specialists',
    nav_reports: 'Reports & Analytics',
    nav_settings: 'System Settings',
    nav_profile: 'Admin Profile',

    // Header Bar
    header_search_placeholder: 'Search trips, specialists, clients...',
    header_calendar_btn: 'Schedules',
    header_date_range: 'Date Range',

    // 1. Live Tracking (Dashboard)
    live_title: 'Live Tracking & Next Destination',
    live_subtitle: 'Real-time GPS coordinates, speed, battery, active trip, and next client drop',
    live_badge: 'Live GPS Feed',
    live_filter_all: 'All Specialists',
    live_filter_moving: 'Moving',
    live_filter_stationary: 'Stationary',
    live_current_location: 'Current Location:',
    live_speed: 'Speed:',
    live_battery: 'Battery:',
    live_charging: 'Charging',
    live_next_drop: 'Next Destination:',
    live_active_trip: 'Active Trip:',
    live_plan_progress: 'Drop Progress:',
    live_status_running: 'Running',
    live_status_stopped: 'Stopped',
    live_status_complete: 'All Drops Confirmed',
    live_open_google_maps: 'Open Navigation',
    live_focus_single: 'Focus Single Specialist',
    live_show_all: 'Show All on Map',

    // 2. Trip Schedules & Planning Calendar
    schedule_title: 'Specialist Schedules & Workload Planning',
    schedule_subtitle: 'Inspect upcoming scheduled visits, past completed audits, and workload distribution',
    schedule_badge: 'Planning Calendar',
    schedule_tab_calendar: 'Calendar Grid',
    schedule_tab_timeline: 'Timeline View',
    schedule_workload_title: 'Specialist Workload Comparison',
    schedule_all_specialists: 'All Specialists',
    schedule_total_plans: 'Total Plans',
    schedule_upcoming_plans: 'Upcoming',
    schedule_completed_plans: 'Completed',
    schedule_density: 'Workload Density',
    schedule_status_scheduled: 'Scheduled Plan',
    schedule_status_inprogress: 'In Progress',
    schedule_status_completed: 'Completed',
    schedule_days_sun: 'Sun',
    schedule_days_mon: 'Mon',
    schedule_days_tue: 'Tue',
    schedule_days_wed: 'Wed',
    schedule_days_thu: 'Thu',
    schedule_days_fri: 'Fri',
    schedule_days_sat: 'Sat',
    schedule_modal_title: 'Trip Details & Historical Visit Audit',
    schedule_origin: 'Starting Location',
    schedule_odometer: 'Start Odometer:',
    schedule_meeting_minutes: 'Meeting Minutes & Deal Summary:',
    schedule_photos: 'Visit Photos:',
    schedule_expenses: 'Drop Expenses:',

    // 3. Trip Approvals (VisitHistory)
    approvals_title: 'Trip Approvals & Audit Hub',
    approvals_subtitle: 'Review completed trips, inspect visit photos, meeting notes, and itemized drop receipts',
    approvals_tab_pending: 'Pending Approval',
    approvals_tab_approved: 'Approved',
    approvals_tab_revision: 'Revision Requested',
    approvals_kpi_pending: 'Pending Reports',
    approvals_kpi_approved_this_month: 'Approved This Month',
    approvals_kpi_total_distance: 'Total Actual Distance',
    approvals_kpi_total_expenses: 'Total Claimed Expenses',
    approvals_modal_audit_title: 'Itemized Multi-Drop Trip Audit',
    approvals_reject_reason_label: 'Specify Feedback / Revision Instructions:',
    approvals_reject_placeholder: 'e.g. Please re-upload receipt slip for Drop 2 or provide meeting notes...',

    // 4. Marketing Specialists & User Management
    specialists_title: 'Marketing Specialists Management',
    specialists_subtitle: 'Manage staff profiles, territory assignments, app access status, and login credentials',
    specialists_add_btn: 'Add Specialist User',
    specialists_search_placeholder: 'Search name, employee ID, phone, department...',
    specialists_filter_all_dept: 'All Departments',
    specialists_view_cards: 'Cards',
    specialists_view_table: 'Table',
    specialists_modal_add: 'Add New Specialist User',
    specialists_modal_edit: 'Edit Specialist User',
    specialists_form_fullname: 'Full Name *',
    specialists_form_nickname: 'Nickname',
    specialists_form_phone: 'Urgent Contact Phone *',
    specialists_form_empid: 'Employee ID *',
    specialists_form_position: 'Job Position *',
    specialists_form_department: 'Department *',
    specialists_form_territory: 'Assigned Territory *',
    specialists_form_photo: 'Profile Photo',
    specialists_form_upload_btn: 'Upload Local File',
    specialists_form_active_toggle: 'Active App Access',
    specialists_form_active_desc: 'If toggled Inactive, this user will be blocked from logging into the mobile app',
    specialists_form_login_title: 'Mobile App Login Credentials',
    specialists_form_email: 'Login Email *',
    specialists_form_password: 'Password *',
    specialists_form_generate_pwd: 'Auto Generate',
    specialists_form_notes: 'Internal Admin Notes',

    // 5. Reports & Analytics
    reports_title: 'Reports & Analytics',
    reports_subtitle: 'Analyze visit agenda categories, actual GPS mileage, expense breakdowns, and staff performance',
    reports_preset_today: 'Today',
    reports_preset_last7: 'Last 7 Days',
    reports_preset_last30: 'Last 30 Days',
    reports_preset_this_month: 'This Month',
    reports_preset_custom: 'Custom Range',
    reports_period_label: 'Analytics Date Range:',
    reports_kpi_visits: 'Total Client Visits',
    reports_kpi_distance: 'Total Actual Distance',
    reports_kpi_expenses: 'Total Field Expenses',
    reports_kpi_avg_cost: 'Avg Cost per Client Visit',
    reports_kpi_completion: 'Visit Completion Rate',
    reports_agenda_distribution_title: 'Visit Agenda Distribution',
    reports_agenda_distribution_desc: 'Categorized according to the 5 official mobile visit agendas',
    reports_agenda_pitch: 'Pitch & Proposal',
    reports_agenda_renewal: 'Renewal & SLA',
    reports_agenda_healthcheck: 'Healthcheck & Integration',
    reports_agenda_demo: 'Demo & Customer Success',
    reports_agenda_other: 'Other & Urgent Follow-up',
    reports_expense_audit_title: 'Expense Category Audit',
    reports_expense_fuel: 'Fuel Top-up',
    reports_expense_tolls: 'Expressway Tolls',
    reports_expense_hospitality: 'Meals & Hospitality',
    reports_expense_parking: 'Parking Fees',
    reports_expense_other: 'Other Expenses',
    reports_leaderboard_title: 'Specialists Performance Leaderboard',
    reports_sort_visits: 'Sort by: Total Visits',
    reports_sort_distance: 'Sort by: Distance',
    reports_sort_completion: 'Sort by: Completion Rate (%)',
    reports_sort_expenses: 'Sort by: Expenses',
    reports_sort_rating: 'Sort by: Rating',

    // 6. System Settings
    settings_title: 'System Settings',
    settings_subtitle: 'Configure language, appearance, and smartphone GPS telemetry engine',
    settings_tab_general: 'General & Language',
    settings_tab_gps: 'GPS Diff & Anti-Drift',
    settings_tab_policies: 'Approval & Policies',
    settings_tab_api: 'API & Connections',
    settings_language_label: 'Display Language',
    settings_theme_label: 'Appearance Theme',
    settings_theme_light: '☀️ Light',
    settings_theme_dark: '🌙 Dark',
    settings_theme_system: '💻 System',
    settings_company_name: 'Company Name',
    settings_timezone: 'Timezone',
    settings_operating_hours: 'Field Operating Hours',
    settings_notifications_title: 'Trip Notifications & Alerts',
    settings_gps_title: 'Smartphone GPS Telemetry & Anti-Drift Engine',
    settings_gps_desc: '3-State evaluation engine for mobile phones to eliminate indoor jitter and stream to Live Map',
    settings_gps_reset_btn: 'Reset Mobile Defaults',
    settings_gps_moving_header: '1. Moving Detection (Status: Running)',
    settings_gps_moving_speed: 'Minimum Speed:',
    settings_gps_moving_dist: 'Minimum Displacement:',
    settings_gps_static_header: '2. Stationary & Anti-Drift (Status: Stopped / Ignore)',
    settings_gps_static_speed: 'Stationary Speed:',
    settings_gps_static_radius: 'Stationary Drift Radius:',
    settings_gps_drop_label: 'Drop Ignore Data from Database',
    settings_gps_drop_desc: 'Do not persist points failing anti-drift to prevent map jumping and GPS jitter',
    settings_gps_sandbox_title: 'Live Smartphone Simulator',
    settings_policies_title: 'Trip Approval & Expense Policies',
    settings_api_title: 'API & Real-time WebSockets',

    // 7. Admin Profile
    profile_title: 'Admin Profile',
    profile_subtitle: 'Manage administrative account credentials, roles, and security policies',
    profile_personal_tab: 'Personal Details',
    profile_security_tab: 'Security & Password',
    profile_permissions_tab: 'Roles & Permissions',
    profile_preferences_tab: 'Preferences',
    profile_fullname: 'Full Name',
    profile_employee_id: 'Employee ID',
    profile_role_title: 'Role & Title',
    profile_department: 'Department',
    profile_email: 'System Email',
    profile_phone: 'Contact Phone',
    profile_location: 'Office Location',
    profile_phase1_badge: 'Default Admin Credentials (Phase 1)',
    profile_phase1_desc: 'Standard administrator account pre-configured in the database for system operations',
    profile_current_pwd: 'Current Password',
    profile_new_pwd: 'New Password',
    profile_confirm_pwd: 'Confirm New Password',
    profile_update_pwd_btn: 'Update Password',
    profile_pwd_updated_toast: 'Changes saved successfully!',
    profile_perms_title: 'Authorized System Capabilities',
    profile_perms_desc: 'Administrator role has complete operational clearance across all modules',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations['th']) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'th',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.th[key] || (key as string),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('web_admin_lang');
    return saved === 'en' || saved === 'th' ? saved : 'th';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('web_admin_lang', lang);
  };

  const toggleLanguage = () => {
    const next = language === 'th' ? 'en' : 'th';
    setLanguage(next);
  };

  const t = (key: keyof typeof translations['th']): string => {
    return translations[language]?.[key] || translations.th[key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

/**
 * Vector SVG Flag of Thailand (100% OS-Independent)
 */
export const ThaiFlagIcon = ({ className = 'w-4 h-3' }: { className?: string }) => (
  <svg className={`${className} rounded-[2px] shadow-2xs shrink-0 overflow-hidden border border-slate-200/60`} viewBox="0 0 900 600">
    <rect fill="#A51931" width="900" height="600" />
    <rect fill="#F4F5F8" y="100" width="900" height="400" />
    <rect fill="#2D2A4A" y="200" width="900" height="200" />
  </svg>
);

/**
 * Vector SVG Flag of United Kingdom / Great Britain (100% OS-Independent)
 */
export const UkFlagIcon = ({ className = 'w-4 h-3' }: { className?: string }) => (
  <svg className={`${className} rounded-[2px] shadow-2xs shrink-0 overflow-hidden border border-slate-200/60`} viewBox="0 0 60 30">
    <clipPath id="uk-flag-svg-clip">
      <path d="M0 0 v30 h60 v-30 z" />
    </clipPath>
    <g clipPath="url(#uk-flag-svg-clip)">
      <path d="M0 0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0 v30 M0 15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0 v30 M0 15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);

/**
 * Modern, clean Language Switcher Toggle Pill with Real SVG Vector Flags
 */
export const LanguageTogglePill = ({ className }: { className?: string }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center p-0.5 bg-slate-100/90 border border-slate-200 rounded-xl shadow-2xs ${className || ''}`}
    >
      <button
        type="button"
        onClick={() => setLanguage('th')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
          language === 'th'
            ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80 scale-100'
            : 'text-slate-500 hover:text-slate-900 opacity-60 hover:opacity-100'
        }`}
        title="เปลี่ยนเป็นภาษาไทย (TH)"
      >
        <ThaiFlagIcon className="w-4 h-2.5" />
        <span className="text-[11px] font-extrabold">TH</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80 scale-100'
            : 'text-slate-500 hover:text-slate-900 opacity-60 hover:opacity-100'
        }`}
        title="Switch to English (EN)"
      >
        <UkFlagIcon className="w-4 h-2.5" />
        <span className="text-[11px] font-extrabold">EN</span>
      </button>
    </div>
  );
};
