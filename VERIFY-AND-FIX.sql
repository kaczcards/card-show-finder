-- ============================================================================
-- STEP 1: VERIFY YOU'RE ON THE RIGHT PROJECT
-- ============================================================================
-- Run this first to make sure you're in the correct Supabase project
-- Your app uses: https://zmfqzegykwyrrvrpwylf.supabase.co

SELECT 
  '🔍 Current database: ' || current_database() as info,
  '🌐 Check this matches your project in the URL bar!' as note;

-- ============================================================================
-- STEP 2: CHECK CURRENT STATE OF POLICIES
-- ============================================================================
SELECT 
  '📋 CURRENT POLICIES:' as section,
  policyname, 
  cmd,
  qual::text as condition
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- STEP 3: CHECK is_admin() FUNCTION
-- ============================================================================
SELECT 
  '🔍 is_admin() FUNCTION:' as section,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'is_admin' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- STEP 4: FIX EVERYTHING
-- ============================================================================
-- Only uncomment and run this AFTER verifying the above checks

/*
-- Fix is_admin() to not query profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN FALSE;
END;
$$;

-- Drop problematic policy
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;

-- Verify it's gone
SELECT 
  '✅ After deletion:' as section,
  policyname 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
*/
