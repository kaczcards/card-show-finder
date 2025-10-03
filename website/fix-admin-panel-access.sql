-- ================================================================
-- Fix: Allow Admin Panel to Read Pending Shows
-- ================================================================
-- This fixes the issue where the admin panel can't see pending shows
-- due to Row Level Security (RLS) policies
-- ================================================================

-- Enable RLS on the table (if not already enabled)
ALTER TABLE public.scraped_shows_pending ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies to avoid conflicts
DROP POLICY IF EXISTS "allow_admin_read_pending" ON public.scraped_shows_pending;
DROP POLICY IF EXISTS "allow_authenticated_read_pending" ON public.scraped_shows_pending;

-- Allow authenticated users to read pending shows
-- (This allows the admin panel to work when you're logged in)
CREATE POLICY "allow_authenticated_read_pending"
ON public.scraped_shows_pending
FOR SELECT
TO authenticated
USING (true);

-- Also allow the anon key to read (for testing the admin panel locally)
-- Remove this in production if you want stricter security
CREATE POLICY "allow_anon_read_pending"
ON public.scraped_shows_pending
FOR SELECT
TO anon
USING (true);

-- Grant SELECT permission to authenticated users
GRANT SELECT ON public.scraped_shows_pending TO authenticated;
GRANT SELECT ON public.scraped_shows_pending TO anon;

-- ================================================================
-- Verify the policies
-- ================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'scraped_shows_pending'
ORDER BY policyname;

-- ================================================================
-- Test: Check if you can see pending shows now
-- ================================================================
SELECT 
  id,
  raw_payload->>'name' AS show_name,
  status,
  created_at
FROM public.scraped_shows_pending
WHERE status = 'PENDING'
ORDER BY created_at DESC;
