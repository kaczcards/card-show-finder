-- EMERGENCY FIX: Remove infinite recursion in RLS policies

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

-- Drop the problematic policy on profiles
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;
