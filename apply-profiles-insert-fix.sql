-- Quick fix script to add missing INSERT policy
-- This can be run directly in Supabase SQL Editor

-- Check current policies BEFORE the fix
SELECT 
  'BEFORE FIX - Current policies on profiles table:' as status,
  policyname,
  cmd as operation,
  roles::text
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname;

-- Add the missing INSERT policy
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;

CREATE POLICY "profiles_insert_self"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Check policies AFTER the fix
SELECT 
  'AFTER FIX - Current policies on profiles table:' as status,
  policyname,
  cmd as operation,
  roles::text
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname;

-- Verify the INSERT policy exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_self'
      AND cmd = 'INSERT'
    )
    THEN '✅ SUCCESS: INSERT policy is now active!'
    ELSE '❌ ERROR: INSERT policy was not created'
  END as verification_result;
