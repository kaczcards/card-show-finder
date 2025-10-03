-- QUICK FIX: Temporarily disable RLS to test registration
-- Run this first to test if registration works:

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

SELECT 'RLS temporarily disabled - test registration now' as message;

-- After testing successfully, you can re-enable with proper policies:
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;