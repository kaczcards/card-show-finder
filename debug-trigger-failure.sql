-- Debug why the trigger is failing silently
-- Let's check the logs and test the function manually

-- 1. Check if there are any recent error logs
-- (Note: This might not work in all Supabase setups)

-- 2. Check the most recent auth user and see what data we have
SELECT 'Most Recent Auth User:' as debug_step;
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data,
    -- Extract the specific fields the function is looking for
    raw_user_meta_data->>'firstName' as extracted_first_name,
    raw_user_meta_data->>'lastName' as extracted_last_name,
    raw_user_meta_data->>'homeZipCode' as extracted_home_zip,
    raw_user_meta_data->>'role' as extracted_role
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 1;

-- 3. Let's manually try to insert a profile with the exact same data pattern
-- First get the most recent user ID
DO $$
DECLARE
    recent_user_id uuid;
    recent_user_email text;
    user_meta jsonb;
    first_name text;
    last_name text;
    home_zip text;
    user_role text;
    account_type text;
BEGIN
    -- Get the most recent user
    SELECT id, email, raw_user_meta_data 
    INTO recent_user_id, recent_user_email, user_meta
    FROM auth.users 
    WHERE created_at > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF recent_user_id IS NOT NULL THEN
        -- Extract metadata the same way the function does
        first_name := user_meta->>'firstName';
        last_name := user_meta->>'lastName';
        home_zip := user_meta->>'homeZipCode';
        user_role := user_meta->>'role';
        
        -- Determine account type
        IF user_role = 'dealer' OR user_role = 'mvp_dealer' THEN
            account_type := 'dealer';
        ELSIF user_role = 'show_organizer' THEN
            account_type := 'organizer';
        ELSE
            account_type := 'collector';
        END IF;
        
        RAISE NOTICE 'User ID: %', recent_user_id;
        RAISE NOTICE 'Email: %', recent_user_email;
        RAISE NOTICE 'First Name: %', first_name;
        RAISE NOTICE 'Last Name: %', last_name;
        RAISE NOTICE 'Home ZIP: %', home_zip;
        RAISE NOTICE 'Role: %', user_role;
        RAISE NOTICE 'Account Type: %', account_type;
        
        -- Check if this user already has a profile
        IF EXISTS(SELECT 1 FROM public.profiles WHERE id = recent_user_id) THEN
            RAISE NOTICE 'Profile already exists for this user!';
        ELSE
            RAISE NOTICE 'No profile exists - this is why the app fails';
            
            -- Try to create the profile manually to see what fails
            BEGIN
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
                )
                VALUES (
                    recent_user_id,
                    recent_user_email,
                    first_name,
                    last_name,
                    home_zip,
                    user_role,
                    account_type,
                    NOW(),
                    NOW()
                );
                RAISE NOTICE 'Manual profile creation succeeded!';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Manual profile creation failed: % - %', SQLSTATE, SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'No recent auth users found';
    END IF;
END $$;