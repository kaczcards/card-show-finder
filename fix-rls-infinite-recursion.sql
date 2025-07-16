-- fix-rls-infinite-recursion.sql
-- Fix for infinite recursion in RLS policies for show_participants and related tables
-- This script drops problematic policies and creates new ones that avoid recursion

-- =====================================================
-- 1. Fix show_participants policies
-- =====================================================

-- Drop all problematic policies that cause recursion
DROP POLICY IF EXISTS show_participants_select_mvp_dealer ON public.show_participants;
DROP POLICY IF EXISTS show_participants_select_organizer ON public.show_participants;
DROP POLICY IF EXISTS show_participants_select_self ON public.show_participants;
DROP POLICY IF EXISTS show_participants_select_all_mvp_dealer ON public.show_participants;

-- Create simplified policies that don't cause recursion

-- Users can view their own participation (no recursion, direct user check)
CREATE POLICY show_participants_select_self ON public.show_participants
  FOR SELECT USING (auth.uid() = userid);

-- Show organizers can view all participants for their shows
-- This joins with shows table, not recursively with show_participants
CREATE POLICY show_participants_select_organizer ON public.show_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = showid
      AND s.organizer_id = auth.uid()
    )
  );

-- MVP dealers can view ALL show participants (simplest approach to fix recursion)
-- We can refine this later once the basic functionality works
CREATE POLICY show_participants_select_mvp_dealer ON public.show_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'mvp_dealer'
    )
  );

-- =====================================================
-- 2. Fix want_lists policies
-- =====================================================

-- Drop problematic policies
DROP POLICY IF EXISTS want_lists_select_mvp_dealer ON public.want_lists;
DROP POLICY IF EXISTS want_lists_select_organizer ON public.want_lists;

-- Create simplified policies that don't cause recursion

-- Users can always see their own want lists
CREATE POLICY want_lists_select_self ON public.want_lists
  FOR SELECT USING (auth.uid() = userid);

-- MVP dealers can view ALL want lists for now (simplest approach)
-- We can refine this later once the basic functionality works
CREATE POLICY want_lists_select_mvp_dealer ON public.want_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'mvp_dealer'
    )
  );

-- Show organizers can view ALL want lists for now (simplest approach)
-- We can refine this later once the basic functionality works
CREATE POLICY want_lists_select_organizer ON public.want_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'show_organizer'
    )
  );

-- =====================================================
-- 3. Fix shared_want_lists policies
-- =====================================================

-- Drop problematic policies
DROP POLICY IF EXISTS shared_want_lists_select_mvp_dealer ON public.shared_want_lists;
DROP POLICY IF EXISTS shared_want_lists_select_self ON public.shared_want_lists;
DROP POLICY IF EXISTS shared_want_lists_select_organizer ON public.shared_want_lists;

-- Create simplified policies that don't cause recursion

-- Users can see their own shared want lists
CREATE POLICY shared_want_lists_select_self ON public.shared_want_lists
  FOR SELECT USING (auth.uid() = userid);

-- MVP dealers can view ALL shared want lists for now (simplest approach)
CREATE POLICY shared_want_lists_select_mvp_dealer ON public.shared_want_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'mvp_dealer'
    )
  );

-- Show organizers can view ALL shared want lists for now (simplest approach)
CREATE POLICY shared_want_lists_select_organizer ON public.shared_want_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'show_organizer'
    )
  );

-- =====================================================
-- 4. Add comments to explain the fix
-- =====================================================

COMMENT ON POLICY show_participants_select_self ON public.show_participants IS 
  'Users can view their own participation records. No recursion.';

COMMENT ON POLICY show_participants_select_organizer ON public.show_participants IS 
  'Show organizers can view all participants for shows they organize. No recursion.';

COMMENT ON POLICY show_participants_select_mvp_dealer ON public.show_participants IS 
  'MVP dealers can view all participants. Simplified to avoid recursion.';

COMMENT ON POLICY want_lists_select_self ON public.want_lists IS 
  'Users can view their own want lists. No recursion.';

COMMENT ON POLICY want_lists_select_mvp_dealer ON public.want_lists IS 
  'MVP dealers can view all want lists. Simplified to avoid recursion.';

COMMENT ON POLICY want_lists_select_organizer ON public.want_lists IS 
  'Show organizers can view all want lists. Simplified to avoid recursion.';

COMMENT ON POLICY shared_want_lists_select_self ON public.shared_want_lists IS 
  'Users can view their own shared want lists. No recursion.';

COMMENT ON POLICY shared_want_lists_select_mvp_dealer ON public.shared_want_lists IS 
  'MVP dealers can view all shared want lists. Simplified to avoid recursion.';

COMMENT ON POLICY shared_want_lists_select_organizer ON public.shared_want_lists IS 
  'Show organizers can view all shared want lists. Simplified to avoid recursion.';

-- =====================================================
-- 5. Verify the fix
-- =====================================================

-- This is a comment to document how to verify the fix:
-- After applying this script, run the following query to check if the infinite recursion is resolved:
--
-- SELECT * FROM show_participants LIMIT 10;
--
-- If the query returns without error, the fix is working.
--
-- NOTE: These policies are intentionally permissive to fix the immediate issue.
-- They should be refined with more specific access controls once the basic
-- functionality is working correctly.
