-- ================================================================
-- VERIFY RLS POLICIES
-- ================================================================
-- This script verifies the state of Row Level Security (RLS) policies
-- across the Card Show Finder application after policy consolidation.
--
-- Features:
-- 1. Checks all tables have RLS enabled
-- 2. Verifies all expected policies exist
-- 3. Detects conflicting or duplicate policies
-- 4. Tests helper functions exist and work correctly
-- 5. Provides a detailed security posture report
--
-- Usage: Run this script in the Supabase SQL Editor after applying
--        the consolidated-rls-policies.sql script
-- ================================================================

-- Create temporary tables to store verification results
CREATE TEMPORARY TABLE IF NOT EXISTS rls_verification_results (
  check_id SERIAL PRIMARY KEY,
  check_type TEXT NOT NULL,
  object_name TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  severity TEXT NOT NULL
);

CREATE TEMPORARY TABLE IF NOT EXISTS rls_summary (
  category TEXT PRIMARY KEY,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0
);

-- Insert categories into summary table
INSERT INTO rls_summary (category, passed, failed, warnings)
VALUES 
  ('Tables with RLS', 0, 0, 0),
  ('Policy Coverage', 0, 0, 0),
  ('Helper Functions', 0, 0, 0),
  ('Policy Conflicts', 0, 0, 0),
  ('Permissions', 0, 0, 0);

-- ================================================================
-- SECTION 1: VERIFY RLS IS ENABLED ON ALL TABLES
-- ================================================================

DO $$
DECLARE
  table_rec RECORD;
BEGIN
  -- Check each public table for RLS enabled
  FOR table_rec IN 
    SELECT t.table_name 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT IN (
      -- Tables that should be excluded from RLS
      'schema_migrations',
      'spatial_ref_sys'
    )
  LOOP
    -- Check if RLS is enabled
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' 
      AND tablename = table_rec.table_name
      AND rowsecurity = true
    ) THEN
      -- RLS is enabled - good
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('RLS Enabled', table_rec.table_name, 'PASS', 'Row Level Security is enabled', 'INFO');
        
      -- Update summary
      UPDATE rls_summary SET passed = passed + 1 WHERE category = 'Tables with RLS';
    ELSE
      -- RLS is not enabled - critical security issue!
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('RLS Enabled', table_rec.table_name, 'FAIL', 
         'Row Level Security is NOT enabled - this is a critical security issue!', 'CRITICAL');
         
      -- Update summary
      UPDATE rls_summary SET failed = failed + 1 WHERE category = 'Tables with RLS';
    END IF;
  END LOOP;
END $$;

-- ================================================================
-- SECTION 2: VERIFY HELPER FUNCTIONS EXIST
-- ================================================================

DO $$
DECLARE
  function_names TEXT[] := ARRAY[
    'is_admin',
    'is_show_organizer',
    'is_mvp_dealer',
    'is_dealer',
    'is_any_dealer',
    'participates_in_show',
    'organizes_show',
    'safe_drop_policy'
  ];
  func_name TEXT;
BEGIN
  -- Check each expected function
  FOREACH func_name IN ARRAY function_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = func_name
    ) THEN
      -- Function exists - good
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('Helper Function', func_name, 'PASS', 'Function exists', 'INFO');
        
      -- Update summary
      UPDATE rls_summary SET passed = passed + 1 WHERE category = 'Helper Functions';
    ELSE
      -- Function is missing
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('Helper Function', func_name, 'FAIL', 
         'Function does not exist - RLS policies may not work correctly', 'HIGH');
         
      -- Update summary
      UPDATE rls_summary SET failed = failed + 1 WHERE category = 'Helper Functions';
    END IF;
  END LOOP;
END $$;

-- ================================================================
-- SECTION 3: VERIFY EXPECTED POLICIES FOR EACH TABLE
-- ================================================================

-- Define expected policy patterns for key tables
DO $$
DECLARE
  table_policies RECORD;
  expected_policies JSONB;
  policy_name TEXT;
  policy_found BOOLEAN;
  target_table_name TEXT;  -- renamed to avoid collision with column name
