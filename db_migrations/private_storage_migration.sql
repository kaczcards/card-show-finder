-- db_migrations/private_storage_migration.sql
-- Migration to convert card_images bucket from public to private
-- and implement signed URL access model
-- 
-- This migration:
-- 1. Changes the card_images bucket from public to private
-- 2. Updates access policies to support private access
-- 3. Adds policies for signed URL generation
-- 4. Preserves user-specific access controls

-- Step 1: Convert the bucket from public to private
UPDATE storage.buckets
SET public = false
WHERE id = 'card_images';

-- Step 2: Remove the public read access policy since we'll use signed URLs instead
DROP POLICY IF EXISTS "Public read access for card images" ON storage.objects;

-- Step 3: Create a policy to allow authenticated users to read their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'Users can read their own card images'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can read their own card images"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'card_images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Step 4: Create a policy to allow service role to read all objects (for signed URL generation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'Service role can access all card images'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Service role can access all card images"
      ON storage.objects
      FOR SELECT
      TO service_role
      USING (bucket_id = 'card_images');
  END IF;
END $$;

-- Step 5: Create a policy to allow admins to access all card images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'Admins can access all card images'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Admins can access all card images"
      ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'card_images'
        AND EXISTS (
          SELECT 1 FROM auth.users
          JOIN profiles ON auth.users.id = profiles.id
          WHERE auth.uid() = profiles.id AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Step 6: Create a function to check if a user is an MVP dealer
CREATE OR REPLACE FUNCTION storage.is_mvp_dealer()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'mvp_dealer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create a policy to allow MVP dealers to access card images
-- This is useful for the card trading functionality
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'MVP dealers can access all card images'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "MVP dealers can access all card images"
      ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'card_images'
        AND storage.is_mvp_dealer()
      );
  END IF;
END $$;

-- Note: The existing policies for upload, update, and delete are preserved
-- as they're already properly scoped to user ownership:
-- - "Users can upload their own card images"
-- - "Users can update their own card images"
-- - "Users can delete their own card images"

-- Step 8: Add a comment to the bucket to indicate it's now private and uses signed URLs
COMMENT ON TABLE storage.buckets IS 'Storage buckets (private access via signed URLs)';
COMMENT ON COLUMN storage.buckets.public IS 'Set to false for card_images bucket - using signed URLs instead';
