-- Final Auth Trigger Fix
-- Since function updates aren't working, let's try a different approach

-- 1. Completely drop and recreate the function with a different name first
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;

-- 2. Create a new function with a different name
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _initial_role text;
  _initial_account_type text;
BEGIN
  -- Extract role from metadata
  _initial_role := COALESCE(NEW.raw_user_meta_data->>'role', 'attendee');

  -- Determine account type  
  IF _initial_role IN ('dealer', 'mvp_dealer') THEN
    _initial_account_type := 'dealer';
  ELSIF _initial_role = 'show_organizer' THEN
    _initial_account_type := 'organizer';
  ELSE
    _initial_account_type := 'collector';
  END IF;

  -- Insert profile
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
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    NEW.raw_user_meta_data->>'homeZipCode',
    _initial_role,
    _initial_account_type,
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth creation
    RAISE LOG 'Error in create_user_profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger with the new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

-- 4. Test the new setup
SELECT 'New trigger system created with create_user_profile function' as result;

-- 5. Verify trigger exists
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';