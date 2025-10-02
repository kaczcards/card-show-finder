-- Check Current Registration Status
-- Run this to see what's already in place

-- Check current RLS policies on profiles table
SELECT 'Current RLS Policies:' as status;
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;

-- Check if auth trigger exists
SELECT 'Auth Trigger Status:' as status;
SELECT 
    tgname,
    tgrelid::regclass,
    tgfoid::regproc
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Check if RLS is enabled
SELECT 'RLS Status:' as status;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';