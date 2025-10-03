-- Test if we can manually insert into profiles table
-- This will help us understand if the issue is with the INSERT itself or the trigger

-- First, check what policies exist RIGHT NOW
SELECT 
  '=== CURRENT POLICIES ===' as info,
  policyname,
  cmd,
  roles::text,
  pg_get_expr(qual, 'public.profiles'::regclass) as using_clause,
  pg_get_expr(with_check, 'public.profiles'::regclass) as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Check if RLS is enabled
SELECT 
  '=== RLS STATUS ===' as info,
  rowsecurity as is_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- Now try to insert a test profile using a fake UUID
-- This simulates what the trigger does
DO $$
DECLARE
  test_uuid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- First delete if it exists (cleanup)
  DELETE FROM public.profiles WHERE id = test_uuid;
  
  -- Try the insert (this is what the trigger does)
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      role,
      account_type
    ) VALUES (
      test_uuid,
      'test@example.com',
      'Test',
      'User',
      'attendee',
      'collector'
    );
    
    RAISE NOTICE '✅ SUCCESS: Direct INSERT worked!';
    
    -- Cleanup
    DELETE FROM public.profiles WHERE id = test_uuid;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE 'Error code: %', SQLSTATE;
  END;
END $$;

-- Check what's actually blocking it
SELECT 
  '=== TABLE PERMISSIONS ===' as info,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND privilege_type IN ('INSERT', 'ALL', 'ALL PRIVILEGES')
ORDER BY grantee;
