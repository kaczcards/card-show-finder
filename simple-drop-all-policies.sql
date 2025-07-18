-- ================================================================
-- SIMPLE DROP ALL RLS POLICIES
-- ================================================================
-- This is a simplified script to drop ALL existing RLS policies.
-- It uses basic SQL statements and avoids complex PL/pgSQL constructs
-- that might cause syntax errors.
--
-- Use this as a fallback if the more complex script has issues.
-- ================================================================

-- Start a transaction to ensure all changes are atomic
BEGIN;

-- Display a notice that we're starting
SELECT 'STARTING RLS POLICY CLEANUP - SIMPLE VERSION' AS "Notice";

-- ================================================================
-- SECTION 1: DROP ALL PUBLIC SCHEMA POLICIES
-- ================================================================

-- This approach uses a simple SELECT statement to generate the DROP statements
-- and outputs them as query results that you can copy and execute manually
-- if automatic execution fails

-- Generate DROP statements for all policies in public schema
SELECT 
  format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, tablename) AS drop_statement
FROM 
  pg_policies
WHERE 
  schemaname = 'public'
ORDER BY 
  tablename, policyname;

-- Execute the generated DROP statements directly
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ================================================================
-- SECTION 2: DROP ALL STORAGE SCHEMA POLICIES
-- ================================================================

-- Generate DROP statements for all policies in storage schema
SELECT 
  format('DROP POLICY IF EXISTS %I ON storage.%I;', policyname, tablename) AS drop_statement
FROM 
  pg_policies
WHERE 
  schemaname = 'storage'
ORDER BY 
  tablename, policyname;

-- Execute the generated DROP statements directly
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ================================================================
-- SECTION 3: MANUAL FALLBACK (IF ABOVE FAILS)
-- ================================================================

-- If the DO blocks above fail, you can manually execute these statements
-- by copying them from the query results and running them one by one

-- Count remaining policies to verify
SELECT 
  schemaname, 
  COUNT(*) AS remaining_policies
FROM 
  pg_policies
WHERE 
  schemaname IN ('public', 'storage')
GROUP BY 
  schemaname;

-- ================================================================
-- SECTION 4: NEXT STEPS
-- ================================================================

-- Display next steps
SELECT 'RLS POLICY CLEANUP COMPLETE - NOW RUN consolidated-rls-policies.sql' AS "Next Steps";

-- Commit the transaction
COMMIT;
