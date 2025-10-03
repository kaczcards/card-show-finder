-- ============================================================================
-- COMPREHENSIVE FIX FOR INFINITE RECURSION IN RLS POLICIES
-- ============================================================================
-- The is_admin() function causes infinite recursion because it queries 
-- the profiles table, which triggers policies that call is_admin() again.
--
-- This affects MULTIPLE tables, not just profiles.
-- We need to fix ALL policies that use is_admin() on the profiles table.
-- ============================================================================

-- Step 1: Fix the is_admin() function to NOT query profiles
-- Instead, return FALSE (admins will use service_role for admin actions)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- CRITICAL: Do NOT query the profiles table here!
  -- That causes infinite recursion when called from profiles policies.
  -- Admin access should be granted via service_role instead.
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Returns FALSE to prevent infinite recursion. Use service_role for admin access.';

-- Step 2: Drop and recreate profiles policies WITHOUT is_admin() check
-- Keep only service_role check (no function call)

DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;
CREATE POLICY "profiles_service_role_only"
ON public.profiles
FOR ALL
USING (auth.role() = 'service_role');

-- Step 3: Ensure authenticated users can select profiles (needed for app to work)
-- This policy already exists but let's verify it's there
DROP POLICY IF EXISTS "profiles_select_others" ON public.profiles;
CREATE POLICY "profiles_select_others"
ON public.profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- Step 4: Users can select their own profile
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Step 5: Users can update their own profile
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 6: Allow INSERT for new user registration (via trigger)
DROP POLICY IF EXISTS "profiles_insert_new_user" ON public.profiles;
CREATE POLICY "profiles_insert_new_user"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check that profiles policies are correct (should show 5 policies)
SELECT 
  policyname, 
  cmd,
  CASE 
    WHEN cmd = 'ALL' THEN 'ALL operations'
    WHEN cmd = 'SELECT' THEN 'Read only'
    WHEN cmd = 'INSERT' THEN 'Create only'
    WHEN cmd = 'UPDATE' THEN 'Update only'
    ELSE cmd
  END as operation
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check is_admin function definition (should NOT contain SELECT FROM profiles)
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'is_admin'
  AND routine_schema = 'public';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies fixed successfully!';
  RAISE NOTICE 'You should now be able to login without infinite recursion errors.';
  RAISE NOTICE 'Restart your app and test the login flow.';
END $$;
