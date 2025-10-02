-- TEMPORARY TEST: Disable RLS on profiles to isolate the issue
-- This will help us understand if RLS is the problem or if there's something else

-- First, let's see the current state
SELECT 
  '=== BEFORE - RLS Status ===' as info,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Temporarily disable RLS on profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Verify it's disabled
SELECT 
  '=== AFTER - RLS Status ===' as info,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Instructions:
-- 1. Run this script
-- 2. Try to register a new user
-- 3. If it works, the problem IS the RLS policies
-- 4. If it still fails, there's a different issue (constraint, trigger logic, etc.)
-- 5. After testing, re-enable RLS with: ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