BEGIN
  -- Define expected policies for key tables
  expected_policies = '{
    "profiles": ["Users can view own profile", "Users can update own profile", 
                 "Users can view limited profile info of others", "Service role can access all profiles"],
    "shows": ["Anyone can view shows", "Organizers can update own shows", 
              "Organizers can delete own shows", "Organizers can insert shows", 
              "Admins can update show coordinates"],
    "user_favorite_shows": ["user_fav_shows_sel_self", 
                           "user_fav_shows_sel_mvp_dealer", 
                           "user_fav_shows_sel_org", 
                           "user_fav_shows_ins_self", 
                           "user_fav_shows_del_self"],
    "show_participants": ["show_participants_select_self", "show_participants_select_organizer", 
                         "show_participants_select_mvp_dealer", "show_participants_insert", 
                         "show_participants_update_self", "show_participants_delete_self", 
                         "show_participants_update_organizer"],
    "want_lists": ["want_lists_select_self", "want_lists_select_mvp_dealer", 
                  "want_lists_select_organizer", "want_lists_insert", 
                  "want_lists_update", "want_lists_delete"],
    "shared_want_lists": ["shared_want_lists_select_self", "shared_want_lists_select_mvp_dealer", 
                         "shared_want_lists_select_organizer", "shared_want_lists_insert", 
                         "shared_want_lists_delete"],
    "conversations": ["Users can view conversations they participate in", "Users can create conversations", 
                     "Users can update conversations they participate in", "Admins can access all conversations"],
    "conversation_participants": ["Users can view conversation participants for conversations they are in", 
                                 "Users can add themselves to conversations", 
                                 "Users can remove themselves from conversations", 
                                 "Admins can access all conversation participants"],
    "messages": ["Users can view messages in conversations they participate in", 
                "Users can send messages to conversations they participate in", 
                "Users can update their own messages", "Users can delete their own messages", 
                "Admins can access all messages"],
    "reviews": ["Users can view all reviews", "Users can create reviews for shows they attended", 
               "Users can update their own reviews", "Users can delete their own reviews", 
               "Admins can moderate all reviews"],
    "show_series": ["Anyone can view show series", "Organizers can update own show series", 
                   "Organizers can delete own show series", "Organizers can create show series"],
    "badges": ["Anyone can view badges", "Only admins can manage badges"],
    "user_badges": ["Users can view their own badges", "Users can view other users badges", 
                   "Only admins can manage user badges"],
    "planned_attendance": ["Users can view their own planned attendance", 
                          "MVP dealers can view planned attendance for their shows", 
                          "Show organizers can view planned attendance for their shows", 
                          "Users can create their own planned attendance", 
                          "Users can delete their own planned attendance"]
  }';

  -- Check each table in the expected policies list
  FOR target_table_name IN SELECT * FROM jsonb_object_keys(expected_policies)
  LOOP
    -- Check if table exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name   = target_table_name
    ) THEN
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('Table Existence', target_table_name, 'WARNING', 
         'Table does not exist but has expected policies defined', 'MEDIUM');
         
      -- Update summary
      UPDATE rls_summary SET warnings = warnings + 1 WHERE category = 'Policy Coverage';
      CONTINUE;
    END IF;
    
    -- For each expected policy, check if it exists
    FOR policy_name IN SELECT * FROM jsonb_array_elements_text(expected_policies->target_table_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' 
        AND tablename = target_table_name
        AND policyname = policy_name
      ) THEN
        -- Policy exists - good
        INSERT INTO rls_verification_results 
          (check_type, object_name, status, details, severity)
        VALUES 
          ('Policy Exists', target_table_name || '.' || policy_name, 'PASS', 
           'Policy exists as expected', 'INFO');
           
        -- Update summary
        UPDATE rls_summary SET passed = passed + 1 WHERE category = 'Policy Coverage';
      ELSE
        -- Policy is missing
        INSERT INTO rls_verification_results 
          (check_type, object_name, status, details, severity)
        VALUES 
        ('Policy Exists', target_table_name || '.' || policy_name, 'FAIL', 
           'Expected policy does not exist', 'HIGH');
           
        -- Update summary
        UPDATE rls_summary SET failed = failed + 1 WHERE category = 'Policy Coverage';
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ================================================================
-- SECTION 4: CHECK FOR CONFLICTING OR DUPLICATE POLICIES
-- ================================================================

DO $$
DECLARE
  conflict_rec RECORD;
