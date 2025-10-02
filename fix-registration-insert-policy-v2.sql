-- Fix Registration - V2
-- The issue: The trigger runs as postgres/service_role during registration
-- and auth.uid() may not be set yet during the trigger execution.
-- Solution: Add policies for both authenticated users AND service_role

-- First, let's see what we have
SELECT 
  '=== BEFORE FIX - Current policies ===' as status,
  policyname,
  cmd,
  roles::text
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Drop existing INSERT policies to start clean
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

-- Create INSERT policy for authenticated users (regular app use)
CREATE POLICY "profiles_insert_self"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create INSERT policy for service_role (for trigger to work)
-- This is what the handle_new_user() trigger needs!
CREATE POLICY "profiles_insert_service_role"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant necessary table permissions
GRANT INSERT ON public.profiles TO service_role;
GRANT INSERT ON public.profiles TO authenticated;

-- Verify policies were created
SELECT 
  '=== AFTER FIX - Current policies ===' as status,
  policyname,
  cmd,
  roles::text
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Final verification
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_service_role'
      AND cmd = 'INSERT'
    )
    THEN '✅ SUCCESS: Service role INSERT policy is active!'
    ELSE '❌ ERROR: Service role policy missing'
  END as verification_result;

-- Show grants
SELECT 
  '=== Table permissions ===' as status,
  grantee, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND privilege_type = 'INSERT'
ORDER BY grantee;
