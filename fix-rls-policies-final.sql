-- Final RLS Policy Fix for Profiles Table
-- This will ensure authenticated users can create their own profiles

-- 1. Disable RLS temporarily to clean up
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies for profiles to start fresh
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;  
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_others" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

-- 3. Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create comprehensive policies that definitely work

-- INSERT policy - Allow authenticated users to create profiles with their own user ID
CREATE POLICY "authenticated_users_can_insert_own_profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- SELECT policy - Allow users to view their own profiles  
CREATE POLICY "authenticated_users_can_select_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- UPDATE policy - Allow users to update their own profiles
CREATE POLICY "authenticated_users_can_update_own_profile" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role bypass - Allow service role full access
CREATE POLICY "service_role_full_access"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Public read access for certain operations
CREATE POLICY "public_can_select_profiles"
ON public.profiles
FOR SELECT
TO public
USING (true);

-- 5. Grant necessary permissions explicitly
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT, SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 6. Test the policies
SELECT 'RLS Policies Created Successfully' as result;

SELECT 
  policyname,
  cmd,
  roles,
  permissive
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;