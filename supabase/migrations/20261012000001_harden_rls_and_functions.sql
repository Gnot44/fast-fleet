-- ==============================================================================
-- Migration: 20261012000001_harden_rls_and_functions.sql
-- Description: Security hardening from audit v2 (2026-10-12)
--   C1: Block self-promotion via profiles.role
--   C2: Owner/admin check on sync_trip_itinerary (was callable by anon, no checks)
--   H2: Remove public access to cleanup_old_location_logs
--   +  Revoke EXECUTE on trigger-only / privileged functions from anon & PUBLIC
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- C1. Prevent non-admins from changing their own role
-- RLS lets users update their own profile row, but cannot restrict columns.
-- Requests without a JWT (service_role, SQL editor, auth signup trigger) are
-- allowed so admin tooling and handle_new_user() keep working.
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

REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ------------------------------------------------------------------------------
-- C2. sync_trip_itinerary: SECURITY INVOKER + explicit owner/admin check
-- - Only the trip owner or an admin may modify the trip's appointments
-- - Deletes/updates are scoped to appointments that belong to p_trip_id
-- - staff_id is taken from the trip, not from client input
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

  -- 1. Delete appointments (only those belonging to this trip)
  IF p_deleted_ids IS NOT NULL AND array_length(p_deleted_ids, 1) > 0 THEN
    DELETE FROM appointments
    WHERE id = ANY(p_deleted_ids)
      AND trip_id = p_trip_id;
  END IF;

  -- 2. Upsert appointments (conflicts on other trips' rows are ignored)
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

REVOKE EXECUTE ON FUNCTION public.sync_trip_itinerary(uuid, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_trip_itinerary(uuid, uuid[], jsonb) TO authenticated;

-- ------------------------------------------------------------------------------
-- H2. cleanup_old_location_logs: maintenance only (pg_cron / service_role)
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.cleanup_old_location_logs(integer) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Trigger-only functions: never need to be called via the REST API.
-- (Postgres does not check EXECUTE when a trigger fires.)
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_trip_total_expenses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_user() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Signed-in only functions (each already checks auth.uid()/is_admin internally)
-- is_admin() must stay executable by authenticated: RLS policies call it.
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_specialist_presence(boolean, double precision, double precision, text, real, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_specialist_presence(boolean, double precision, double precision, text, real, real) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
