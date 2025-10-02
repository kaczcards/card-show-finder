-- Test Manual Profile Creation
-- This will test if we can create a profile manually to isolate the issue

-- First, let's find a recent auth user to test with
SELECT 'Finding recent auth user:' as step;
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1;

-- Test if we can manually insert a profile using a test UUID
-- (We'll use a test UUID to avoid conflicts)
SELECT 'Testing manual profile creation:' as step;

-- Insert a test profile
INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    home_zip_code,
    role,
    account_type,
    created_at,
    updated_at
) 
VALUES (
    '00000000-0000-0000-0000-000000000999'::uuid,
    'Test',
    'User',
    '12345',
    'attendee',
    'collector',
    NOW(),
    NOW()
);

-- Check if it was inserted
SELECT 'Test profile created:' as step;
SELECT 
    id,
    first_name,
    last_name,
    home_zip_code,
    role,
    account_type
FROM public.profiles 
WHERE id = '00000000-0000-0000-0000-000000000999'::uuid;

-- Clean up the test profile
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000999'::uuid;

SELECT 'Test completed - manual profile creation works if no errors above' as step;