-- ================================================================
-- FIX COLUMN NAMES IN CONSOLIDATED RLS POLICIES
-- ================================================================
-- This script fixes column name inconsistencies in the consolidated RLS policies.
-- The database schema uses different naming conventions across tables:
--   - Some tables use 'userid' (no underscore)
--   - Others might use 'user_id' (with underscore)
--
-- Run this script BEFORE running the consolidated-rls-policies.sql
-- to ensure all column references match the actual database schema.
-- ================================================================

-- Start a transaction to ensure all changes are atomic
BEGIN;

-- ================================================================
-- SECTION 1: IDENTIFY ACTUAL TABLE SCHEMAS
-- ================================================================

-- Output the current column names for key tables to verify
SELECT 
  table_name,
  column_name
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' AND
  table_name IN ('want_lists', 'shared_want_lists', 'show_participants', 'user_favorite_shows')
ORDER BY 
  table_name, column_name;

-- ================================================================
-- SECTION 2: CREATE TEMPORARY COPY OF CONSOLIDATED POLICIES
-- ================================================================

-- Create a temporary table to store a copy of the consolidated RLS policies
-- with corrected column names
CREATE TEMPORARY TABLE IF NOT EXISTS fixed_rls_policies (
  policy_name TEXT,
  table_name TEXT,
  operation TEXT,
  using_clause TEXT,
  with_check_clause TEXT
);

-- ================================================================
-- SECTION 3: COLUMN NAME MAPPING FUNCTION
-- ================================================================

-- Create a function to fix column names in policy definitions
CREATE OR REPLACE FUNCTION fix_column_names(policy_text TEXT)
RETURNS TEXT AS $$
DECLARE
  fixed_text TEXT;
BEGIN
  fixed_text := policy_text;
  
  -- Fix want_lists table column references
  IF fixed_text LIKE '%want_lists%' THEN
    fixed_text := REPLACE(fixed_text, 'user_id = auth.uid()', 'userid = auth.uid()');
    fixed_text := REPLACE(fixed_text, 'want_lists.user_id', 'want_lists.userid');
  END IF;
  
  -- Fix shared_want_lists table column references
  IF fixed_text LIKE '%shared_want_lists%' THEN
    fixed_text := REPLACE(fixed_text, 'user_id = auth.uid()', 'userid = auth.uid()');
    fixed_text := REPLACE(fixed_text, 'shared_want_lists.user_id', 'shared_want_lists.userid');
    fixed_text := REPLACE(fixed_text, 'show_id', 'showid');
    fixed_text := REPLACE(fixed_text, 'want_list_id', 'wantlistid');
  END IF;
  
  -- Fix show_participants table column references
  IF fixed_text LIKE '%show_participants%' THEN
    fixed_text := REPLACE(fixed_text, 'user_id = auth.uid()', 'userid = auth.uid()');
    fixed_text := REPLACE(fixed_text, 'show_participants.user_id', 'show_participants.userid');
    fixed_text := REPLACE(fixed_text, 'show_id', 'showid');
  END IF;
  
  -- Fix user_favorite_shows table column references
  IF fixed_text LIKE '%user_favorite_shows%' THEN
    -- This table might actually use user_id, so we need to check
    -- Leave as is for now, but add logic here if needed
  END IF;
  
  -- Fix planned_attendance table column references
  IF fixed_text LIKE '%planned_attendance%' THEN
    fixed_text := REPLACE(fixed_text, 'user_id = auth.uid()', 'userid = auth.uid()');
    fixed_text := REPLACE(fixed_text, 'planned_attendance.user_id', 'planned_attendance.userid');
    fixed_text := REPLACE(fixed_text, 'show_id', 'showid');
  END IF;
  
  -- Fix conversations table column references
  IF fixed_text LIKE '%conversations%' OR fixed_text LIKE '%conversation_participants%' THEN
    fixed_text := REPLACE(fixed_text, 'user_id = auth.uid()', 'userid = auth.uid()');
    fixed_text := REPLACE(fixed_text, 'conversation_participants.user_id', 'conversation_participants.userid');
  END IF;
  
  RETURN fixed_text;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 4: VERIFY COLUMN NAMING CONVENTIONS
-- ================================================================

-- Output a report of tables with inconsistent naming conventions
DO $$
DECLARE
  inconsistent_record RECORD;
