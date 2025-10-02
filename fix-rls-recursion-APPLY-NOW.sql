-- URGENT FIX: Apply this in Supabase SQL Editor to fix login
-- This fixes the infinite recursion error: "infinite recursion detected in policy for relation profiles"

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;

-- Step 2: Fix is_admin() to not query profiles table (this breaks the recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Don't query profiles - just return false for now
  -- Admin checks can be done via service_role instead
  RETURN FALSE;
END;
$$;

-- Step 3: Ensure we have the INSERT policy for new user registration
DROP POLICY IF EXISTS "profiles_insert_new_user" ON public.profiles;
CREATE POLICY "profiles_insert_new_user"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Step 4: Ensure service_role has full access
DROP POLICY IF EXISTS "profiles_service_role_all" ON public.profiles;
CREATE POLICY "profiles_service_role_all"
ON public.profiles
USING (auth.role() = 'service_role');

-- Verify policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
