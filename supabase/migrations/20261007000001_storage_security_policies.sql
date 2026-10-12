-- ==============================================================================
-- Migration: 20261007000001_storage_security_policies.sql
-- Description: Replace insecure public storage upload/update/delete policies
--              with authenticated owner-scoped and admin-authorized policies.
-- ==============================================================================

-- 1. Drop old insecure policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public select to expense_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public select to trip_photos" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public update to expense_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public update to trip_photos" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public uploads to expense_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public uploads to trip_photos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can view photos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access for avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Public read for trip photos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
    DROP POLICY IF EXISTS "Public read for fleet storage buckets" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated owners or admin can insert storage objects" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated owners or admin can update storage objects" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated owners or admin can delete storage objects" ON storage.objects;
END $$;

-- 2. Public Read Policy for fleet storage buckets
CREATE POLICY "Public read for fleet storage buckets"
ON storage.objects FOR SELECT
USING (bucket_id IN ('trip_photos', 'expense_receipts', 'avatars'));

-- 3. Authenticated Insert Policy (Owner or Admin)
CREATE POLICY "Authenticated owners or admin can insert storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('trip_photos', 'expense_receipts', 'avatars')
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.is_admin()
  )
);

-- 4. Authenticated Update Policy (Owner or Admin for upsert)
CREATE POLICY "Authenticated owners or admin can update storage objects"
ON storage.objects FOR UPDATE
TO authenticated
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

-- 5. Authenticated Delete Policy (Owner or Admin)
CREATE POLICY "Authenticated owners or admin can delete storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('trip_photos', 'expense_receipts', 'avatars')
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.is_admin()
  )
);
