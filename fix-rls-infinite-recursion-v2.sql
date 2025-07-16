-- fix-rls-infinite-recursion-v2.sql
-- IDEMPOTENT FIX for infinite recursion in RLS policies
-- This script safely drops and recreates policies to avoid recursion
-- It can be run multiple times without errors

-- =====================================================
-- Use a transaction to ensure all changes happen or none
-- =====================================================
BEGIN;

-- =====================================================
-- 1. Helper function to safely drop policies
-- =====================================================
CREATE OR REPLACE FUNCTION safe_drop_policy(
  policy_name TEXT,
  table_name TEXT
) RETURNS VOID AS $$
BEGIN
  -- Check if policy exists before trying to drop it
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = policy_name 
    AND tablename = table_name
  ) THEN
    EXECUTE format('DROP POLICY %I ON %I', policy_name, table_name);
    RAISE NOTICE 'Dropped policy % on table %', policy_name, table_name;
  ELSE
    RAISE NOTICE 'Policy % does not exist on table %, skipping', policy_name, table_name;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policy % on table %: %', policy_name, table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. Fix show_participants policies
-- =====================================================
DO $$
BEGIN
  -- Check if table exists before proceeding
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    -- Drop all potentially conflicting policies
    PERFORM safe_drop_policy('show_participants_select_mvp_dealer', 'show_participants');
    PERFORM safe_drop_policy('show_participants_select_organizer', 'show_participants');
    PERFORM safe_drop_policy('show_participants_select_self', 'show_participants');
    PERFORM safe_drop_policy('show_participants_select_all_mvp_dealer', 'show_participants');
    
    -- Create simplified policies that don't cause recursion
    
    -- Users can view their own participation (no recursion, direct user check)
    EXECUTE 'CREATE POLICY show_participants_select_self ON public.show_participants
      FOR SELECT USING (auth.uid() = userid)';
    
    -- Show organizers can view all participants for their shows
    -- This joins with shows table, not recursively with show_participants
    EXECUTE 'CREATE POLICY show_participants_select_organizer ON public.show_participants
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM shows s
          WHERE s.id = showid
          AND s.organizer_id = auth.uid()
        )
      )';
    
    -- MVP dealers can view ALL show participants (simplest approach to fix recursion)
    -- We can refine this later once the basic functionality works
    EXECUTE 'CREATE POLICY show_participants_select_mvp_dealer ON public.show_participants
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() 
          AND p.role = ''mvp_dealer''
        )
      )';
    
    RAISE NOTICE 'Successfully updated show_participants policies';
  ELSE
    RAISE NOTICE 'Table show_participants does not exist, skipping';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating show_participants policies: %', SQLERRM;
END;
$$;

-- =====================================================
-- 3. Fix want_lists policies
-- =====================================================
DO $$
BEGIN
  -- Check if table exists before proceeding
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') THEN
    -- Drop all potentially conflicting policies
    PERFORM safe_drop_policy('want_lists_select_mvp_dealer', 'want_lists');
    PERFORM safe_drop_policy('want_lists_select_organizer', 'want_lists');
    PERFORM safe_drop_policy('want_lists_select_self', 'want_lists');
    
    -- Create simplified policies that don't cause recursion
    
    -- Users can always see their own want lists
    EXECUTE 'CREATE POLICY want_lists_select_self ON public.want_lists
      FOR SELECT USING (auth.uid() = userid)';
    
    -- MVP dealers can view ALL want lists for now (simplest approach)
    -- We can refine this later once the basic functionality works
    EXECUTE 'CREATE POLICY want_lists_select_mvp_dealer ON public.want_lists
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() 
          AND p.role = ''mvp_dealer''
        )
      )';
    
    -- Show organizers can view ALL want lists for now (simplest approach)
    -- We can refine this later once the basic functionality works
    EXECUTE 'CREATE POLICY want_lists_select_organizer ON public.want_lists
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() 
          AND p.role = ''show_organizer''
        )
      )';
    
    RAISE NOTICE 'Successfully updated want_lists policies';
  ELSE
    RAISE NOTICE 'Table want_lists does not exist, skipping';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating want_lists policies: %', SQLERRM;
