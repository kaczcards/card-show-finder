-- Debug Registration Process
-- Run this to see the current state and test trigger functionality

-- 1. Check if auth trigger exists
SELECT 'Auth Trigger Status:' as step;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 2. Check if handle_new_user function exists and is callable
SELECT 'Function Status:' as step;
SELECT 
    proname as function_name,
    proowner,
    proacl as permissions
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 3. Check recent auth.users entries (to see if signup is working)
SELECT 'Recent Auth Users (last 5):' as step;
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Check recent profiles entries
SELECT 'Recent Profiles (last 5):' as step;
SELECT 
    id,
    first_name,
    last_name,
    home_zip_code,
    role,
    account_type,
    created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Check RLS policies on profiles table
SELECT 'RLS Policies:' as step;
SELECT 
    policyname,
    cmd,
    roles,
    permissive
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;