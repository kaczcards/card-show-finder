-- ================================================================
-- setup-database-functions.sql
-- ================================================================
-- Sets up essential database functions required for Card Show Finder
-- application, particularly those needed by RLS policy scripts.
--
-- This script creates helper functions that are prerequisites for
-- running the consolidated RLS policies and verification scripts.
--
-- Usage:
--   Run this script BEFORE applying RLS policies to ensure all
--   required database functions are available.
--
-- Features:
--   1. Creates exec_sql() function for controlled SQL execution
--   2. Sets proper security context and permissions
--   3. Includes comprehensive error handling
--   4. Idempotent (safe to run multiple times)
--   5. Properly documented for maintenance
-- ================================================================

-- Use a transaction to ensure all changes are atomic
BEGIN;

-- ================================================================
-- SECTION 1: UTILITY FUNCTIONS
-- ================================================================

-- Function: exec_sql
-- Purpose: Executes arbitrary SQL statements with proper error handling
-- Returns: JSONB with success/error information
-- Security: SECURITY DEFINER (runs with owner privileges)
-- ================================================================
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  notice_text TEXT;
  notices TEXT[] := '{}'::TEXT[];
BEGIN
  -- Log execution attempt (can be removed in production)
  RAISE NOTICE 'Executing SQL: %', left(sql_query, 50) || '...';
  
  -- Execute the SQL query
  EXECUTE sql_query;
  
  -- Return success result with any notices
  result := jsonb_build_object(
    'success', true,
    'notices', notices
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return error information
  result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
  
  -- Log the error (can be removed in production)
  RAISE WARNING 'exec_sql error: %', SQLERRM;
  
  RETURN result;
END;
$$;

-- Add function description
COMMENT ON FUNCTION public.exec_sql(TEXT) IS 
  'Executes arbitrary SQL with proper error handling. Used by RLS scripts and migrations.';

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- ================================================================
-- SECTION 2: ROLE CHECKING FUNCTIONS
-- ================================================================

-- Function: is_admin
-- Purpose: Checks if the current user has admin role
-- Returns: BOOLEAN
-- ================================================================
DROP FUNCTION IF EXISTS public.is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS 
  'Checks if the current user has admin role';

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ================================================================
-- SECTION 3: VERIFICATION
-- ================================================================

-- Verify functions were created successfully
DO $$
BEGIN
  -- Check if exec_sql function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'exec_sql' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'exec_sql function created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create exec_sql function';
  END IF;
  
  -- Check if is_admin function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'is_admin function created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create is_admin function';
  END IF;
END $$;

COMMIT;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE 'Database functions setup completed successfully';
END $$;
