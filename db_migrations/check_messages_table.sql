-- Simple SQL script to check the messages table setup
-- Run this in the Supabase SQL Editor

-- 1. Check if the messages table exists
SELECT 'Table Existence Check:' AS check_type, 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'messages'
    ) 
    THEN 'Messages table exists' 
    ELSE 'Messages table does NOT exist' 
  END AS result;

-- 2. List all columns in the messages table
SELECT 'Table Columns:' AS info_type, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- 3. Check if RLS is enabled on the messages table
SELECT 'RLS Status:' AS check_type,
  CASE 
    WHEN relrowsecurity = true 
    THEN 'RLS is enabled on messages table' 
    ELSE 'RLS is NOT enabled on messages table' 
  END AS result
FROM pg_class
WHERE relname = 'messages' 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 4. List all RLS policies on the messages table
SELECT 'RLS Policies:' AS info_type,
  policyname AS policy_name, 
  cmd AS operation, 
  permissive,
  roles,
  SUBSTRING(qual::text, 1, 50) AS using_condition,
  SUBSTRING(with_check::text, 1, 50) AS with_check_condition
FROM pg_policies
WHERE tablename = 'messages' 
  AND schemaname = 'public';

-- 5. Check permissions for authenticated users
SELECT 'Permissions:' AS info_type,
  grantee, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'messages'
  AND table_schema = 'public'
  AND grantee = 'authenticated'
ORDER BY privilege_type;

-- 6. Check if the get_user_conversations function exists
SELECT 'Function Check:' AS check_type,
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_proc
      WHERE proname = 'get_user_conversations'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) 
    THEN 'get_user_conversations function exists' 
    ELSE 'get_user_conversations function does NOT exist' 
  END AS result;