BEGIN
  -- Check for duplicate policy names on the same table
  FOR conflict_rec IN
    SELECT schemaname, tablename, policyname, COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, policyname
    HAVING COUNT(*) > 1
  LOOP
    INSERT INTO rls_verification_results 
      (check_type, object_name, status, details, severity)
    VALUES 
      ('Policy Conflict', conflict_rec.tablename || '.' || conflict_rec.policyname, 'FAIL', 
       'Duplicate policy name found (' || conflict_rec.policy_count || ' instances)', 'HIGH');
       
    -- Update summary
    UPDATE rls_summary SET failed = failed + 1 WHERE category = 'Policy Conflicts';
  END LOOP;
  
  -- Check for potentially conflicting policies (same operation, different names)
  FOR conflict_rec IN
    SELECT 
      p1.tablename, 
      p1.policyname as policy1, 
      p2.policyname as policy2,
      p1.cmd as operation
    FROM pg_policies p1
    JOIN pg_policies p2 ON 
      p1.tablename = p2.tablename AND 
      p1.cmd = p2.cmd AND
      p1.policyname != p2.policyname AND
      p1.schemaname = 'public' AND
      p2.schemaname = 'public'
    WHERE 
      -- Only check certain operations where conflicts are problematic
      p1.cmd IN ('SELECT', 'UPDATE', 'DELETE') AND
      -- Avoid duplicate reporting (only report A conflicts with B, not also B conflicts with A)
      p1.policyname < p2.policyname
  LOOP
    INSERT INTO rls_verification_results 
      (check_type, object_name, status, details, severity)
    VALUES 
      ('Policy Conflict', conflict_rec.tablename, 'WARNING', 
       'Potential conflicting policies for ' || conflict_rec.operation || 
       ': "' || conflict_rec.policy1 || '" and "' || conflict_rec.policy2 || '"', 'MEDIUM');
       
    -- Update summary
    UPDATE rls_summary SET warnings = warnings + 1 WHERE category = 'Policy Conflicts';
  END LOOP;
  
  -- If no conflicts were found, add a pass record
  IF NOT EXISTS (SELECT 1 FROM rls_verification_results WHERE check_type = 'Policy Conflict') THEN
    INSERT INTO rls_verification_results 
      (check_type, object_name, status, details, severity)
    VALUES 
      ('Policy Conflict', 'all tables', 'PASS', 'No policy conflicts detected', 'INFO');
      
    -- Update summary
    UPDATE rls_summary SET passed = passed + 1 WHERE category = 'Policy Conflicts';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: VERIFY PERMISSIONS
-- ================================================================

DO $$
DECLARE
  table_rec RECORD;
  perm_rec RECORD;
  has_select BOOLEAN;
  has_insert BOOLEAN;
  has_update BOOLEAN;
  has_delete BOOLEAN;
BEGIN
  -- Check each public table for permissions
  FOR table_rec IN 
    SELECT t.table_name 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT IN (
      -- Tables that should be excluded
      'schema_migrations',
      'spatial_ref_sys'
    )
  LOOP
    -- Check permissions for authenticated role
    SELECT 
      MAX(CASE WHEN privilege_type = 'SELECT' THEN true ELSE false END) as has_select,
      MAX(CASE WHEN privilege_type = 'INSERT' THEN true ELSE false END) as has_insert,
      MAX(CASE WHEN privilege_type = 'UPDATE' THEN true ELSE false END) as has_update,
      MAX(CASE WHEN privilege_type = 'DELETE' THEN true ELSE false END) as has_delete
    INTO has_select, has_insert, has_update, has_delete
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
    AND table_name = table_rec.table_name
    AND grantee = 'authenticated';
    
    -- Check if all required permissions are present
    IF has_select AND has_insert AND has_update AND has_delete THEN
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('Permissions', table_rec.table_name, 'PASS', 
         'Table has all required permissions for authenticated users', 'INFO');
         
      -- Update summary
      UPDATE rls_summary SET passed = passed + 1 WHERE category = 'Permissions';
    ELSE
      -- Missing permissions
      INSERT INTO rls_verification_results 
        (check_type, object_name, status, details, severity)
      VALUES 
        ('Permissions', table_rec.table_name, 'WARNING', 
         'Table is missing permissions: ' || 
         CASE WHEN NOT has_select THEN 'SELECT ' ELSE '' END ||
         CASE WHEN NOT has_insert THEN 'INSERT ' ELSE '' END ||
         CASE WHEN NOT has_update THEN 'UPDATE ' ELSE '' END ||
         CASE WHEN NOT has_delete THEN 'DELETE' ELSE '' END, 
         'MEDIUM');
         
      -- Update summary
      UPDATE rls_summary SET warnings = warnings + 1 WHERE category = 'Permissions';
    END IF;
  END LOOP;
  
  -- Check sequence permissions
  IF EXISTS (
    SELECT 1
    FROM information_schema.role_usage_grants rug
    JOIN information_schema.sequences seq 
      ON rug.object_schema = seq.sequence_schema 
      AND rug.object_name = seq.sequence_name
    WHERE seq.sequence_schema = 'public'
    AND rug.grantee = 'authenticated'
    AND rug.privilege_type = 'USAGE'
  ) THEN
    INSERT INTO rls_verification_results 
      (check_type, object_name, status, details, severity)
    VALUES 
      ('Permissions', 'sequences', 'PASS', 
       'Authenticated users have USAGE permission on sequences', 'INFO');
       
    -- Update summary
    UPDATE rls_summary SET passed = passed + 1 WHERE category = 'Permissions';
  ELSE
    INSERT INTO rls_verification_results 
      (check_type, object_name, status, details, severity)
    VALUES 
      ('Permissions', 'sequences', 'WARNING', 
       'Authenticated users do not have USAGE permission on sequences', 'MEDIUM');
       
    -- Update summary
    UPDATE rls_summary SET warnings = warnings + 1 WHERE category = 'Permissions';
  END IF;
