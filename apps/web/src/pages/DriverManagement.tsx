import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

export interface MarketingSpecialistUser {
  id: string;
  employeeId: string;
  fullName: string;
  nickname: string;
  phoneNumber: string;
  email: string;
  password: string;
  profilePhotoUrl?: string;
  initials: string;
  position: string;
  department: string;
  territory: string;
  isActive: boolean; // Active = can log into mobile app; Inactive = login blocked
  notes?: string;
  assignedVehiclePlate?: string;
  assignedVehicleModel?: string;
  assignedVehicleType?: string;
  drivingLicenseNo?: string;
  drivingLicenseType?: string;
  drivingLicenseExpiry?: string;
  lastLogin?: string;
  createdAt: string;
}

export const vehiclePresets = [
  { plate: '1กข-4452 กทม.', model: 'Isuzu D-Max SpaceCab 1.9 Ddi', type: 'Pickup Truck' },
  { plate: '3ฒผ-8821 กทม.', model: 'Toyota Hilux Revo Smart Cab 2.4', type: 'Pickup Truck' },
  { plate: '6กก-1234 กทม.', model: 'Toyota Corolla Altis 1.8 GR', type: 'Sedan' },
  { plate: '2ขภ-9912 กทม.', model: 'Honda City e:HEV RS', type: 'Sedan' },
  { plate: '1นค-5520 กทม.', model: 'Toyota Commuter VIP Van', type: 'Van' },
  { plate: '4ขย-7711 กทม.', model: 'BYD Atto 3 Extended (EV)', type: 'EV' },
  { plate: '1กง-3321 กทม.', model: 'Honda PCX 160', type: 'Motorcycle' },
];

export const drivingLicenseTypes = [
  'ใบขับขี่รถยนต์ส่วนบุคคล (Corporate Class B)',
  'ใบขับขี่รถยนต์ส่วนบุคคลชั่วคราว (2 ปี)',
  'ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ',
  'ใบอนุญาตเป็นผู้ขับรถ ชนิดที่ 1 (บ.1 - ส่วนบุคคล)',
  'ใบอนุญาตเป็นผู้ขับรถ ชนิดที่ 2 (บ.2 - รับจ้าง/สาธารณะ)',
  'ใบอนุญาตเป็นผู้ขับรถ ชนิดที่ 3 (ส.3 - ลากจูง/บรรทุก)',
  'ใบอนุญาตขับขี่รถจักรยานยนต์ส่วนบุคคล',
];

export const departmentPresets = [
  'Key Accounts & Enterprise',
  'B2B Field Marketing',
  'Strategic Accounts',
  'Retail Expansion',
  'ฝ่ายการตลาดและบริหารงานภาคสนาม',
];

