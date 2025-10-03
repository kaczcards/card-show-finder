-- Migration: 20251002000000_fix_profiles_insert_policy.sql
-- Description: Add missing INSERT policy for profiles table to fix registration
-- Date: 2025-10-02
-- Issue: New user registration fails with "new row violates row-level security policy"
--
-- Root Cause:
--   The profiles table has RLS enabled with SELECT and UPDATE policies,
--   but is missing an INSERT policy. When handle_new_user() trigger tries
--   to create a new profile during registration, it's blocked by RLS.
--
-- Solution:
--   Add an INSERT policy that allows users to create their own profile
--   during registration (auth.uid() = id).

-- Ensure RLS is enabled (should already be enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policies if they exist (idempotent)
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

-- Create INSERT policy for authenticated users (regular app use)
CREATE POLICY "profiles_insert_self"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create INSERT policy for service_role (critical for trigger)
-- The handle_new_user() trigger runs as SECURITY DEFINER with postgres/service_role privileges
-- and needs this policy to bypass RLS during user registration
CREATE POLICY "profiles_insert_service_role"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant necessary permissions
GRANT INSERT ON public.profiles TO service_role;
GRANT INSERT ON public.profiles TO authenticated;

-- Add comments explaining the policies
COMMENT ON POLICY "profiles_insert_self" ON public.profiles IS 
'Allows authenticated users to insert their own profile. 
Users can only create a profile where their auth.uid() matches the profile id.';

COMMENT ON POLICY "profiles_insert_service_role" ON public.profiles IS 
'Allows service_role to insert profiles. This is critical for the handle_new_user() 
trigger function which runs as SECURITY DEFINER and needs to create profiles during 
user registration.';

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
    AND policyname = 'profiles_insert_self'
  ) THEN
    RAISE NOTICE 'SUCCESS: profiles_insert_self policy created';
  ELSE
    RAISE EXCEPTION 'FAILED: profiles_insert_self policy was not created';
  END IF;
END $$;

-- Log all current policies on profiles table for verification
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== Current RLS Policies on profiles table ===';
  FOR policy_record IN 
    SELECT policyname, cmd, roles::text
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
    ORDER BY policyname
  LOOP
    RAISE NOTICE 'Policy: % | Command: % | Roles: %', 
      policy_record.policyname, 
      policy_record.cmd, 
      policy_record.roles;
  END LOOP;
END $$;
