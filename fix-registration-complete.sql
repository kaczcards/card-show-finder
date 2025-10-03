-- Complete Registration Fix
-- This addresses the "new row violates row-level security policy" error

-- 1. Enable RLS on profiles table (in case it's not enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create essential RLS policies for profiles table
-- These policies allow authenticated users to manage their own profiles

-- INSERT policy - Critical for registration to work
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- SELECT policy - Allows users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- UPDATE policy - Allows users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role policy - Allows backend operations
CREATE POLICY "Service role has full access to profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Create the auth trigger (the handle_new_user function already exists)
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5. Test the fix by checking what was created
SELECT 'RLS Policies Created:' as status;
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;

SELECT 'Auth Trigger Created:' as status;
SELECT 
  tgname,
  tgrelid::regclass
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

SELECT 'Fix Complete - Registration should now work!' as status;