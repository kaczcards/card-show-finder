-- Immediate Fix Approach
-- Let's try a different strategy: fix the existing function in place

-- 1. First, let's see what we're working with
SELECT 'Current function source:' as step;
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 2. Check recent auth user data
SELECT 'Recent auth user data:' as step;
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data,
    raw_user_meta_data->>'firstName' as fn,
    raw_user_meta_data->>'homeZipCode' as zip,
    raw_user_meta_data->>'role' as role
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1;

-- 3. Let's manually create a profile for the most recent user
-- This will help us understand what the app is expecting
DO $$
DECLARE
    recent_user record;
    profile_count integer;
BEGIN
    -- Get the most recent user
    SELECT id, email, raw_user_meta_data 
    INTO recent_user
    FROM auth.users 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF recent_user.id IS NOT NULL THEN
        -- Check if profile already exists
        SELECT COUNT(*) INTO profile_count 
        FROM public.profiles 
        WHERE id = recent_user.id;
        
        IF profile_count = 0 THEN
            RAISE NOTICE 'Creating profile manually for user: %', recent_user.id;
            
            INSERT INTO public.profiles (
                id,
                email,
                first_name,
                last_name,
                home_zip_code,
                role,
                account_type,
                created_at,
                updated_at
            ) VALUES (
                recent_user.id,
                recent_user.email,
                recent_user.raw_user_meta_data->>'firstName',
                recent_user.raw_user_meta_data->>'lastName',
                recent_user.raw_user_meta_data->>'homeZipCode',
                COALESCE(recent_user.raw_user_meta_data->>'role', 'attendee'),
                'collector',
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'Profile created successfully!';
        ELSE
            RAISE NOTICE 'Profile already exists for this user';
        END IF;
    ELSE
        RAISE NOTICE 'No recent users found';
    END IF;
END $$;

-- 4. Verify the profile was created
SELECT 'Verification - Recent profiles:' as step;
SELECT 
    id,
    email,
    first_name,
    home_zip_code,
    role,
    account_type,
    created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 2;