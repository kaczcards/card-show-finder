-- Fix Registration - Add Missing Auth Trigger Only
-- Since the RLS policies and handle_new_user function already exist

-- Drop existing trigger if it exists (just in case)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the auth trigger
-- This will automatically create profiles when new users sign up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions to ensure the trigger can work
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT, SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Verify the trigger was created
SELECT 'Auth Trigger Created:' as result;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Also check if we can see the RLS policies now
SELECT 'Current RLS Policies:' as result;
SELECT 
    policyname as policy_name,
    cmd as operation,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;

SELECT 'Registration Fix Complete!' as result;