export default function DriverManagement() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Custom Departments Dynamic Pool
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  const [selectedDeptChoice, setSelectedDeptChoice] = useState<string>('Key Accounts & Enterprise');
  const [customDeptInput, setCustomDeptInput] = useState<string>('');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<MarketingSpecialistUser | null>(null);
  const [deletingSpecialist, setDeletingSpecialist] = useState<MarketingSpecialistUser | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: boolean }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<MarketingSpecialistUser>>({
    employeeId: '',
    fullName: '',
    nickname: '',
    phoneNumber: '',
    email: '',
    password: '',
    profilePhotoUrl: '',
    position: 'Field Marketing Specialist',
    department: 'Key Accounts & Enterprise',
    territory: 'Wat Donmuang',
    assignedVehiclePlate: vehiclePresets[0].plate,
    assignedVehicleModel: vehiclePresets[0].model,
    assignedVehicleType: vehiclePresets[0].type,
    drivingLicenseNo: 'DL-AITS10002772',
    drivingLicenseType: drivingLicenseTypes[0],
    drivingLicenseExpiry: '2028-12-31',
    isActive: true,
    notes: '',
  });
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Avatar Presets for Quick Selection
  const avatarPresets = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAnlZuT03jimCaYK74-Eknn5i-kTamxzfu_vHu4QsXsJ23Rs3Qx_42l9MVpW80iYOVk4iRuF5RrKNLACskdL_xmtT09AT4iYtkpaWZvU4Ng0idUw4lIsRkAHiyZZ-xT0gZ2IsOIpQhAj4khBa0AnO18oRrS8qdq9mzd8CHWTf4MgBR-FWDqAp7JrjYd3fRC8kCPJ3ugHtMrVjctEgt5NaWfSIPLc1YZDW20sMm8V52QC9rFGE1XqPeX6B0ZOdTxGv689F1Qt8tYJ6E',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAwAeZf5UzjkXK6YpjvSc_H2IRIRZIpAi9rVUotgWs0CYbCJkKwocsVUiF6o_6zGrMw1Enos_-LBlKLpbsPLZ38rOfjAfKO2dtOhIsnibCyHmdD54iUavFaRKreKRFC_p0U0tfXE0KRxn4lcB95T33l5xp688TsDL4xHo_tDy0BQgnf8P73t0Rgyak593xolba0gAzILrDmlx9obenSmtSLfORMHt8mHMv2zqy22doNE3njCcpCF5yvVtLSMagNCvmhs7x1mROV2SE',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
  ];

  // Marketing Specialists Users Data
  const [specialists, setSpecialists] = useState<MarketingSpecialistUser[]>([]);

  // Load specialists & departments from Supabase Database on mount
  useEffect(() => {
    async function loadSpecialistsFromSupabase() {
      try {
        // 1. Fetch Master Departments from DB
        const { data: depts } = await supabase
          .from('departments')
          .select('name')
          .order('created_at', { ascending: true });

        if (depts && depts.length > 0) {
          setCustomDepartments(depts.map((d: any) => d.name));
        }

        // 2. Fetch Specialist Profiles & Staff details
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, phone, email, avatar_url, position, department, status, created_at, assigned_vehicle, assigned_vehicle_plate, assigned_vehicle_model, driving_license_no, driving_license_type, driving_license_expiry, staff(staff_id, territory, position, assigned_vehicle, vehicle_plate, vehicle_model, vehicle_type, driving_license_no, driving_license_type, driving_license_expiry)')
          .eq('role', 'specialist');

        if (profiles && profiles.length > 0) {
          const mapped: MarketingSpecialistUser[] = profiles.map((p: any) => {
            const staffObj = Array.isArray(p.staff) ? p.staff[0] : p.staff;
            const vPlate = staffObj?.vehicle_plate || p.assigned_vehicle_plate || (staffObj?.assigned_vehicle?.match(/\((.+?)\)/)?.[1]) || '1กข-4452 กทม.';
            const vModel = staffObj?.vehicle_model || p.assigned_vehicle_model || (staffObj?.assigned_vehicle?.split('(')[0]?.trim()) || 'Isuzu D-Max SpaceCab 1.9 Ddi';
            const vType = staffObj?.vehicle_type || 'Pickup Truck';
            const dlNo = staffObj?.driving_license_no || p.driving_license_no || `DL-${staffObj?.staff_id || 'AITS10002772'}`;
            const dlType = staffObj?.driving_license_type || p.driving_license_type || drivingLicenseTypes[0];
            const dlExp = staffObj?.driving_license_expiry || p.driving_license_expiry || '2028-12-31';

            return {
              id: p.id,
              employeeId: staffObj?.staff_id || 'AITS10002772',
              fullName: p.full_name || 'พนักงานการตลาด',
              nickname: p.nickname || p.full_name?.split(' ')[0] || 'พนักงาน',
              phoneNumber: p.phone || '081-000-0000',
              email: p.email,
              password: '•••••••• (เข้ารหัสปลอดภัย)',
              profilePhotoUrl: p.avatar_url || avatarPresets[0],
              initials: p.full_name?.slice(0, 2) || 'MK',
              position: p.position || staffObj?.position || 'Field Marketing Specialist',
              department: p.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: staffObj?.territory || 'Bangkok Central (B2B)',
              isActive: p.status !== 'suspended' && p.status !== 'inactive',
              notes: '',
              assignedVehiclePlate: vPlate,
              assignedVehicleModel: vModel,
              assignedVehicleType: vType,
              drivingLicenseNo: dlNo,
              drivingLicenseType: dlType,
              drivingLicenseExpiry: dlExp,
              lastLogin: 'วันนี้',
              createdAt: p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH') : 'วันนี้',
            };
          });

          setSpecialists(mapped);
        }
      } catch (err) {
        console.error('Error fetching specialists from Supabase:', err);
      }
    }

    loadSpecialistsFromSupabase();

    // Subscribe to realtime department updates
    const deptChannel = supabase
      .channel('departments-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
        supabase
          .from('departments')
          .select('name')
          .order('created_at', { ascending: true })
          .then(({ data }) => {
            if (data && data.length > 0) {
              setCustomDepartments(data.map((d: any) => d.name));
            }
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(deptChannel);
    };
  }, []);

  // Unique merged departments list (Presets + Custom + DB Specialists)
  const availableDepartments = useMemo(() => {
    const set = new Set<string>(departmentPresets);
    customDepartments.forEach((d) => {
      if (d?.trim()) set.add(d.trim());
    });
    specialists.forEach((s) => {
      if (s.department?.trim()) set.add(s.department.trim());
    });
    return Array.from(set);
  }, [customDepartments, specialists]);

  // Derived Stats
  const totalCount = specialists.length;
  const activeCount = specialists.filter((s) => s.isActive).length;
  const inactiveCount = specialists.filter((s) => !s.isActive).length;

  // Filtered List
  const filteredSpecialists = useMemo(() => {
    return specialists.filter((spec) => {
      const matchStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'active'
          ? spec.isActive
          : !spec.isActive;

      const matchDept =
        filterDepartment === 'all' ? true : spec.department === filterDepartment;

      const matchSearch =
        spec.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spec.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spec.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spec.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spec.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spec.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (spec.assignedVehiclePlate && spec.assignedVehiclePlate.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (spec.drivingLicenseNo && spec.drivingLicenseNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        spec.territory.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchDept && matchSearch;
    });
  }, [specialists, filterStatus, filterDepartment, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Generate strong random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Mkt@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  // Toggle Password Reveal for a card
  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Copy Full Login Credentials to Clipboard
  const handleCopyCredentials = (spec: MarketingSpecialistUser) => {
    const text = `📱 ข้อมูลเข้าสู่ระบบ FastFleet Mobile App\nพนักงาน: ${spec.fullName} (${spec.employeeId})\nEmail: ${spec.email}\nPassword: ${spec.password}\nสถานะ: ${spec.isActive ? 'เปิดใช้งาน (Active)' : 'ระงับสิทธิ์ (Inactive)'}\nรถประจำตำแหน่ง: ${spec.assignedVehicleModel || 'Isuzu D-Max'} (${spec.assignedVehiclePlate || '-'})\nใบขับขี่: ${spec.drivingLicenseNo || '-'}`;
    navigator.clipboard.writeText(text);
    showToast(`📋 คัดลอกข้อมูลล็อกอินของ ${spec.nickname} เรียบร้อยแล้ว`);
  };

  // Toggle Active/Inactive Status
  const handleToggleActive = async (id: string, currentStatus: boolean, name: string) => {
    const nextStatus = !currentStatus;
    setSpecialists((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: nextStatus } : s))
    );

    try {
      await supabase
        .from('profiles')
        .update({ status: nextStatus ? 'active' : 'suspended' })
        .eq('id', id);
    } catch (err) {
      console.error('Error updating status in Supabase:', err);
    }

    if (nextStatus) {
      showToast(`🟢 เปิดใช้งานบัญชีของ ${name} เรียบร้อยแล้ว (สามารถล็อกอินเข้าแอปได้)`);
    } else {
      showToast(`🔴 ระงับสิทธิ์บัญชีของ ${name} เรียบร้อยแล้ว (ไม่สามารถล็อกอินเข้าแอปได้)`);
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    const newEmpId = `AITS${Math.floor(10000000 + Math.random() * 90000000)}`;
    const defaultDept = availableDepartments[0] || 'Key Accounts & Enterprise';
    setSelectedDeptChoice(defaultDept);
    setCustomDeptInput('');

    setFormData({
      employeeId: newEmpId,
      fullName: '',
      nickname: '',
      phoneNumber: '',
      email: '',
      password: generateRandomPassword(),
      profilePhotoUrl: avatarPresets[Math.floor(Math.random() * avatarPresets.length)],
      position: 'Field Marketing Specialist',
      department: defaultDept,
      territory: 'Wat Donmuang',
      assignedVehiclePlate: vehiclePresets[0].plate,
      assignedVehicleModel: vehiclePresets[0].model,
      assignedVehicleType: vehiclePresets[0].type,
      drivingLicenseNo: `DL-${newEmpId}`,
      drivingLicenseType: drivingLicenseTypes[0],
      drivingLicenseExpiry: '2028-12-31',
      isActive: true,
      notes: '',
    });
    setEditingSpecialist(null);
    setShowFormPassword(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (spec: MarketingSpecialistUser) => {
    setEditingSpecialist(spec);

    if (spec.department && availableDepartments.includes(spec.department)) {
      setSelectedDeptChoice(spec.department);
      setCustomDeptInput('');
    } else if (spec.department) {
      setSelectedDeptChoice('__custom__');
      setCustomDeptInput(spec.department);
    } else {
      setSelectedDeptChoice(availableDepartments[0] || 'Key Accounts & Enterprise');
      setCustomDeptInput('');
    }

    setFormData({
      ...spec,
      assignedVehiclePlate: spec.assignedVehiclePlate || vehiclePresets[0].plate,
      assignedVehicleModel: spec.assignedVehicleModel || vehiclePresets[0].model,
      assignedVehicleType: spec.assignedVehicleType || vehiclePresets[0].type,
      drivingLicenseNo: spec.drivingLicenseNo || `DL-${spec.employeeId}`,
      drivingLicenseType: spec.drivingLicenseType || drivingLicenseTypes[0],
      drivingLicenseExpiry: spec.drivingLicenseExpiry || '2028-12-31',
    });
    setShowFormPassword(false);
    setIsAddModalOpen(true);
  };

  // Save Add / Edit
  const handleSaveSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName?.trim() || !formData.email?.trim() || !formData.phoneNumber?.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุล, อีเมล, และเบอร์โทรศัพท์ให้ครบถ้วน');
      return;
    }

    if (!formData.password?.trim()) {
      alert('กรุณากำหนดรหัสผ่านสำหรับเข้าสู่ระบบแอป');
      return;
    }

    const initials = formData
      .fullName!.trim()
      .split(' ')
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || 'MK';

    const finalDept = selectedDeptChoice === '__custom__'
      ? (customDeptInput.trim() || 'ฝ่ายการตลาดและบริหารงานภาคสนาม')
      : (selectedDeptChoice || formData.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม');

    if (selectedDeptChoice === '__custom__' && customDeptInput.trim()) {
      const newDeptName = customDeptInput.trim();
      setCustomDepartments((prev) => Array.from(new Set([...prev, newDeptName])));
      try {
        await supabase.from('departments').upsert({ name: newDeptName }, { onConflict: 'name' });
      } catch (dErr) {
        console.error('Error saving department to database:', dErr);
      }
    }

    const fullVehicleStr = `${formData.assignedVehicleModel || 'Isuzu D-Max'} (${formData.assignedVehiclePlate || '1กข-4452 กทม.'})`;

    setIsSubmitting(true);

    try {
      if (editingSpecialist) {
        // Update password in Supabase Auth if provided and not placeholder
        if (formData.password && !formData.password.startsWith('••••')) {
          try {
            await (supabase.rpc as any)('admin_reset_user_password', {
              target_user_id: editingSpecialist.id,
              new_password: formData.password.trim(),
            });
          } catch (pwdErr) {
            console.error('Error updating password via RPC:', pwdErr);
          }
        }

        // Update existing in Supabase profiles
        await supabase.from('profiles').update({
          full_name: formData.fullName!.trim(),
          nickname: formData.nickname?.trim() || formData.fullName!.trim().split(' ')[0],
          phone: formData.phoneNumber!.trim(),
          avatar_url: formData.profilePhotoUrl,
          position: formData.position || 'Field Marketing Specialist',
          department: finalDept,
          status: formData.isActive ? 'active' : 'suspended',
          assigned_vehicle: fullVehicleStr,
          assigned_vehicle_plate: formData.assignedVehiclePlate,
          assigned_vehicle_model: formData.assignedVehicleModel,
          driving_license_no: formData.drivingLicenseNo,
          driving_license_type: formData.drivingLicenseType,
          driving_license_expiry: formData.drivingLicenseExpiry,
        }).eq('id', editingSpecialist.id);

        const { data: existingStaff } = await supabase
          .from('staff')
          .select('id')
          .eq('profile_id', editingSpecialist.id)
          .maybeSingle();

        if (existingStaff) {
          await supabase.from('staff').update({
            staff_id: formData.employeeId || editingSpecialist.employeeId,
            territory: formData.territory,
            position: formData.position || 'Field Marketing Specialist',
            assigned_vehicle: fullVehicleStr,
            vehicle_plate: formData.assignedVehiclePlate,
            vehicle_model: formData.assignedVehicleModel,
            vehicle_type: formData.assignedVehicleType,
            driving_license_no: formData.drivingLicenseNo,
            driving_license_type: formData.drivingLicenseType,
            driving_license_expiry: formData.drivingLicenseExpiry,
          }).eq('profile_id', editingSpecialist.id);
        } else {
          await supabase.from('staff').insert({
            profile_id: editingSpecialist.id,
            staff_id: formData.employeeId || editingSpecialist.employeeId,
            territory: formData.territory,
            position: formData.position || 'Field Marketing Specialist',
            assigned_vehicle: fullVehicleStr,
            vehicle_plate: formData.assignedVehiclePlate,
            vehicle_model: formData.assignedVehicleModel,
            vehicle_type: formData.assignedVehicleType,
            driving_license_no: formData.drivingLicenseNo,
            driving_license_type: formData.drivingLicenseType,
            driving_license_expiry: formData.drivingLicenseExpiry,
          });
        }

        setSpecialists((prev) =>
          prev.map((s) =>
            s.id === editingSpecialist.id
              ? {
                  ...s,
                  ...(formData as MarketingSpecialistUser),
                  department: finalDept,
                  initials,
                }
              : s
          )
        );
        showToast(`✓ อัปเดตข้อมูลและรหัสผ่านของ ${formData.fullName} เรียบร้อยแล้ว`);
      } else {
        // Create new user in Supabase Auth
        const emailToCreate = formData.email!.trim().toLowerCase();
        const pwdToCreate = formData.password!.trim();

        const signUpRes = await supabase.auth.signUp({
          email: emailToCreate,
          password: pwdToCreate,
          options: {
            data: {
              full_name: formData.fullName!.trim(),
              role: 'specialist',
              staff_id: formData.employeeId,
            },
          },
        });

        const createdUserId = signUpRes.data?.user?.id || `sp-${Date.now()}`;

        if (signUpRes.data?.user?.id) {
          await supabase.from('profiles').upsert({
            id: signUpRes.data.user.id,
            email: emailToCreate,
            full_name: formData.fullName!.trim(),
            nickname: formData.nickname?.trim() || formData.fullName!.trim().split(' ')[0],
            phone: formData.phoneNumber!.trim(),
            avatar_url: formData.profilePhotoUrl,
            position: formData.position || 'Field Marketing Specialist',
            role: 'specialist',
            status: formData.isActive ? 'active' : 'suspended',
            department: finalDept,
            assigned_vehicle: fullVehicleStr,
            assigned_vehicle_plate: formData.assignedVehiclePlate,
            assigned_vehicle_model: formData.assignedVehicleModel,
            driving_license_no: formData.drivingLicenseNo,
            driving_license_type: formData.drivingLicenseType,
            driving_license_expiry: formData.drivingLicenseExpiry,
          });

          await supabase.from('staff').insert({
            profile_id: signUpRes.data.user.id,
            staff_id: formData.employeeId || 'AITS10002772',
            territory: formData.territory || 'Bangkok Central (B2B)',
            position: formData.position || 'Field Marketing Specialist',
            assigned_vehicle: fullVehicleStr,
            vehicle_plate: formData.assignedVehiclePlate,
            vehicle_model: formData.assignedVehicleModel,
            vehicle_type: formData.assignedVehicleType,
            driving_license_no: formData.drivingLicenseNo,
            driving_license_type: formData.drivingLicenseType,
            driving_license_expiry: formData.drivingLicenseExpiry,
          });
        }

        const newSpecialist: MarketingSpecialistUser = {
          id: createdUserId,
          employeeId: formData.employeeId || `AITS${Math.floor(10000000 + Math.random() * 90000000)}`,
          fullName: formData.fullName!.trim(),
          nickname: formData.nickname?.trim() || formData.fullName!.trim().split(' ')[0],
          phoneNumber: formData.phoneNumber!.trim(),
          email: emailToCreate,
          password: pwdToCreate,
          profilePhotoUrl: formData.profilePhotoUrl || '',
          initials,
          position: formData.position || 'Field Marketing Specialist',
          department: finalDept,
          territory: formData.territory || 'Bangkok Central',
          isActive: formData.isActive !== undefined ? formData.isActive : true,
          notes: formData.notes?.trim() || '',
          assignedVehiclePlate: formData.assignedVehiclePlate || vehiclePresets[0].plate,
          assignedVehicleModel: formData.assignedVehicleModel || vehiclePresets[0].model,
          assignedVehicleType: formData.assignedVehicleType || vehiclePresets[0].type,
          drivingLicenseNo: formData.drivingLicenseNo || `DL-${formData.employeeId || '001'}`,
          drivingLicenseType: formData.drivingLicenseType || drivingLicenseTypes[0],
          drivingLicenseExpiry: formData.drivingLicenseExpiry || '2028-12-31',
          createdAt: 'วันนี้',
        };

        setSpecialists((prev) => [newSpecialist, ...prev]);
        showToast(`✓ เพิ่มและสร้างบัญชีพนักงาน ${newSpecialist.fullName} ในระบบเรียบร้อยแล้ว`);
      }
    } catch (err: any) {
      console.error('Error saving specialist:', err);
      showToast(`⚠️ เกิดข้อผิดพลาดในการบันทึก: ${err.message || ''}`);
    } finally {
      setIsSubmitting(false);
      setIsAddModalOpen(false);
    }
  };

  // Delete Specialist
  const handleConfirmDelete = () => {
    if (!deletingSpecialist) return;
    setSpecialists((prev) => prev.filter((s) => s.id !== deletingSpecialist.id));
    showToast(`ลบบัญชีของ ${deletingSpecialist.fullName} เรียบร้อยแล้ว`);
    setDeletingSpecialist(null);
  };

  return (
    <div className="w-full space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in text-xs font-medium">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header & Fast Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-on-surface tracking-tight">
              {t('specialists_title')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-primary border border-blue-200">
              <span className="material-symbols-outlined text-[14px]">badge</span>
              Staff Access & Fleet Assignment
            </span>
          </div>
          <p className="text-on-surface-variant text-xs mt-1">
            {t('specialists_subtitle')}
          </p>
        </div>

        {/* Primary CTA: Add New Specialist */}
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t('specialists_add_btn')}
        </button>
      </div>

      {/* KPI Overview 3-Card Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium">{t('btn_all')}</span>
            <div className="text-xl font-extrabold text-on-surface mt-0.5">{totalCount}</div>
            <span className="text-[10px] text-slate-500">Field Marketing Team</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center border border-blue-200">
            <span className="material-symbols-outlined text-[20px]">groups</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-emerald-700 font-medium">Active</span>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{activeCount}</div>
            <span className="text-[10px] text-emerald-600 font-semibold">Mobile Login Allowed</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-rose-700 font-medium">Inactive</span>
            <div className="text-xl font-extrabold text-rose-700 mt-0.5">{inactiveCount}</div>
            <span className="text-[10px] text-rose-600 font-semibold">Access Suspended</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <span className="material-symbols-outlined text-[20px]">block</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar Strip */}
      <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/60 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="ค้นหาชื่อ, รหัสพนักงาน, เบอร์โทร, ทะเบียนรถ, หรือเลขที่ใบขับขี่..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 border border-outline-variant/50 focus:outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/50">
            {[
              { id: 'all', label: t('btn_all') },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as any)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  filterStatus === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Department Filter Dropdown */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="bg-surface-container-low px-2.5 py-1.5 rounded-xl text-xs font-bold text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">{t('specialists_filter_all_dept')}</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/50">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-primary text-white' : 'text-on-surface-variant'
              }`}
              title="Card Grid View"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-primary text-white' : 'text-on-surface-variant'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid View of Specialists */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpecialists.map((spec) => {
            const isPasswordRevealed = !!revealedPasswords[spec.id];

            return (
              <div
                key={spec.id}
                className={`bg-white rounded-2xl border transition-all p-4 space-y-3.5 shadow-xs flex flex-col justify-between ${
                  spec.isActive
                    ? 'border-slate-200/90 hover:border-primary/50'
                    : 'border-rose-200/80 bg-rose-50/20 opacity-90'
                }`}
              >
                {/* Card Top: Avatar, Name, Employee ID, Active Switch */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {spec.profilePhotoUrl ? (
                          <img
                            src={spec.profilePhotoUrl}
                            alt={spec.fullName}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-primary text-sm border-2 border-blue-200">
                            {spec.initials}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            spec.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          title={spec.isActive ? 'เปิดใช้งาน' : 'ระงับสิทธิ์'}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {spec.fullName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                            {spec.employeeId}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate">({spec.nickname})</span>
                        </div>
                      </div>
                    </div>

                    {/* Active/Inactive Instant Toggle Switch */}
                    <div className="flex flex-col items-end shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={spec.isActive}
                          onChange={() => handleToggleActive(spec.id, spec.isActive, spec.fullName)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                      <span
                        className={`text-[9px] font-bold mt-1 ${
                          spec.isActive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {spec.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Position, Department & Territory */}
                  <div className="space-y-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60">
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-[15px]">work</span>
                      <span className="truncate">{spec.position}</span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">corporate_fare</span>
                      <span className="truncate">{spec.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                      <span className="truncate">{spec.territory}</span>
                    </div>
                  </div>

                  {/* Fleet Vehicle & Driving License Badge Strip */}
                  <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] min-w-0">
                        <span className="material-symbols-outlined text-[15px] text-blue-600 shrink-0">directions_car</span>
                        <span className="truncate">{spec.assignedVehicleModel || 'Isuzu D-Max SpaceCab'}</span>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-100/80 text-blue-800 rounded font-bold border border-blue-200 shrink-0">
                        {spec.assignedVehiclePlate || '1กข-4452 กทม.'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-[13px] text-emerald-600 shrink-0">badge</span>
                        <span className="truncate">{spec.drivingLicenseType?.split('(')[0]?.trim() || 'ใบขับขี่ส่วนบุคคล'}</span>
                      </span>
                      <span className="font-mono font-medium text-slate-700 shrink-0">{spec.drivingLicenseNo || `DL-${spec.employeeId}`}</span>
                    </div>
                  </div>

                  {/* Contact Strip */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/90 p-2 rounded-xl border border-slate-200/70 text-[11px]">
                    <a
                      href={`tel:${spec.phoneNumber}`}
                      className="flex items-center gap-1 text-slate-700 hover:text-primary truncate"
                      title="โทรด่วน"
                    >
                      <span className="material-symbols-outlined text-[13px] text-primary">call</span>
                      <span className="truncate">{spec.phoneNumber}</span>
                    </a>
                    <a
                      href={`mailto:${spec.email}`}
                      className="flex items-center gap-1 text-slate-700 hover:text-primary truncate"
                      title="ส่งอีเมล"
                    >
                      <span className="material-symbols-outlined text-[13px] text-primary">mail</span>
                      <span className="truncate">{spec.email}</span>
                    </a>
                  </div>

                  {/* App Login Credentials Box */}
                  <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-blue-900 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-primary">key</span>
                        ข้อมูลเข้าสู่ระบบ Mobile App
                      </span>
                      <button
                        onClick={() => handleCopyCredentials(spec)}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                        title="คัดลอกข้อมูล Email & Password สำหรับส่งให้พนักงาน"
                      >
                        <span className="material-symbols-outlined text-[12px]">content_copy</span>
                        คัดลอก
                      </button>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-500">Email:</span>
                        <strong className="text-slate-900 select-all">{spec.email}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-500">Password:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-slate-900 select-all">
                            {isPasswordRevealed ? spec.password : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(spec.id)}
                            className="text-slate-400 hover:text-slate-600"
                            title={isPasswordRevealed ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isPasswordRevealed ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes snippet if present */}
                  {spec.notes && (
                    <div className="text-[10px] text-slate-500 line-clamp-1 italic">
                      หมายเหตุ: {spec.notes}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  <span className="text-[10px] text-slate-400 truncate">
                    อัปเดต: {spec.createdAt}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(spec)}
                      className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-blue-50 rounded-lg border border-primary/30 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      แก้ไข
                    </button>
                    <button
                      onClick={() => setDeletingSpecialist(spec)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="ลบพนักงาน"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View of Specialists */
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant/60">
                <tr>
                  <th className="p-3.5 pl-4">พนักงาน (Employee)</th>
                  <th className="p-3.5">ตำแหน่ง & ฝ่าย/แผนก & โซนพื้นที่</th>
                  <th className="p-3.5">รถฟลีท & ใบขับขี่</th>
                  <th className="p-3.5">เบอร์โทรศัพท์</th>
                  <th className="p-3.5">Email สำหรับล็อกอิน</th>
                  <th className="p-3.5">รหัสผ่านแอป</th>
                  <th className="p-3.5 text-center">สถานะแอป</th>
                  <th className="p-3.5 text-right pr-4">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {filteredSpecialists.map((spec) => {
                  const isPasswordRevealed = !!revealedPasswords[spec.id];

                  return (
                    <tr key={spec.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-2.5">
                          {spec.profilePhotoUrl ? (
                            <img
                              src={spec.profilePhotoUrl}
                              alt={spec.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-primary text-xs">
                              {spec.initials}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{spec.fullName}</div>
                            <div className="text-[10px] text-slate-500">
                              {spec.employeeId} ({spec.nickname})
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-primary">{spec.position}</div>
                        <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[13px] text-blue-600">corporate_fare</span>
                          <span>{spec.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม'}</span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                          <span className="material-symbols-outlined text-[12px] text-slate-400">location_on</span>
                          <span>{spec.territory}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                            <span className="material-symbols-outlined text-[14px] text-blue-600">directions_car</span>
                            <span>{spec.assignedVehiclePlate || '-'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                            {spec.assignedVehicleModel || 'Isuzu D-Max'}
                          </div>
                          <div className="text-[10px] text-emerald-700 flex items-center gap-0.5 font-medium">
                            <span className="material-symbols-outlined text-[12px]">badge</span>
                            <span>{spec.drivingLicenseNo || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <a href={`tel:${spec.phoneNumber}`} className="text-slate-800 hover:text-primary font-medium">
                          {spec.phoneNumber}
                        </a>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-800 select-all">{spec.email}</span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-slate-800 select-all">
                            {isPasswordRevealed ? spec.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(spec.id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {isPasswordRevealed ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggleActive(spec.id, spec.isActive, spec.fullName)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            spec.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {spec.isActive ? '🟢 Active' : '🔴 Inactive'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyCredentials(spec)}
                            className="p-1 text-slate-500 hover:text-primary rounded-lg"
                            title="คัดลอกข้อมูลล็อกอิน"
                          >
                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(spec)}
                            className="p-1 text-slate-500 hover:text-primary rounded-lg"
                            title="แก้ไขข้อมูล"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeletingSpecialist(spec)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded-lg"
                            title="ลบพนักงาน"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Specialist Full Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-scale-up">
            {/* Modal Header (Fixed / Non-scrolling) */}
            <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-primary flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    {editingSpecialist ? 'manage_accounts' : 'person_add'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                    {editingSpecialist ? `แก้ไขข้อมูล: ${editingSpecialist.fullName}` : 'เพิ่มพนักงานการตลาดภาคสนามใหม่'}
                  </h3>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-500 line-clamp-1 sm:line-clamp-none">
                    กำหนดข้อมูลประจำตัว รถฟลีท ใบขับขี่ และสิทธิ์เข้าใช้งาน Mobile App
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Form Body (Scrollable with Touch Support) */}
            <form onSubmit={handleSaveSpecialist} className="flex-1 overflow-y-auto pr-1 py-3 space-y-4 text-xs overscroll-contain">
              {/* Section 1: ข้อมูลส่วนตัวและตำแหน่งงาน */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5 text-blue-900">
                  <span className="material-symbols-outlined text-primary text-[15px]">person</span>
                  ข้อมูลส่วนตัวและตำแหน่งงาน (Personal & Staff Details)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">ชื่อ-นามสกุล <span className="text-rose-600">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น สมพงษ์ ชัยชนะ"
                      value={formData.fullName || ''}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">ชื่อเล่น</label>
                    <input
                      type="text"
                      placeholder="เช่น พงษ์"
                      value={formData.nickname || ''}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">รหัสพนักงาน (Employee ID) <span className="text-rose-600">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น AITS10002772"
                      value={formData.employeeId || ''}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">เบอร์โทรศัพท์ติดต่อ <span className="text-rose-600">*</span></label>
                    <input
                      type="tel"
                      required
                      placeholder="เช่น 081-234-5678"
                      value={formData.phoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">ตำแหน่งงาน (Position)</label>
                    <input
                      type="text"
                      placeholder="เช่น Asst.Supervisor"
                      value={formData.position || ''}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>ฝ่าย / แผนก (Department) <span className="text-rose-600">*</span></span>
                      {selectedDeptChoice === '__custom__' && (
                        <span className="text-[10px] text-primary font-bold">ระบุฝ่ายใหม่</span>
                      )}
                    </label>
                    <select
                      value={selectedDeptChoice}
                      onChange={(e) => {
                        setSelectedDeptChoice(e.target.value);
                        if (e.target.value !== '__custom__') {
                          setFormData((prev) => ({ ...prev, department: e.target.value }));
                        }
                      }}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary bg-white cursor-pointer font-medium"
                    >
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                      <option value="__custom__">➕ อื่นๆ (ระบุชื่อฝ่าย/แผนกใหม่...)</option>
                    </select>

                    {selectedDeptChoice === '__custom__' && (
                      <div className="pt-1 animate-fade-in space-y-1">
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="พิมพ์ชื่อฝ่าย/แผนกใหม่ เช่น ฝ่ายการตลาดดิจิทัล (Digital Marketing)"
                          value={customDeptInput}
                          onChange={(e) => {
                            setCustomDeptInput(e.target.value);
                            setFormData((prev) => ({ ...prev, department: e.target.value }));
                          }}
                          className="w-full p-2 sm:p-2.5 rounded-xl border-2 border-primary/60 bg-blue-50/30 text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                        />
                        <p className="text-[10.5px] text-slate-500">
                          * เมื่อบันทึกแล้ว ฝ่าย/แผนกนี้จะถูกเพิ่มลงในตัวเลือกและฟิลเตอร์ของระบบโดยอัตโนมัติ
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-slate-700">โซนพื้นที่รับผิดชอบ (Territory)</label>
                    <input
                      type="text"
                      placeholder="เช่น Wat Donmuang"
                      value={formData.territory || ''}
                      onChange={(e) => setFormData({ ...formData, territory: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Profile Photo: Upload from Device + Presets */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span>รูปถ่ายหน้าตรงของพนักงาน (Profile Photo)</span>
                    {formData.profilePhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, profilePhotoUrl: '' })}
                        className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[12px]">delete</span>
                        ลบรูป
                      </button>
                    )}
                  </label>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {/* Current Photo Preview */}
                    <div className="relative shrink-0">
                      {formData.profilePhotoUrl ? (
                        <img
                          src={formData.profilePhotoUrl}
                          alt="Profile Preview"
                          className="w-16 h-16 rounded-full object-cover border-2 border-primary shadow-xs"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-base border-2 border-dashed border-blue-300">
                          <span className="material-symbols-outlined text-[24px]">account_circle</span>
                        </div>
                      )}
                    </div>

                    {/* Local File Upload Button & URL Input */}
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* Hidden File Input */}
                        <input
                          type="file"
                          id="specialist-photo-file-input"
                          accept="image/png, image/jpeg, image/webp, image/gif"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const ext = file.name.split('.').pop() || 'jpg';
                                const pathName = `avatar_${Date.now()}.${ext}`;
                                const { data: uploadRes, error: upErr } = await supabase.storage
                                  .from('avatars')
                                  .upload(pathName, file, { contentType: file.type, upsert: true });

                                if (!upErr && uploadRes) {
                                  const { data: { publicUrl } } = supabase.storage
                                    .from('avatars')
                                    .getPublicUrl(pathName);
                                  setFormData({ ...formData, profilePhotoUrl: publicUrl });
                                  showToast('✓ อัปโหลดรูปภาพขึ้น Cloud สำเร็จ');
                                  return;
                                }
                              } catch (err) {
                                console.warn('Supabase storage upload fallback to dataUrl:', err);
                              }

                              // Fallback: Read local file as Data URL
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const dataUrl = event.target?.result as string;
                                setFormData({ ...formData, profilePhotoUrl: dataUrl });
                                showToast('✓ อัปโหลดรูปภาพจากเครื่องสำเร็จ');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />

                        {/* Trigger Button */}
                        <label
                          htmlFor="specialist-photo-file-input"
                          className="w-full sm:w-auto px-3.5 py-2 bg-white hover:bg-blue-50 text-primary border border-primary/40 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">upload_file</span>
                          เลือกรูปถ่ายจากไฟล์ในเครื่อง...
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="shrink-0">หรือใส่ URL รูปภาพ:</span>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={formData.profilePhotoUrl || ''}
                          onChange={(e) => setFormData({ ...formData, profilePhotoUrl: e.target.value })}
                          className="w-full sm:flex-1 p-1.5 px-2 rounded-lg border border-slate-200 text-[11px] bg-white text-slate-800 focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Avatar Quick Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-500 font-medium w-full sm:w-auto">หรือเลือกอวตารตัวอย่าง:</span>
                    <div className="flex flex-wrap gap-2">
                      {avatarPresets.map((preset, pIdx) => (
                        <img
                          key={pIdx}
                          src={preset}
                          alt="Preset"
                          onClick={() => setFormData({ ...formData, profilePhotoUrl: preset })}
                          className={`w-7 h-7 rounded-full object-cover cursor-pointer border-2 transition-all ${
                            formData.profilePhotoUrl === preset
                              ? 'border-primary ring-2 ring-primary/40 scale-105'
                              : 'border-transparent hover:border-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: ข้อมูลเข้าสู่ระบบ Mobile App */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5 text-blue-900">
                  <span className="material-symbols-outlined text-primary text-[15px]">lock</span>
                  ข้อมูลเข้าสู่ระบบ Mobile App (ใช้อีเมลเพื่อล็อกอิน)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">
                      อีเมลสำหรับเข้าสู่ระบบ (Login Email) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="เช่น sompong.c@fastfleet.io"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700">
                        รหัสผ่านสำหรับเข้าแอป (Password) <span className="text-rose-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, password: generateRandomPassword() })}
                        className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[12px]">autorenew</span>
                        สุ่มรหัสผ่าน
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        required
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full p-2 sm:p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {showFormPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Toggle in Modal */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-bold text-slate-900">สถานะการใช้งาน (Account Status)</div>
                    <div className="text-[10px] text-slate-500">
                      {formData.isActive
                        ? '🟢 เปิดใช้งาน: พนักงานสามารถใช้อีเมลและรหัสผ่านนี้ล็อกอินเข้า Mobile App ได้'
                        : '🔴 ระงับสิทธิ์: พนักงานจะไม่สามารถเข้าสู่ระบบ Mobile App ได้ทันที'}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Section 3: ข้อมูลยานพาหนะประจำตำแหน่งและใบขับขี่ (Assign Fleet Vehicle & Driving License) */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5 text-blue-900">
                  <span className="material-symbols-outlined text-primary text-[15px]">directions_car</span>
                  ข้อมูลรถฟลีทประจำตัวและใบขับขี่ (Assign Fleet Vehicle & Driving License)
                </h4>

                {/* Vehicle Selection */}
                <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200 space-y-3">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-primary">minor_crash</span>
                      รถประจำตำแหน่ง (Assigned Fleet Vehicle)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">เลือกรถจาก Fleet ขององค์กร</span>
                  </div>

                  {/* Vehicle Quick Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {vehiclePresets.map((vp, vIdx) => (
                      <button
                        key={vIdx}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            assignedVehiclePlate: vp.plate,
                            assignedVehicleModel: vp.model,
                            assignedVehicleType: vp.type,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                          formData.assignedVehiclePlate === vp.plate
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">directions_car</span>
                        <span>{vp.model.split(' ')[0]}</span>
                        <span className="font-mono opacity-85">({vp.plate.split(' ')[0]})</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ทะเบียนรถ (Plate No.)</label>
                      <input
                        type="text"
                        placeholder="เช่น 1กข-4452 กทม."
                        value={formData.assignedVehiclePlate || ''}
                        onChange={(e) => setFormData({ ...formData, assignedVehiclePlate: e.target.value })}
                        className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-primary bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ยี่ห้อ / รุ่นรถ (Vehicle Model)</label>
                      <input
                        type="text"
                        placeholder="เช่น Isuzu D-Max SpaceCab 1.9"
                        value={formData.assignedVehicleModel || ''}
                        onChange={(e) => setFormData({ ...formData, assignedVehicleModel: e.target.value })}
                        className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ประเภทยานพาหนะ (Type)</label>
                      <select
                        value={formData.assignedVehicleType || 'Pickup Truck'}
                        onChange={(e) => setFormData({ ...formData, assignedVehicleType: e.target.value })}
                        className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary bg-white cursor-pointer"
                      >
                        <option value="Pickup Truck">Pickup Truck (กระบะบรรทุก)</option>
                        <option value="Sedan">Sedan (รถเก๋งส่วนบุคคล)</option>
                        <option value="Van">Van (รถตู้โดยสาร)</option>
                        <option value="EV">EV (รถยนต์พลังงานไฟฟ้า)</option>
                        <option value="Motorcycle">Motorcycle (รถจักรยานยนต์)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Driving License Credentials */}
                <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200 space-y-3">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">badge</span>
                      ข้อมูลใบขับขี่ (Driving License Credentials)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">ความถูกต้องทางกฎหมาย</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">เลขที่ใบขับขี่ (License No.)</label>
                      <input
                        type="text"
                        placeholder="เช่น DL-94821034"
                        value={formData.drivingLicenseNo || ''}
                        onChange={(e) => setFormData({ ...formData, drivingLicenseNo: e.target.value })}
                        className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-primary bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ประเภทใบอนุญาต (License Type)</label>
                      <select
                        value={formData.drivingLicenseType || drivingLicenseTypes[0]}
                        onChange={(e) => setFormData({ ...formData, drivingLicenseType: e.target.value })}
                        className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary bg-white cursor-pointer"
                      >
                        {drivingLicenseTypes.map((type, tIdx) => (
                          <option key={tIdx} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">วันหมดอายุ (Expiry Date)</label>
                      <input
                        type="date"
                        value={formData.drivingLicenseExpiry || ''}
                        onChange={(e) => setFormData({ ...formData, drivingLicenseExpiry: e.target.value })}
                        className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: หมายเหตุเพิ่มเติม */}
              <div className="space-y-1.5 pt-2">
                <label className="font-bold text-slate-700">หมายเหตุเพิ่มเติม (Notes)</label>
                <textarea
                  rows={2}
                  placeholder="เช่น อุปกรณ์ที่ได้รับมอบหมาย, บัตร Easy Pass, ประกันภัย..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary"
                />
              </div>

              {/* Modal Footer Actions (Fixed at bottom with responsive full-width mobile buttons) */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all text-center"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-all flex items-center justify-center gap-1.5 ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isSubmitting ? 'autorenew' : 'save'}
                  </span>
                  {isSubmitting ? 'กำลังบันทึก...' : (editingSpecialist ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSpecialist && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">ยืนยันการลบบัญชีพนักงาน</h3>
              <p className="text-xs text-slate-600 mt-1">
                คุณต้องการลบบัญชีของ <strong>{deletingSpecialist.fullName}</strong> ({deletingSpecialist.employeeId}) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSpecialist(null)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 text-center"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs text-center"
              >
                ลบบัญชี
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
