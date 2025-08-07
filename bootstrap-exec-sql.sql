-- ================================================================
-- bootstrap-exec-sql.sql
-- ================================================================
-- Creates the exec_sql function required by RLS policy scripts
--
-- This function allows executing arbitrary SQL with proper error handling
-- and is a prerequisite for running the consolidated RLS policies and
-- verification scripts.
--
-- Run this script FIRST in the Supabase SQL Editor before attempting
-- to run any RLS policy scripts or verification.
-- ================================================================

-- Use a transaction to ensure atomic execution
BEGIN;

-- Drop the function if it already exists to ensure clean creation
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- Create the exec_sql function with proper error handling
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
-- SECURITY DEFINER means this function runs with the privileges of the user who created it
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  notice_text TEXT;
  notices TEXT[] := '{}'::TEXT[];
BEGIN
  -- Execute the provided SQL query
  EXECUTE sql_query;
  
  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'notices', notices
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return error information if the query fails
  result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission to service_role (required for RLS scripts)
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- Grant execute to authenticated users if needed by your application
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;

-- Add function description
COMMENT ON FUNCTION public.exec_sql(TEXT) IS 
  'Executes arbitrary SQL with proper error handling. Used by RLS scripts and migrations.';

-- Verify the function was created successfully
DO $$
BEGIN
  RAISE NOTICE 'exec_sql function created successfully';
END $$;

COMMIT;
