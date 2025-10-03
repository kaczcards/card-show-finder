-- Force update the handle_new_user function with better error handling
-- This will completely replace the existing function

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _initial_role text;
  _initial_account_type text;
  _email text;
  _first_name text;
  _last_name text;
  _home_zip_code text;
BEGIN
  -- Log that the trigger fired
  RAISE LOG 'handle_new_user trigger fired for user: %', NEW.id;
  
  -- Extract email safely
  _email := NEW.email;
  
  -- Extract metadata
  _first_name := NEW.raw_user_meta_data->>'firstName';
  _last_name := NEW.raw_user_meta_data->>'lastName';
  _home_zip_code := NEW.raw_user_meta_data->>'homeZipCode';
  _initial_role := COALESCE(NEW.raw_user_meta_data->>'role', 'attendee');

  -- Log extracted values
  RAISE LOG 'Extracted values - Email: %, FirstName: %, HomeZip: %, Role: %', 
    _email, _first_name, _home_zip_code, _initial_role;

  -- Determine account type
  IF _initial_role IN ('dealer', 'mvp_dealer') THEN
    _initial_account_type := 'dealer';
  ELSIF _initial_role = 'show_organizer' THEN
    _initial_account_type := 'organizer';
  ELSE
    _initial_account_type := 'collector';
  END IF;

  -- Validate required fields
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Email is null for user %', NEW.id;
  END IF;
  
  IF _first_name IS NULL OR _first_name = '' THEN
    RAISE EXCEPTION 'First name is missing for user %', NEW.id;
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
    _email,
    _first_name,
    _last_name,
    _home_zip_code,
    _initial_role,
    _initial_account_type,
    NOW(),
    NOW()
  );

  RAISE LOG 'Profile created successfully for user: %', NEW.id;
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'ERROR in handle_new_user for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
    -- Don't re-raise the exception - let auth creation succeed
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the function was updated
SELECT 'Function updated successfully' as result;