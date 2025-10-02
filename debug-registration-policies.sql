-- Debug script to understand why registration is failing
-- Run this in Supabase SQL Editor to see the current state

-- 1. Check if RLS is enabled on profiles
SELECT 
  '=== RLS STATUS ===' as section,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- 2. Check ALL current policies on profiles table
SELECT 
  '=== ALL POLICIES ON PROFILES ===' as section,
  policyname,
  cmd as operation,
  roles::text,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- 3. Check table permissions
SELECT 
  '=== TABLE GRANTS ===' as section,
  grantee, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- 4. Check the trigger exists and is active
SELECT 
  '=== TRIGGER STATUS ===' as section,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  tgtype,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 5. Check the handle_new_user function exists
SELECT 
  '=== FUNCTION STATUS ===' as section,
  proname as function_name,
  prosecdef as is_security_definer,
  proowner::regrole as owner,
  proacl as permissions
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 6. Check profiles table structure
SELECT 
  '=== PROFILES TABLE STRUCTURE ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 7. Try to understand if there are any other constraints
SELECT
  '=== TABLE CONSTRAINTS ===' as section,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
ORDER BY contype, conname;

-- 8. Check if there are any recent failed registration attempts in profiles
-- (This will show if ANY profiles exist)
SELECT 
  '=== RECENT PROFILES (last 10) ===' as section,
  id,
  email,
  created_at,
  role,
  account_type
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;