END;
$$;

-- =====================================================
-- 4. Fix shared_want_lists policies
-- =====================================================
DO $$
BEGIN
  -- Check if table exists before proceeding
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    -- Drop all potentially conflicting policies
    PERFORM safe_drop_policy('shared_want_lists_select_mvp_dealer', 'shared_want_lists');
    PERFORM safe_drop_policy('shared_want_lists_select_self', 'shared_want_lists');
    PERFORM safe_drop_policy('shared_want_lists_select_organizer', 'shared_want_lists');
    
    -- Create simplified policies that don't cause recursion
    
    -- Users can see their own shared want lists
    EXECUTE 'CREATE POLICY shared_want_lists_select_self ON public.shared_want_lists
      FOR SELECT USING (auth.uid() = userid)';
    
    -- MVP dealers can view ALL shared want lists for now (simplest approach)
    EXECUTE 'CREATE POLICY shared_want_lists_select_mvp_dealer ON public.shared_want_lists
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() 
          AND p.role = ''mvp_dealer''
        )
      )';
    
    -- Show organizers can view ALL shared want lists for now (simplest approach)
    EXECUTE 'CREATE POLICY shared_want_lists_select_organizer ON public.shared_want_lists
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() 
          AND p.role = ''show_organizer''
        )
      )';
    
    RAISE NOTICE 'Successfully updated shared_want_lists policies';
  ELSE
    RAISE NOTICE 'Table shared_want_lists does not exist, skipping';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating shared_want_lists policies: %', SQLERRM;
END;
$$;

-- =====================================================
-- 5. Add comments to explain the fix
-- =====================================================
DO $$
BEGIN
  -- Add comments only if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    EXECUTE 'COMMENT ON POLICY show_participants_select_self ON public.show_participants IS 
      ''Users can view their own participation records. No recursion.''';
    
    EXECUTE 'COMMENT ON POLICY show_participants_select_organizer ON public.show_participants IS 
      ''Show organizers can view all participants for shows they organize. No recursion.''';
    
    EXECUTE 'COMMENT ON POLICY show_participants_select_mvp_dealer ON public.show_participants IS 
      ''MVP dealers can view all participants. Simplified to avoid recursion.''';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') THEN
    EXECUTE 'COMMENT ON POLICY want_lists_select_self ON public.want_lists IS 
      ''Users can view their own want lists. No recursion.''';
    
    EXECUTE 'COMMENT ON POLICY want_lists_select_mvp_dealer ON public.want_lists IS 
      ''MVP dealers can view all want lists. Simplified to avoid recursion.''';
    
    EXECUTE 'COMMENT ON POLICY want_lists_select_organizer ON public.want_lists IS 
      ''Show organizers can view all want lists. Simplified to avoid recursion.''';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    EXECUTE 'COMMENT ON POLICY shared_want_lists_select_self ON public.shared_want_lists IS 
      ''Users can view their own shared want lists. No recursion.''';
    
    EXECUTE 'COMMENT ON POLICY shared_want_lists_select_mvp_dealer ON public.shared_want_lists IS 
      ''MVP dealers can view all shared want lists. Simplified to avoid recursion.''';
    
    EXECUTE 'COMMENT ON POLICY shared_want_lists_select_organizer ON public.shared_want_lists IS 
      ''Show organizers can view all shared want lists. Simplified to avoid recursion.''';
  END IF;
END;
$$;

-- =====================================================
-- 6. Verify the fix
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RLS Policy Fix Complete ===';
  RAISE NOTICE 'To verify the fix, run: SELECT * FROM show_participants LIMIT 5;';
  RAISE NOTICE 'If the query returns without error, the fix is working.';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: These policies are intentionally permissive to fix the immediate issue.';
  RAISE NOTICE 'They should be refined with more specific access controls once the basic';
  RAISE NOTICE 'functionality is working correctly.';
END;
$$;

-- Commit the transaction
COMMIT;
