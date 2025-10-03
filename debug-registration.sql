-- Debug Registration Issue
-- Run this in Supabase SQL Editor to see the current state

-- Check if RLS is enabled on profiles table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- Check current RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;

-- Check if handle_new_user function exists
SELECT 
    proname,
    prosrc
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Check if trigger exists
SELECT 
    tgname,
    tgrelid::regclass,
    tgfoid::regproc
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Check profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check auth.users structure to see if we have raw_user_meta_data
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' 
AND table_name = 'users'
AND column_name LIKE '%meta%'
ORDER BY ordinal_position;