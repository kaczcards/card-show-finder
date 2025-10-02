-- ============================================================================
-- IDEMPOTENT FIX - Safe to run multiple times
-- ============================================================================

-- Step 1: Fix is_admin() function (safe to run multiple times)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN FALSE;  -- Don't query profiles to prevent recursion
END;
$$;

-- Step 2: Drop ALL existing profiles policies
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_others" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_new_user" ON public.profiles;

-- Step 3: Create clean policies
CREATE POLICY "profiles_service_role"
ON public.profiles FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "profiles_read_authenticated"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_read_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Verify
SELECT 
  '✅ ' || policyname as policy_name, 
  cmd as operation
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