BEGIN
  RAISE NOTICE '=== COLUMN NAMING CONVENTION REPORT ===';
  
  -- Check for tables with both underscore and non-underscore column names
  FOR inconsistent_record IN
    WITH column_styles AS (
      SELECT 
        table_name,
        SUM(CASE WHEN column_name LIKE '%\_%' THEN 1 ELSE 0 END) AS underscore_columns,
        SUM(CASE WHEN column_name NOT LIKE '%\_%' AND LENGTH(column_name) > 3 THEN 1 ELSE 0 END) AS no_underscore_columns
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      HAVING 
        SUM(CASE WHEN column_name LIKE '%\_%' THEN 1 ELSE 0 END) > 0 AND
        SUM(CASE WHEN column_name NOT LIKE '%\_%' AND LENGTH(column_name) > 3 THEN 1 ELSE 0 END) > 0
    )
    SELECT 
      cs.table_name,
      cs.underscore_columns,
      cs.no_underscore_columns,
      STRING_AGG(c.column_name, ', ') AS sample_columns
    FROM column_styles cs
    JOIN information_schema.columns c ON cs.table_name = c.table_name
    WHERE c.table_schema = 'public'
    GROUP BY cs.table_name, cs.underscore_columns, cs.no_underscore_columns
    ORDER BY cs.table_name
  LOOP
    RAISE NOTICE 'Table % has inconsistent naming: % columns with underscores, % without', 
      inconsistent_record.table_name,
      inconsistent_record.underscore_columns,
      inconsistent_record.no_underscore_columns;
    RAISE NOTICE '  Sample columns: %', inconsistent_record.sample_columns;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'This report helps identify tables with mixed naming conventions.';
  RAISE NOTICE 'The fix_column_names() function will handle these inconsistencies.';
END;
$$;

-- ================================================================
-- SECTION 5: GENERATE FIXED POLICY STATEMENTS
-- ================================================================

-- Generate SQL statements with corrected column names
DO $$
BEGIN
  RAISE NOTICE '=== COLUMN NAME FIXES FOR CONSOLIDATED RLS POLICIES ===';
  RAISE NOTICE '';
  
  -- want_lists table
  RAISE NOTICE 'Fix for want_lists table:';
  RAISE NOTICE 'REPLACE: user_id = auth.uid()';
  RAISE NOTICE 'WITH:    userid = auth.uid()';
  RAISE NOTICE '';
  
  -- shared_want_lists table
  RAISE NOTICE 'Fix for shared_want_lists table:';
  RAISE NOTICE 'REPLACE: user_id = auth.uid()';
  RAISE NOTICE 'WITH:    userid = auth.uid()';
  RAISE NOTICE 'REPLACE: show_id';
  RAISE NOTICE 'WITH:    showid';
  RAISE NOTICE '';
  
  -- show_participants table
  RAISE NOTICE 'Fix for show_participants table:';
  RAISE NOTICE 'REPLACE: user_id = auth.uid()';
  RAISE NOTICE 'WITH:    userid = auth.uid()';
  RAISE NOTICE 'REPLACE: show_id';
  RAISE NOTICE 'WITH:    showid';
  RAISE NOTICE '';
  
  -- planned_attendance table
  RAISE NOTICE 'Fix for planned_attendance table:';
  RAISE NOTICE 'REPLACE: user_id = auth.uid()';
  RAISE NOTICE 'WITH:    userid = auth.uid()';
  RAISE NOTICE 'REPLACE: show_id';
  RAISE NOTICE 'WITH:    showid';
  RAISE NOTICE '';
  
  RAISE NOTICE 'These fixes will be applied when you run the consolidated-rls-policies.sql script.';
  RAISE NOTICE 'Make sure to update the script with these column name corrections.';
END;
$$;

-- ================================================================
-- SECTION 6: SAMPLE POLICY FIXES
-- ================================================================

-- Output sample fixed policy statements
SELECT 
  'Original: ' || E'\n' || 
  'CREATE POLICY "want_lists_select_self" ON want_lists FOR SELECT USING (user_id = auth.uid());' || E'\n\n' ||
  'Fixed: ' || E'\n' ||
  'CREATE POLICY "want_lists_select_self" ON want_lists FOR SELECT USING (userid = auth.uid());' 
AS "Sample Policy Fix";

SELECT 
  'Original: ' || E'\n' || 
  'CREATE POLICY "shared_want_lists_select_self" ON shared_want_lists FOR SELECT USING (user_id = auth.uid());' || E'\n\n' ||
  'Fixed: ' || E'\n' ||
  'CREATE POLICY "shared_want_lists_select_self" ON shared_want_lists FOR SELECT USING (userid = auth.uid());' 
AS "Sample Policy Fix";

-- ================================================================
-- SECTION 7: NEXT STEPS
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '
=== NEXT STEPS ===

1. Edit the consolidated-rls-policies.sql file to fix column names:
   - Replace "user_id" with "userid" for want_lists, shared_want_lists, show_participants tables
   - Replace "show_id" with "showid" where applicable
   - Replace "want_list_id" with "wantlistid" where applicable

2. Run the updated consolidated-rls-policies.sql script

3. Run verify-rls-policies.sql to confirm all policies are correctly applied
';
END;
$$;

-- Commit the transaction
COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'COLUMN NAME ANALYSIS COMPLETE';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Please update the consolidated-rls-policies.sql file with the correct column names.';
  RAISE NOTICE 'The main issues are:';
  RAISE NOTICE '  - "user_id" should be "userid"';
  RAISE NOTICE '  - "show_id" should be "showid"';
  RAISE NOTICE '  - "want_list_id" should be "wantlistid"';
  RAISE NOTICE '=======================================================';
END;
$$;
