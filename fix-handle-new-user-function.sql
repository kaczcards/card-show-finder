-- Fix handle_new_user function to properly handle email and other fields
-- The current function is failing because of missing or incorrect field handling

CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  -- Debug logging (can be removed later)
  RAISE LOG 'handle_new_user triggered for user ID: %', NEW.id;
  RAISE LOG 'Raw metadata: %', NEW.raw_user_meta_data;

  -- Extract email from auth user
  _email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
  
  -- Extract other fields from metadata
  _first_name := COALESCE(NEW.raw_user_meta_data->>'firstName', '');
  _last_name := COALESCE(NEW.raw_user_meta_data->>'lastName', '');
  _home_zip_code := COALESCE(NEW.raw_user_meta_data->>'homeZipCode', '');
  
  -- Get the role from the new user's metadata, default to 'attendee'
  _initial_role := COALESCE(NEW.raw_user_meta_data->>'role', 'attendee');

  -- Determine initial account_type based on the role provided during sign-up
  IF _initial_role = 'dealer' OR _initial_role = 'mvp_dealer' THEN
    _initial_account_type := 'dealer';
  ELSIF _initial_role = 'show_organizer' THEN
    _initial_account_type := 'organizer';
  ELSE -- default to collector for 'attendee' or any unexpected role
    _initial_account_type := 'collector';
  END IF;

  -- Validate required fields
  IF _email IS NULL OR _email = '' THEN
    RAISE EXCEPTION 'Email is required for profile creation';
  END IF;
  
  IF _first_name IS NULL OR _first_name = '' THEN
    RAISE EXCEPTION 'First name is required for profile creation';
  END IF;

  -- Insert the new profile
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
    -- Log the error but don't fail the auth creation
    RAISE LOG 'Error in handle_new_user for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
    RAISE LOG 'Email: %, FirstName: %, HomeZip: %', _email, _first_name, _home_zip_code;
    -- Re-raise the exception so we know there's a problem
    RAISE;
END;
$$;

-- Test the updated function
SELECT 'Updated handle_new_user function created with better error handling and logging' as result;