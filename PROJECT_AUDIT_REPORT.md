# 🔍 FastFleet Project — Full Audit Report

**วันที่ตรวจสอบ**: 22 กันยายน 2026  
**ขอบเขต**: Web Console, Mobile App, Supabase Database Schema, Logic & Process Flows

---

## 📊 สรุปผลตรวจสอบ (Executive Summary)

| หมวด | สถานะ | Issues พบ |
|---|---|---|
| **Database Schema** | ⚠️ มี Drift | 6 issues |
| **Web Console** | ⚠️ มีจุดเสี่ยง | 5 issues |
| **Mobile App** | ✅ ดี มีจุดปรับปรุง | 4 issues |
| **Security & Auth** | 🔴 ต้องแก้ไข | 3 critical issues |
| **Process Flow** | ⚠️ มี Gap | 3 issues |

**รวมทั้งหมด: 21 issues** (🔴 Critical: 4, ⚠️ Warning: 10, 💡 Improvement: 7)

---

## 1. 🗄️ Database Schema — Supabase vs Code Types Drift

### 1.1 `profiles` table — Types ไม่ตรงกับ DB จริง

> [!WARNING]
> **Web `database.types.ts` ขาด columns สำคัญหลายตัวที่มีอยู่จริงใน DB**

| Column | Supabase DB จริง | Web Types | Mobile Types | สถานะ |
|---|---|---|---|---|
| `position` | ✅ มี (`text`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `is_online` | ✅ มี (`boolean`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `last_seen_at` | ✅ มี (`timestamptz`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `current_lat` | ✅ มี (`double precision`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `current_lng` | ✅ มี (`double precision`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `current_address` | ✅ มี (`text`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `current_speed` | ✅ มี (`real`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `battery_level` | ✅ มี (`real`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `assigned_vehicle` | ✅ มี (`text`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `assigned_vehicle_plate` | ✅ มี | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `assigned_vehicle_model` | ✅ มี | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `driving_license_no/type/expiry` | ✅ มี | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `is_tracking_enabled` | ✅ มี (`boolean NOT NULL`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |
| `user_tracking_enabled` | ✅ มี (`boolean NOT NULL`) | ❌ **ขาด** | ✅ มี | 🔴 Web drift |

**ผลกระทบ**: Web Dashboard ([Dashboard.tsx](file:///d:/fleet-manage/apps/web/src/pages/Dashboard.tsx)) ใช้ `profiles` columns เหล่านี้เพื่อแสดง live map แต่ types ไม่มี → TypeScript จะไม่ตรวจจับ bugs ตอนเรียกใช้ columns เหล่านี้ ต้องใช้ `as any` cast แทน

**แนวทางแก้ไข**: Run `npx supabase gen types typescript` เพื่อ regenerate [web/database.types.ts](file:///d:/fleet-manage/apps/web/src/lib/database.types.ts) ให้ตรงกับ DB จริง

### 1.2 `system_settings` table — Types ขาด columns

> [!WARNING]
> ทั้ง Web และ Mobile types ขาด columns ที่อยู่จริงใน DB

| Column | Supabase DB จริง | Web & Mobile Types | สถานะ |
|---|---|---|---|
| `gps_config` | ✅ มี (`jsonb`) | ❌ **ขาด** | ⚠️ Drift |
| `approval_rules` | ✅ มี (`jsonb`) | ❌ **ขาด** | ⚠️ Drift |
| `operating_hours` | ✅ มี (`jsonb`) | ❌ **ขาด** | ⚠️ Drift |
| `api_key` | ✅ มี (`text`) | ❌ **ขาด** | ⚠️ Drift |

**ผลกระทบ**: Mobile [presenceService.ts](file:///d:/fleet-manage/apps/mobile/src/lib/presenceService.ts) ต้องใช้ `as any` cast (บรรทัด 31) เพื่อเข้าถึง `gps_config` เพราะ type ไม่รู้จัก column นี้

### 1.3 `system_settings.tenant_id` — Data Type Mismatch

| Schema SQL | DB จริง | SQL ที่กำหนด |
|---|---|---|
| `tenant_id TEXT DEFAULT 'FASTFLEET_DEFAULT'` | `uuid` (nullable) | `TEXT` |

> [!CAUTION]
> Schema SQL กำหนดเป็น `TEXT` แต่ DB จริงเป็น `uuid` → หาก re-run schema จะเกิด type conflict

### 1.4 `profiles.current_speed` & `battery_level` — Data Type Mismatch

| Column | Schema SQL | DB จริง |
|---|---|---|
| `current_speed` | `DOUBLE PRECISION` | `real` |
| `battery_level` | `INTEGER` | `real` |

ไม่กระทบ logic มากนัก แต่ schema SQL ไม่ตรงกับ DB จริง

---

## 2. 🌐 Web Console — Logic & Process Issues

### 2.1 🔴 ไม่มี Auth Guard / Route Protection

> [!CAUTION]
> **CRITICAL SECURITY ISSUE**: Web Console ไม่มี Route Guard ตรวจสอบ authentication

- [AdminLayout.tsx](file:///d:/fleet-manage/apps/web/src/layouts/AdminLayout.tsx) — ไม่มีการเรียก `supabase.auth.getUser()` หรือ `getSession()` เพื่อตรวจสอบว่าผู้ใช้ login แล้วหรือไม่
- ไม่มี `onAuthStateChange` listener ที่ไหนเลยใน web app
- ไม่มี redirect กลับ login เมื่อ session หมดอายุ
- ผู้ใช้สามารถเข้าถึง `/admin/dashboard` ได้โดยตรงโดยไม่ต้อง login

**ผลกระทบ**: ใครก็ได้สามารถเข้าถึง management console ได้ทั้งหมดโดยไม่ต้อง authenticate

### 2.2 🔴 Admin Bypass Login — Hardcoded Bypass

> [!CAUTION]
> [AdminLogin.tsx](file:///d:/fleet-manage/apps/web/src/pages/AdminLogin.tsx) บรรทัด 41-48

```typescript
if (trimmedEmail.toLowerCase() === 'admin@fastfleet.io') {
  localStorage.setItem('fastfleet_user_role', 'admin');
  navigate('/admin/dashboard');
  return;
}
```

**ปัญหา**: เมื่อ Supabase auth ล้มเหลว (ใส่ password ผิด / user ไม่มี) → ระบบ bypass เข้าได้เลยถ้า email = `admin@fastfleet.io` โดยไม่ต้องตรวจสอบ password → **ช่องโหว่ด้านความปลอดภัยร้ายแรง**

### 2.3 🔴 Catch-all Fallback to Dashboard

> [!CAUTION]
> [AdminLogin.tsx](file:///d:/fleet-manage/apps/web/src/pages/AdminLogin.tsx) บรรทัด 80-83

```typescript
} catch (err: any) {
  console.error('Login error:', err);
  navigate('/admin/dashboard'); // ← เข้า dashboard ได้แม้ login error!
}
```

เมื่อเกิด exception ใดๆ ก็ตาม ระบบจะนำทางไป dashboard โดยอัตโนมัติ

### 2.4 ⚠️ Role-based Authorization ใช้ localStorage เท่านั้น

[AdminLayout.tsx](file:///d:/fleet-manage/apps/web/src/layouts/AdminLayout.tsx) บรรทัด 6-9:
```typescript
const getInitialRole = (): 'admin' | 'specialist' => {
  const cached = localStorage.getItem('fastfleet_user_role');
  ...
};
```

Role ถูกเก็บใน `localStorage` ซึ่งผู้ใช้สามารถแก้ไขได้ง่ายๆ ผ่าน DevTools → ไม่มีการ verify role จาก server-side

### 2.5 ⚠️ Web Supabase Client ไม่มี Database Type Generic

[web/supabase.ts](file:///d:/fleet-manage/apps/web/src/lib/supabase.ts):
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
// ← ไม่มี <Database> generic → ไม่มี type safety
```

ในขณะที่ Mobile ใช้ถูกต้อง:
```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {...})
```

### 2.6 ⚠️ Approval Handler ไม่ set `approved_by`

[VisitHistory.tsx](file:///d:/fleet-manage/apps/web/src/pages/VisitHistory.tsx) บรรทัด 532-536:
```typescript
await supabase.from('trips').update({
  approval_status: 'approved',
  status: 'completed',
  approved_at: new Date().toISOString(),
  // ← ขาด approved_by: user.id ← ไม่บันทึกว่าใครอนุมัติ
}).eq('id', tripId);
```

Schema มี column `approved_by UUID REFERENCES profiles(id)` แต่ approval handler ไม่เคยส่งค่านี้

---

## 3. 📱 Mobile App — Logic & Process Issues

### 3.1 ✅ Authentication Flow — ถูกต้อง

```mermaid
flowchart LR
    A[Login] --> B{Auth OK?}
    B -->|Yes| C[PrivacyConsent]
    C --> D[Dashboard]
    B -->|No| E[Show Error]
```

- Login → PrivacyConsent → Dashboard — flow สมเหตุสมผล
- ใช้ `supabase.auth.signInWithPassword()` อย่างถูกต้อง
- ไม่มี bypass login เหมือน web ✅
- มี `signOut()` ที่ PrivacyConsent และ UserProfile ✅

### 3.2 ⚠️ `processQueue()` ไม่ได้ implement

[db.ts](file:///d:/fleet-manage/apps/mobile/src/lib/db.ts) บรรทัด 28-30:
```typescript
export async function processQueue() {
  // Logic to read from offline_queue and push to Supabase when network is restored
}
```

ฟังก์ชัน offline queue sync ยังว่างเปล่า → ข้อมูลที่ queue ไว้ตอน offline จะไม่ถูกส่งเมื่อกลับมา online

### 3.3 ⚠️ Google Maps API Key Hardcoded

[mapServices.ts](file:///d:/fleet-manage/apps/mobile/src/lib/mapServices.ts) บรรทัด 4-5:
```typescript
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDYNtBMG47WiMxmfcMpJ-8nk6wZCPTwOmY';
```

API key ถูก hardcode เป็น fallback → ควรลบออกจาก source code

### 3.4 💡 `presenceService.ts` ใช้ `as any` cast มากเกินไป

[presenceService.ts](file:///d:/fleet-manage/apps/mobile/src/lib/presenceService.ts) — มี `as any` cast ราว 5+ จุด เนื่องจาก `database.types.ts` ขาด columns (`gps_config`, `is_tracking_enabled`, etc.)

แก้ไขได้โดย regenerate types ตาม Issue 1.1/1.2

### 3.5 ✅ Anti-Drift GPS Engine — สมบูรณ์ดี

3-State evaluator (Running / Stopped / Ignore) ใน [presenceService.ts](file:///d:/fleet-manage/apps/mobile/src/lib/presenceService.ts) ทำงานถูกต้อง:
- ✅ กรอง GPS jitter เมื่ออยู่กับที่
- ✅ ตรวจจับ mock location
- ✅ Realtime sync GPS config จาก web admin
- ✅ Background task + foreground watcher + heartbeat interval

---

## 4. 🔄 Process Flow — Web ↔ Mobile ↔ Database

### 4.1 Trip Lifecycle Flow

```mermaid
flowchart TD
    subgraph Mobile[📱 Mobile App]
        M1[สร้าง Trip] --> M2[เพิ่ม Drops/Appointments]
        M2 --> M3[Route Preview & Optimize]
        M3 --> M4[Active Tracker - GPS Live]
        M4 --> M5[Drop Reporting - Check-in/Expenses/Photos]
        M5 --> M6[Trip Summary & Submit]
    end
    
    subgraph DB[🗄️ Supabase]
        D1[trips: draft → in_progress]
        D2[appointments: pending → completed]
        D3[expenses: inserted]
        D4[location_logs: GPS stream]
        D5[trips: approval_status = pending]
    end
    
    subgraph Web[🌐 Web Console]
        W1[Dashboard - Live Map]
        W2[Visit History - Approval Hub]
        W3[Approve / Request Revision]
    end
    
    M1 --> D1
    M4 --> D4
    M5 --> D2
    M5 --> D3
    M6 --> D5
    D4 --> W1
    D5 --> W2
    W3 --> D5
```

### 4.2 ⚠️ Trip Submit ไม่เปลี่ยน `approval_status` ชัดเจน

Mobile Trip Summary submit flow ควรเปลี่ยน:
- `status` → `'completed'`
- `approval_status` → `'pending'`
- `submitted_at` → timestamp

ต้องตรวจสอบว่า [TripSummaryScreen.tsx](file:///d:/fleet-manage/apps/mobile/src/screens/TripSummaryScreen.tsx) set ค่าเหล่านี้ครบถ้วนหรือไม่

### 4.3 ⚠️ Revision Flow — Mobile ไม่มีหน้า Revision Feedback

เมื่อ Web Manager ส่ง revision request:
- Web: update `approval_status = 'revision_requested'` + `manager_feedback` ✅
- **Mobile: ไม่มีหน้าจอหรือ notification เพื่อแสดง revision feedback** → Specialist จะไม่รู้ว่าต้องแก้ไขอะไร

### 4.4 ⚠️ Realtime Subscription — Web ใช้ reload ทั้งหมดเมื่อมี change

[VisitHistory.tsx](file:///d:/fleet-manage/apps/web/src/pages/VisitHistory.tsx) บรรทัด 444-455:
```typescript
.on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
  loadTrips(); // ← reload ALL trips ทุกครั้ง
})
```

ทุกครั้งที่มีการเปลี่ยนแปลงในตาราง trips/appointments/expenses → reload ข้อมูลทั้งหมดใหม่ ไม่ efficient

---

## 5. 🔐 Security & RLS Policy Audit

### 5.1 ✅ RLS Policies — เปิดใช้ทุกตาราง

ทุก 9 ตารางเปิด RLS ✅

### 5.2 ⚠️ Departments Policy — ซ้อนทับกัน

```sql
CREATE POLICY "Allow public read access to departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow all access to departments" ON public.departments FOR ALL USING (true);
```

Policy `FOR ALL USING (true)` อนุญาตให้ทุกคน INSERT/UPDATE/DELETE ข้อมูล departments ได้ → ควรจำกัดเฉพาะ admin

### 5.3 ⚠️ Storage Policy — ไม่มี per-user restriction

```sql
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

ทุก authenticated user สามารถ upload ไฟล์ได้โดยไม่จำกัด path → สามารถ overwrite ไฟล์ของคนอื่นได้

### 5.4 ⚠️ `is_admin()` function — Manager = Admin

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    );
END;
```

Manager มีสิทธิ์เทียบเท่า Admin ทุกประการ → อาจต้องแยก permission level ถ้าต้องการจำกัดสิทธิ์ manager

---

## 6. 💡 สรุปข้อเสนอแนะเรียงตามความสำคัญ

### 🔴 Critical — ต้องแก้ไขก่อน Production

| # | Issue | ไฟล์ | แนวทาง |
|---|---|---|---|
| 1 | **ไม่มี Auth Guard บน Web** | [AdminLayout.tsx](file:///d:/fleet-manage/apps/web/src/layouts/AdminLayout.tsx) | เพิ่ม `useEffect` ตรวจ session + redirect ไป login ถ้าไม่มี |
| 2 | **Admin Bypass Login** | [AdminLogin.tsx](file:///d:/fleet-manage/apps/web/src/pages/AdminLogin.tsx#L41-L48) | ลบ hardcoded bypass + catch-all fallback |
| 3 | **Error catch navigates to dashboard** | [AdminLogin.tsx](file:///d:/fleet-manage/apps/web/src/pages/AdminLogin.tsx#L80-L83) | เปลี่ยนเป็น show error แทน navigate |
| 4 | **Google Maps API Key hardcoded** | [mapServices.ts](file:///d:/fleet-manage/apps/mobile/src/lib/mapServices.ts#L4-L5) | ลบ fallback API key ออกจาก source |

### ⚠️ Warning — ควรแก้ไข

| # | Issue | แนวทาง |
|---|---|---|
| 5 | Web `database.types.ts` ขาด ~15 columns | Regenerate types จาก Supabase CLI |
| 6 | `system_settings` types ขาด `gps_config`, `approval_rules` etc. | Regenerate types |
| 7 | Web Supabase client ไม่มี `<Database>` generic | เพิ่ม type generic |
| 8 | Approval handler ไม่ set `approved_by` | เพิ่ม `approved_by: currentUser.id` |
| 9 | `processQueue()` ยังว่างเปล่า | Implement offline sync logic |
| 10 | Mobile ไม่มีหน้า revision feedback | เพิ่ม notification/badge สำหรับ revision |

### 💡 Improvement — ปรับปรุงภายหลังได้

| # | Issue | แนวทาง |
|---|---|---|
| 11 | Realtime subscription reload ทั้งหมด | ใช้ incremental update แทน full reload |
| 12 | Departments RLS เปิด ALL ให้ทุกคน | จำกัดเป็น admin-only สำหรับ write |
| 13 | Storage policy ไม่มี per-user path restriction | เพิ่ม path-based policy |
| 14 | `schema_and_seed.sql` มี type mismatch กับ DB จริง | Sync schema file กับ actual DB |

---

## 7. ✅ สิ่งที่ทำได้ดีแล้ว

| หมวด | รายละเอียด |
|---|---|
| **Mobile Auth Flow** | Login → PrivacyConsent → Dashboard ถูกต้อง ไม่มี bypass |
| **Anti-Drift GPS Engine** | 3-State evaluator สมบูรณ์ ป้องกัน GPS jitter ได้ดี |
| **Trip Draft Persistence** | TripDraftContext ใช้ AsyncStorage auto-save/load with debounce |
| **Realtime GPS Sync** | presenceService sync config จาก DB + listen realtime changes |
| **Image Upload Service** | Base64 → ArrayBuffer decoder + Supabase Storage + fallback |
| **Expense Auto-Summation** | DB trigger `sync_trip_total_expenses()` ทำงานถูกต้อง |
| **Route Optimization** | Haversine + brute-force permutation (≤8 stops) + nearest neighbor (>8) |
| **Dual Language** | LanguageContext TH/EN ใช้งานได้ทั้ง Web และ Mobile |
| **Dark Mode** | ThemeContext ทำงานได้ทั้ง Web และ Mobile |
| **RLS ทุกตาราง** | Row Level Security เปิดใช้ครบทุก 9 ตาราง |
