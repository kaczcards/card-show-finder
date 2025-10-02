-- Fix infinite recursion in profiles RLS policies
-- The is_admin() function was querying profiles, which triggered the policy that called is_admin()

-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;

-- Recreate is_admin function to use auth.jwt() instead of querying profiles
-- This breaks the recursion by checking the JWT claims directly
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if user has admin role in their JWT claims
  -- This avoids querying the profiles table
  RETURN COALESCE(
    (auth.jwt()->>'role')::text = 'admin',
    FALSE
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has admin role via JWT claims (no table query)';

-- Create a new admin policy that only checks service_role
-- Regular admins will use the normal select policies
CREATE POLICY "profiles_service_role_all"
ON public.profiles
USING (auth.role() = 'service_role');

-- Ensure we have the INSERT policy for the trigger
-- This allows the handle_new_user trigger to create profiles
CREATE POLICY "profiles_insert_new_user"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
