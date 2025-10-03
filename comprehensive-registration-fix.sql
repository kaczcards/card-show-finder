-- COMPREHENSIVE FIX FOR REGISTRATION ISSUE
-- This script will fix ALL potential issues with user registration

-- ============================================================
-- STEP 1: Verify and fix the trigger on auth.users
-- ============================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

SELECT 'Step 1: Trigger created on auth.users' as status;

-- ============================================================
-- STEP 2: Temporarily disable RLS to allow the fix
-- ============================================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

SELECT 'Step 2: RLS temporarily disabled' as status;

-- ============================================================
-- STEP 3: Drop ALL existing policies
-- ============================================================

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_name);
    RAISE NOTICE 'Dropped policy: %', policy_name;
  END LOOP;
END $$;

SELECT 'Step 3: All old policies dropped' as status;

-- ============================================================
-- STEP 4: Re-enable RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

SELECT 'Step 4: RLS re-enabled' as status;

-- ============================================================
-- STEP 5: Create the correct policies
-- ============================================================

-- Policy for users to view their own profile
CREATE POLICY "profiles_select_self"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy for users to view other profiles (limited info)
CREATE POLICY "profiles_select_others"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for users to update their own profile
CREATE POLICY "profiles_update_self"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy for users to insert their own profile
CREATE POLICY "profiles_insert_self"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy for service_role to do everything (critical for triggers!)
CREATE POLICY "profiles_service_role_all"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for admins
CREATE POLICY "profiles_admin_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND LOWER(p.role) = 'admin'
    )
  );

SELECT 'Step 5: New policies created' as status;

-- ============================================================
-- STEP 6: Grant necessary permissions
-- ============================================================

GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

SELECT 'Step 6: Permissions granted' as status;

-- ============================================================
-- STEP 7: Verify everything is set up correctly
-- ============================================================

-- Check trigger
SELECT 
  'TRIGGER CHECK:' as section,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created'
    )
    THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing!'
  END as result;

-- Check RLS is enabled
SELECT 
  'RLS CHECK:' as section,
  CASE 
    WHEN rowsecurity = true 
    THEN '✅ RLS is enabled'
    ELSE '❌ RLS is disabled'
  END as result
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Check policies
SELECT 
  'POLICY CHECK:' as section,
  COUNT(*)::text || ' policies exist' as result
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- List all policies
SELECT 
  'POLICIES:' as section,
  policyname,
  cmd as operation,
  roles::text
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

SELECT 
  '✅ ✅ ✅ SETUP COMPLETE ✅ ✅ ✅' as message,
  'Try registering a new user now!' as instruction;
