-- Debug Foreign Key Issue
-- Let's see the foreign key constraint and recent auth users

-- 1. Check the foreign key constraint on profiles table
SELECT 'Foreign Key Constraints on Profiles Table:' as step;
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'profiles';

-- 2. Check recent auth.users entries
SELECT 'Recent Auth Users:' as step;
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Check recent profiles entries  
SELECT 'Recent Profiles:' as step;
SELECT 
    id,
    email,
    first_name,
    created_at
FROM public.profiles 
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Find orphaned auth users (auth users without profiles)
SELECT 'Auth Users Without Profiles:' as step;
SELECT 
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
    AND au.created_at > NOW() - INTERVAL '2 hours'
ORDER BY au.created_at DESC;

-- 5. Check if the most recent failed user ID exists in auth.users
SELECT 'Checking for specific user ID in auth.users:' as step;
-- Replace this with the actual user ID from the error if you want to test a specific one
-- SELECT id, email, created_at FROM auth.users WHERE id = '882a5069-cb4c-404d-9abb-3222a5ba8f27';