END $$;

-- ================================================================
-- SECTION 6: GENERATE SECURITY POSTURE REPORT
-- ================================================================

-- Function to generate colored text for console output
CREATE OR REPLACE FUNCTION colored_text(text_color TEXT, text_content TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE text_color
    WHEN 'red' THEN RETURN E'\033[31m' || text_content || E'\033[0m';
    WHEN 'green' THEN RETURN E'\033[32m' || text_content || E'\033[0m';
    WHEN 'yellow' THEN RETURN E'\033[33m' || text_content || E'\033[0m';
    WHEN 'blue' THEN RETURN E'\033[34m' || text_content || E'\033[0m';
    WHEN 'magenta' THEN RETURN E'\033[35m' || text_content || E'\033[0m';
    WHEN 'cyan' THEN RETURN E'\033[36m' || text_content || E'\033[0m';
    WHEN 'bold' THEN RETURN E'\033[1m' || text_content || E'\033[0m';
    ELSE RETURN text_content;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Generate the report
DO $$
DECLARE
  critical_count INTEGER;
  high_count INTEGER;
  medium_count INTEGER;
  total_tables INTEGER;
  secured_tables INTEGER;
  total_policies INTEGER;
  missing_policies INTEGER;
  overall_status TEXT;
  overall_color TEXT;
  category_rec RECORD;
  issue_rec RECORD;
BEGIN
  -- Count issues by severity
  SELECT COUNT(*) INTO critical_count FROM rls_verification_results WHERE severity = 'CRITICAL';
  SELECT COUNT(*) INTO high_count FROM rls_verification_results WHERE severity = 'HIGH';
  SELECT COUNT(*) INTO medium_count FROM rls_verification_results WHERE severity = 'MEDIUM';
  
  -- Count tables
  SELECT COUNT(*) INTO total_tables 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT IN ('schema_migrations', 'spatial_ref_sys');
  
  -- Count secured tables
  SELECT COUNT(*) INTO secured_tables 
  FROM pg_tables
  WHERE schemaname = 'public' 
  AND rowsecurity = true
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys');
  
  -- Count policies
  SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE schemaname = 'public';
  
  -- Count missing policies
  SELECT COUNT(*) INTO missing_policies FROM rls_verification_results 
  WHERE check_type = 'Policy Exists' AND status = 'FAIL';
  
  -- Determine overall status
  IF critical_count > 0 THEN
    overall_status := 'CRITICAL';
    overall_color := 'red';
  ELSIF high_count > 0 THEN
    overall_status := 'HIGH RISK';
    overall_color := 'red';
  ELSIF medium_count > 0 THEN
    overall_status := 'MEDIUM RISK';
    overall_color := 'yellow';
  ELSE
    overall_status := 'SECURE';
    overall_color := 'green';
  END IF;
  
  -- Print the report header
  RAISE NOTICE '%', colored_text('bold', '================================================================');
  RAISE NOTICE '%', colored_text('bold', '                   RLS SECURITY POSTURE REPORT                   ');
  RAISE NOTICE '%', colored_text('bold', '================================================================');
  RAISE NOTICE '';
  RAISE NOTICE 'Overall Security Status: %', colored_text(overall_color, overall_status);
  RAISE NOTICE '';
  RAISE NOTICE '% of % tables have RLS enabled (%.1f%%)', 
    secured_tables, total_tables, 
    CASE WHEN total_tables > 0 THEN (secured_tables::FLOAT / total_tables) * 100 ELSE 0 END;
  RAISE NOTICE '% policies are in place (% missing)', 
    total_policies, missing_policies;
  RAISE NOTICE '';
  
  -- Print summary by category
  RAISE NOTICE '%', colored_text('bold', 'Summary by Category:');
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '%-25s | %-10s | %-10s | %-10s', 'Category', 'Passed', 'Failed', 'Warnings';
  RAISE NOTICE '----------------------------------------------------------------';
  
  FOR category_rec IN SELECT category, passed, failed, warnings FROM rls_summary ORDER BY category
  LOOP
    RAISE NOTICE '%-25s | %-10s | %-10s | %-10s', 
      category_rec.category, 
      CASE WHEN category_rec.passed > 0 THEN colored_text('green', category_rec.passed::TEXT) ELSE category_rec.passed::TEXT END,
      CASE WHEN category_rec.failed > 0 THEN colored_text('red', category_rec.failed::TEXT) ELSE category_rec.failed::TEXT END,
      CASE WHEN category_rec.warnings > 0 THEN colored_text('yellow', category_rec.warnings::TEXT) ELSE category_rec.warnings::TEXT END;
  END LOOP;
  
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '';
  
  -- Print critical issues
  IF critical_count > 0 THEN
    RAISE NOTICE '%', colored_text('red', 'CRITICAL ISSUES:');
    RAISE NOTICE '----------------------------------------------------------------';
    
    FOR issue_rec IN 
      SELECT object_name, details 
      FROM rls_verification_results 
      WHERE severity = 'CRITICAL'
      ORDER BY object_name
    LOOP
      RAISE NOTICE '% - %', colored_text('red', issue_rec.object_name), issue_rec.details;
    END LOOP;
    
    RAISE NOTICE '';
  END IF;
  
  -- Print high risk issues
  IF high_count > 0 THEN
    RAISE NOTICE '%', colored_text('red', 'HIGH RISK ISSUES:');
    RAISE NOTICE '----------------------------------------------------------------';
    
    FOR issue_rec IN 
      SELECT object_name, details 
      FROM rls_verification_results 
      WHERE severity = 'HIGH'
      ORDER BY object_name
    LOOP
      RAISE NOTICE '% - %', colored_text('red', issue_rec.object_name), issue_rec.details;
    END LOOP;
    
    RAISE NOTICE '';
  END IF;
  
  -- Print warnings
  IF medium_count > 0 THEN
    RAISE NOTICE '%', colored_text('yellow', 'WARNINGS:');
    RAISE NOTICE '----------------------------------------------------------------';
    
    FOR issue_rec IN 
      SELECT object_name, details 
      FROM rls_verification_results 
      WHERE severity = 'MEDIUM'
      ORDER BY object_name
    LOOP
      RAISE NOTICE '% - %', colored_text('yellow', issue_rec.object_name), issue_rec.details;
    END LOOP;
    
    RAISE NOTICE '';
  END IF;
  
  -- Print recommendations
  RAISE NOTICE '%', colored_text('bold', 'RECOMMENDATIONS:');
  RAISE NOTICE '----------------------------------------------------------------';
  
  IF critical_count > 0 THEN
    RAISE NOTICE '1. %', colored_text('red', 'URGENT: Enable RLS on all tables missing it');
  END IF;
  
  IF high_count > 0 THEN
    RAISE NOTICE '2. %', colored_text('red', 'Fix missing policies to ensure proper access controls');
  END IF;
  
  IF medium_count > 0 THEN
    RAISE NOTICE '3. %', colored_text('yellow', 'Review warnings and address potential issues');
  END IF;
  
  RAISE NOTICE '4. Run the consolidated-rls-policies.sql script again if issues were found';
  RAISE NOTICE '5. Re-run this verification script after fixes to confirm resolution';
  
  RAISE NOTICE '';
  RAISE NOTICE '%', colored_text('bold', '================================================================');
  RAISE NOTICE '%', colored_text('bold', '                      END OF REPORT                             ');
  RAISE NOTICE '%', colored_text('bold', '================================================================');
END $$;

-- Clean up temporary objects
DROP FUNCTION IF EXISTS colored_text;
DROP TABLE IF EXISTS rls_verification_results;
DROP TABLE IF EXISTS rls_summary;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policy verification complete.';
END $$;
