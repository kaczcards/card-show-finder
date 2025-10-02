-- PRODUCTION-READY RLS POLICIES
-- Run this to secure your app for Apple submission

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple, secure policies that work with your current registration flow
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles  
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Special policy for service role (used by triggers and server-side operations)
CREATE POLICY "Service role can manage all profiles" ON public.profiles
    FOR ALL USING (current_setting('role') = 'service_role');

SELECT 'RLS enabled with production-ready policies' as result;