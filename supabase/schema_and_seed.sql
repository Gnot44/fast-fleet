-- ==============================================================================
-- FastFleet Field Marketing Intelligence Hub - Supabase Master Schema & Seed
-- Version: 2.4 (Production Ready)
-- Target: Supabase Cloud PostgreSQL
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. System Profiles Table (Linked with Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'specialist' CHECK (role IN ('admin', 'manager', 'specialist')),
    department TEXT DEFAULT 'Field Marketing Operations',
    timezone TEXT DEFAULT 'Asia/Bangkok (GMT+7)',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    push_token TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Marketing Specialists Telemetry & Performance Table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL UNIQUE,
    territory TEXT DEFAULT 'Bangkok Central (B2B)',
    assigned_vehicle TEXT DEFAULT 'Isuzu D-Max (1กข-4452)',
    current_location TEXT,
    total_trips INTEGER DEFAULT 0,
    total_distance_km NUMERIC(10, 2) DEFAULT 0.00,
    on_time_rate NUMERIC(5, 2) DEFAULT 98.50,
    on_time_percentage NUMERIC(5, 2) DEFAULT 98.50,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    safety_score INTEGER DEFAULT 98,
    emergency_contact TEXT,
    department TEXT DEFAULT 'Field Marketing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Trips & Itineraries Table
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_code TEXT UNIQUE,
    title TEXT NOT NULL,
    trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'instant' CHECK (type IN ('instant', 'scheduled')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'revision_requested')),
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
    tenant_id TEXT DEFAULT 'FASTFLEET_DEFAULT',
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
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'arrived', 'completed', 'cancelled')),
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
    tenant_id TEXT DEFAULT 'FASTFLEET_DEFAULT',
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

-- 8. Privacy & GPS Consent Logs Table
CREATE TABLE IF NOT EXISTS public.consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. System Global Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT DEFAULT 'FastFleet Field Marketing Co., Ltd.',
    timezone TEXT DEFAULT 'Asia/Bangkok (GMT+7)',
    currency TEXT DEFAULT 'THB (฿)',
    gps_ping_interval_sec INTEGER DEFAULT 10,
    max_speed_limit NUMERIC(5, 2) DEFAULT 120.00,
    excessive_idle_minutes INTEGER DEFAULT 15,
    auto_dispatch BOOLEAN DEFAULT TRUE,
    geofence_opacity NUMERIC(3, 2) DEFAULT 0.35,
    map_defaults JSONB DEFAULT '{"lat": 13.7563, "lng": 100.5018, "zoom": 12}'::JSONB,
    notifications_config JSONB DEFAULT '{"tripSubmitted": true, "tripRevision": true, "dropCheckin": true, "lowBattery": true}'::JSONB,
    tenant_id TEXT DEFAULT 'FASTFLEET_DEFAULT',
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

-- ==============================================================================
-- 11. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Admins can view and manage all profiles" ON public.profiles
    FOR ALL USING (public.is_admin() OR auth.uid() = id);

-- Staff Policies
CREATE POLICY "Admins can manage staff, specialists can view self" ON public.staff
    FOR ALL USING (public.is_admin() OR profile_id = auth.uid());

-- Trips Policies
CREATE POLICY "Admins manage all trips, specialists manage own trips" ON public.trips
    FOR ALL USING (public.is_admin() OR staff_id = auth.uid());

-- Appointments Policies
CREATE POLICY "Admins manage all appointments, specialists manage own" ON public.appointments
    FOR ALL USING (public.is_admin() OR staff_id = auth.uid());

-- Expenses Policies
CREATE POLICY "Admins manage all expenses, specialists manage own" ON public.expenses
    FOR ALL USING (public.is_admin() OR staff_id = auth.uid());

-- Location Logs Policies
CREATE POLICY "Admins can read all locations, specialists insert own" ON public.location_logs
    FOR ALL USING (public.is_admin() OR staff_id = auth.uid());

-- System Settings Policies
CREATE POLICY "Anyone authenticated can read settings, admin can update" ON public.system_settings
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (public.is_admin());

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
CREATE POLICY "Public read for trip photos" ON storage.objects
    FOR SELECT USING (bucket_id IN ('trip_photos', 'expense_receipts', 'avatars'));

CREATE POLICY "Authenticated users can upload photos" ON storage.objects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

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
