-- Detailed Trigger Debug
-- This will help us understand why the trigger isn't working

-- 1. Check trigger status
SELECT 'TRIGGER STATUS:' as debug_step;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as enabled,
    tgtype as trigger_type
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 2. Check function permissions
SELECT 'FUNCTION PERMISSIONS:' as debug_step;
SELECT 
    proname,
    proowner,
    proacl,
    prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 3. Check recent auth.users with metadata
SELECT 'RECENT AUTH USERS (with metadata):' as debug_step;
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data,
    raw_user_meta_data->>'firstName' as extracted_first_name,
    raw_user_meta_data->>'homeZipCode' as extracted_zip
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 3;

-- 4. Check if any profiles were created recently
SELECT 'RECENT PROFILES:' as debug_step;
SELECT 
    id,
    first_name,
    last_name,
    home_zip_code,
    role,
    account_type,
    created_at
FROM public.profiles 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 3;

-- 5. Test the function manually with sample data
SELECT 'MANUAL FUNCTION TEST:' as debug_step;

-- Try to manually call the handle_new_user function to see if it works
-- Note: This won't work directly since it's a trigger function, but we can check its structure

-- 6. Check if there are any constraint violations or issues
SELECT 'TABLE CONSTRAINTS:' as debug_step;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE conrelid = 'public.profiles'::regclass
AND contype IN ('f', 'c', 'u'); -- foreign key, check, unique constraints