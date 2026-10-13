-- ==============================================================================
-- Migration: 20261013000001_optimize_performance_and_clean_policies.sql
-- Description: Performance & Schema Optimization from Full Audit (2026-10-13)
--   1. Add covering indexes for unindexed foreign keys (fixes 5 linter warnings)
--   2. Drop duplicate index on location_logs (fixes duplicate_index warning)
--   3. Drop dummy "Public access policy" (USING false CHECK false) (fixes 25 multiple_permissive_policies warnings)
--   4. Optimize RLS policies with (SELECT auth.uid()) to prevent per-row initplan re-evaluation
--   5. Fix handle_new_user() to check raw_user_meta_data for full_name
--   6. Set trips.approval_status default to 'draft'
-- ==============================================================================

-- 1. Covering indexes for Foreign Keys
CREATE INDEX IF NOT EXISTS idx_appointments_trip_id ON public.appointments(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_staff_id ON public.expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_staff_id ON public.trips(staff_id);
CREATE INDEX IF NOT EXISTS idx_trips_approved_by ON public.trips(approved_by);

-- 2. Drop duplicate index on location_logs (keeping idx_location_logs_staff_time)
DROP INDEX IF EXISTS public.idx_location_logs_staff_created;

-- 3. Drop redundant "Public access policy" with false/false (eliminates 25 multiple_permissive_policies warnings)
DROP POLICY IF EXISTS "Public access policy" ON public.appointments;
DROP POLICY IF EXISTS "Public access policy" ON public.expenses;
DROP POLICY IF EXISTS "Public access policy" ON public.location_logs;
DROP POLICY IF EXISTS "Public access policy" ON public.profiles;
DROP POLICY IF EXISTS "Public access policy" ON public.system_settings;
DROP POLICY IF EXISTS "Public access policy" ON public.trips;

-- 4. Optimize RLS Policies with (SELECT auth.uid()) to avoid per-row function calls
DROP POLICY IF EXISTS "Staff and Admins can manage appointments" ON public.appointments;
CREATE POLICY "Staff and Admins can manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
  WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

DROP POLICY IF EXISTS "Staff and Admins can manage expenses" ON public.expenses;
CREATE POLICY "Staff and Admins can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
  WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

DROP POLICY IF EXISTS "Staff and Admins can manage location logs" ON public.location_logs;
CREATE POLICY "Staff and Admins can manage location logs" ON public.location_logs
  FOR ALL TO authenticated
  USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
  WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

DROP POLICY IF EXISTS "Staff and Admins can manage trips" ON public.trips;
CREATE POLICY "Staff and Admins can manage trips" ON public.trips
  FOR ALL TO authenticated
  USING ((staff_id = (SELECT auth.uid())) OR public.is_admin())
  WITH CHECK ((staff_id = (SELECT auth.uid())) OR public.is_admin());

DROP POLICY IF EXISTS "Allow users to insert own profile or admins" ON public.profiles;
CREATE POLICY "Allow users to insert own profile or admins" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = id) OR public.is_admin());

DROP POLICY IF EXISTS "Allow users to update own profile or admins" ON public.profiles;
CREATE POLICY "Allow users to update own profile or admins" ON public.profiles
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = id) OR public.is_admin())
  WITH CHECK (((SELECT auth.uid()) = id) OR public.is_admin());

-- 5. Update handle_new_user to read full_name from raw_user_meta_data or raw_app_meta_data
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

-- 6. Set trips.approval_status default to 'draft'
ALTER TABLE public.trips ALTER COLUMN approval_status SET DEFAULT 'draft';
