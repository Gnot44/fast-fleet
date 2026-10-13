-- ==============================================================================
-- FastFleet Field Marketing Intelligence Hub - Supabase Master Schema & Seed
-- Version: 2.4 (Production Ready)
-- Target: Supabase Cloud PostgreSQL
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Master Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 3. System Profiles Table (Linked with Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'specialist' CHECK (role IN ('admin', 'manager', 'specialist')),
    position TEXT DEFAULT 'Field Marketing Specialist',
    department TEXT DEFAULT 'Field Marketing Operations',
    timezone TEXT DEFAULT 'Asia/Bangkok (GMT+7)',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    push_token TEXT,
    bio TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_address TEXT,
    current_speed REAL DEFAULT 0.0,
    battery_level REAL DEFAULT 100.0,
    assigned_vehicle TEXT,
    assigned_vehicle_plate TEXT,
    assigned_vehicle_model TEXT,
    driving_license_no TEXT,
    driving_license_type TEXT,
    driving_license_expiry TEXT,
    employee_id TEXT,
    territory TEXT,
    vehicle_type TEXT,
    is_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    user_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: Staff-specific fields (employee_id, territory, vehicle_type) have been
-- consolidated directly into public.profiles to maintain a single source of truth.

-- 4. Trips & Itineraries Table
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_code TEXT UNIQUE,
    title TEXT NOT NULL,
    trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'instant' CHECK (type IN ('instant', 'scheduled')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending', 'approved', 'revision_requested')),
    assigned_vehicle TEXT,
    start_odometer NUMERIC(10, 2),
    end_odometer NUMERIC(10, 2),
    current_odometer NUMERIC(10, 2),
    start_location JSONB,
    actual_start_location JSONB,
    total_distance_km NUMERIC(10, 2) DEFAULT 0.00,
    total_expenses NUMERIC(12, 2) DEFAULT 0.00,
    safety_score INTEGER DEFAULT 100,
    manager_feedback TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Appointments & Client Drops Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sequence_order INTEGER DEFAULT 1,
    name TEXT,
    company_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    recipient_name TEXT,
    recipient_phone TEXT,
    destination_address TEXT,
    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,
    distance_km NUMERIC(10, 2) DEFAULT 0.00,
    appointment_type TEXT DEFAULT 'pitch' CHECK (appointment_type IN ('pitch', 'renewal', 'healthcheck', 'demo', 'other')),
    type TEXT DEFAULT 'pitch',
    agenda TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'arrived', 'completed', 'cancelled', 'incomplete')),
    confirmation_status BOOLEAN DEFAULT FALSE,
    meeting_notes TEXT,
    meeting_notes_updated_at TIMESTAMPTZ,
    client_photo_url TEXT,
    start_odometer NUMERIC(10, 2),
    end_odometer NUMERIC(10, 2),
    odometer_reading NUMERIC(10, 2),
    driver_notes TEXT,
    items_description TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Expenses & Reimbursements Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    category TEXT NOT NULL CHECK (category IN ('toll', 'parking', 'fuel', 'entertainment', 'other', 'ค่าทางด่วน', 'ค่าที่จอดรถ', 'ค่าน้ำมัน', 'ค่าเลี้ยงรับรอง', 'อื่นๆ')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    receipt_url TEXT,
    receipt_image_path TEXT,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Covering Indexes for Foreign Key performance
CREATE INDEX IF NOT EXISTS idx_appointments_trip_id ON public.appointments(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_staff_id ON public.expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_staff_id ON public.trips(staff_id);
CREATE INDEX IF NOT EXISTS idx_trips_approved_by ON public.trips(approved_by);

-- 7. Realtime GPS Location Logs & Anti-Drift Telemetry Table
CREATE TABLE IF NOT EXISTS public.location_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0.0,
    heading DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    battery_level INTEGER,
    is_mock_location BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for high-speed spatial & temporal queries
CREATE INDEX IF NOT EXISTS idx_location_logs_staff_time ON public.location_logs(staff_id, created_at DESC);

-- 8. System Global Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT DEFAULT 'FastFleet Field Marketing Co., Ltd.',
    timezone TEXT DEFAULT 'Asia/Bangkok (GMT+7)',
    currency TEXT DEFAULT 'THB (฿)',
    operating_hours JSONB DEFAULT '{"start": "08:00", "end": "19:00"}'::JSONB,
    gps_config JSONB DEFAULT '{"mbSpeedMoving": 4.0, "mbDistMoving": 10.0, "mbSpeedStatic": 1.5, "mbStaticRadius": 15.0, "dropIgnoreData": true}'::JSONB,
    approval_rules JSONB DEFAULT '{"requireAllDropsConfirmed": true, "requireReceiptSlips": true, "maxExpensePerTrip": 3000, "requireStartOdometer": true}'::JSONB,
    notifications_config JSONB DEFAULT '{"tripSubmitted": true, "tripRevision": true, "dropCheckin": true, "lowBattery": true}'::JSONB,
    api_key TEXT DEFAULT 'flt_live_mkt_99a8b7c6d5e4f3a2b1c0987654321',
    gps_ping_interval_sec INTEGER DEFAULT 10,
    max_speed_limit NUMERIC(5, 2) DEFAULT 120.00,
    excessive_idle_minutes INTEGER DEFAULT 15,
    auto_dispatch BOOLEAN DEFAULT TRUE,
    geofence_opacity NUMERIC(3, 2) DEFAULT 0.35,
    map_defaults JSONB DEFAULT '{"lat": 13.7563, "lng": 100.5018, "zoom": 12}'::JSONB,
    tenant_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. Database Triggers for Automatic Timestamps & Expense Summation
-- ==============================================================================

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update total_expenses in trips when an expense is inserted/deleted/updated
CREATE OR REPLACE FUNCTION public.sync_trip_total_expenses()
RETURNS TRIGGER AS $$
DECLARE
    v_trip_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_trip_id := OLD.trip_id;
    ELSE
        v_trip_id := NEW.trip_id;
    END IF;

    IF v_trip_id IS NOT NULL THEN
        UPDATE public.trips
        SET total_expenses = COALESCE((
            SELECT SUM(amount) FROM public.expenses WHERE trip_id = v_trip_id
        ), 0.00)
        WHERE id = v_trip_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_sync_trip_expenses
    AFTER INSERT OR UPDATE OR DELETE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.sync_trip_total_expenses();

-- Realtime Presence & GPS Telemetry Update Function
CREATE OR REPLACE FUNCTION public.update_specialist_presence(
    p_is_online BOOLEAN,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_speed DOUBLE PRECISION DEFAULT 0.0,
    p_battery INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET 
        is_online = p_is_online,
        last_seen_at = NOW(),
        current_lat = COALESCE(p_lat, current_lat),
        current_lng = COALESCE(p_lng, current_lng),
        current_address = COALESCE(p_address, current_address),
        current_speed = COALESCE(p_speed, current_speed),
        battery_level = COALESCE(p_battery, battery_level),
        updated_at = NOW()
    WHERE id = auth.uid();

    -- Also record into location_logs if online and coordinates are provided
    IF p_is_online AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        INSERT INTO public.location_logs (
            staff_id,
            lat,
            lng,
            speed,
            battery_level
        ) VALUES (
            auth.uid(),
            p_lat,
            p_lng,
            p_speed,
            p_battery
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 11. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin (optimized with scalar subquery)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Departments Policies
CREATE POLICY "Allow public read access to departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to departments" ON public.departments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Profiles Policies
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to insert own profile or admins" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (((SELECT auth.uid()) = id) OR public.is_admin());
CREATE POLICY "Allow users to update own profile or admins" ON public.profiles
    FOR UPDATE TO authenticated
    USING (((SELECT auth.uid()) = id) OR public.is_admin())
    WITH CHECK (((SELECT auth.uid()) = id) OR public.is_admin());

-- Trips Policies
CREATE POLICY "Staff and Admins can manage trips" ON public.trips
    FOR ALL TO authenticated
    USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
    WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

-- Appointments Policies
CREATE POLICY "Staff and Admins can manage appointments" ON public.appointments
    FOR ALL TO authenticated
    USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
    WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

-- Expenses Policies
CREATE POLICY "Staff and Admins can manage expenses" ON public.expenses
    FOR ALL TO authenticated
    USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
    WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

-- Location Logs Policies
CREATE POLICY "Staff and Admins can manage location logs" ON public.location_logs
    FOR ALL TO authenticated
    USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
    WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

-- System Settings Policies
CREATE POLICY "Anyone authenticated can read settings, admin can update" ON public.system_settings
    FOR ALL TO authenticated USING (true)
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- Role Escalation Protection Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Access denied: cannot assign privileged role'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Access denied: only administrators can change roles'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ------------------------------------------------------------------------------
-- New Auth User Profile Creation Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_app_meta_data->>'full_name',
      NEW.email
    ),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- Itinerary Sync RPC Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_trip_itinerary(
  p_trip_id uuid,
  p_deleted_ids uuid[],
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  item JSONB;
  v_uid UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT staff_id INTO v_owner FROM trips WHERE id = p_trip_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Trip not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner <> v_uid AND NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF p_deleted_ids IS NOT NULL AND array_length(p_deleted_ids, 1) > 0 THEN
    DELETE FROM appointments
    WHERE id = ANY(p_deleted_ids)
      AND trip_id = p_trip_id;
  END IF;

  IF p_updates IS NOT NULL AND jsonb_array_length(p_updates) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
      INSERT INTO appointments (
        id, trip_id, staff_id, type, sequence_order,
        company_name, customer_name, recipient_name, recipient_phone,
        destination_address, destination_lat, destination_lng,
        agenda, status, confirmation_status
      )
      VALUES (
        (item->>'id')::UUID,
        p_trip_id,
        v_owner,
        COALESCE(item->>'type', 'appointment'),
        COALESCE((item->>'sequence_order')::INT, 1),
        COALESCE(item->>'company_name', 'Client Stop'),
        COALESCE(item->>'customer_name', 'Client Visit'),
        COALESCE(item->>'recipient_name', item->>'customer_name', 'Client Visit'),
        COALESCE(item->>'recipient_phone', ''),
        COALESCE(item->>'destination_address', ''),
        (item->>'destination_lat')::DOUBLE PRECISION,
        (item->>'destination_lng')::DOUBLE PRECISION,
        COALESCE(item->>'agenda', 'เข้าพบและนำเสนอสินค้า'),
        COALESCE(item->>'status', 'pending'),
        COALESCE((item->>'confirmation_status')::BOOLEAN, false)
      )
      ON CONFLICT (id) DO UPDATE SET
        sequence_order = EXCLUDED.sequence_order,
        company_name = EXCLUDED.company_name,
        customer_name = EXCLUDED.customer_name,
        recipient_name = EXCLUDED.recipient_name,
        recipient_phone = EXCLUDED.recipient_phone,
        destination_address = EXCLUDED.destination_address,
        destination_lat = EXCLUDED.destination_lat,
        destination_lng = EXCLUDED.destination_lng,
        agenda = EXCLUDED.agenda
      WHERE appointments.trip_id = p_trip_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- Admin Password Reset RPC Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can reset user passwords';
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;

-- Function Execution Permissions Hardening
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_trip_total_expenses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_trip_itinerary(uuid, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_trip_itinerary(uuid, uuid[], jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_specialist_presence(boolean, double precision, double precision, text, real, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_specialist_presence(boolean, double precision, double precision, text, real, real) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;


-- ==============================================================================
-- 12. Supabase Storage Buckets Configuration
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('trip_photos', 'trip_photos', true),
    ('expense_receipts', 'expense_receipts', true),
    ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Security Policies
CREATE POLICY "Public read for fleet storage buckets" ON storage.objects
    FOR SELECT USING (bucket_id IN ('trip_photos', 'expense_receipts', 'avatars'));

CREATE POLICY "Authenticated owners or admin can insert storage objects" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('trip_photos', 'expense_receipts', 'avatars')
        AND (
            (storage.foldername(name))[1] = (SELECT auth.uid())::text
            OR public.is_admin()
        )
    );

CREATE POLICY "Authenticated owners or admin can update storage objects" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('trip_photos', 'expense_receipts', 'avatars')
        AND (
            (storage.foldername(name))[1] = (SELECT auth.uid())::text
            OR public.is_admin()
        )
    )
    WITH CHECK (
        bucket_id IN ('trip_photos', 'expense_receipts', 'avatars')
        AND (
            (storage.foldername(name))[1] = (SELECT auth.uid())::text
            OR public.is_admin()
        )
    );

CREATE POLICY "Authenticated owners or admin can delete storage objects" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id IN ('trip_photos', 'expense_receipts', 'avatars')
        AND (
            (storage.foldername(name))[1] = (SELECT auth.uid())::text
            OR public.is_admin()
        )
    );

-- ==============================================================================
-- 13. Enable Realtime Publications
-- ==============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.location_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- ==============================================================================
-- 14. Pre-seeded Default Data (Phase 1 Testing Seed)
-- ==============================================================================

-- Default System Settings
INSERT INTO public.system_settings (id, company_name, timezone, currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'FastFleet Field Marketing Co., Ltd.', 'Asia/Bangkok (GMT+7)', 'THB (฿)')
ON CONFLICT (id) DO NOTHING;
