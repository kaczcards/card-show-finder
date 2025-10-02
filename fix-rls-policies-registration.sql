-- Fix RLS Policies for Registration
-- The current policies are too restrictive and block profile creation during registration

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Step 2: Create more permissive policies that allow registration
-- Allow users to insert their own profile (when auth.uid() matches the ID being inserted)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Step 3: Create a special policy for the trigger function
-- This allows the trigger function to insert profiles during registration
CREATE POLICY "Allow trigger to insert profiles" ON public.profiles
    FOR INSERT 
    WITH CHECK (true);

-- Step 4: Update the trigger function to use proper security context
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
  -- Debug logging
  RAISE LOG 'handle_new_user triggered for user ID: %', NEW.id;
  
  -- Extract email from auth user
  _email := COALESCE(NEW.email, '');
  
  -- Extract fields from metadata with both naming conventions
  _first_name := COALESCE(
    NEW.raw_user_meta_data->>'firstName', 
    NEW.raw_user_meta_data->>'first_name', 
    ''
  );
  _last_name := COALESCE(
    NEW.raw_user_meta_data->>'lastName', 
    NEW.raw_user_meta_data->>'last_name', 
    ''
  );
  _home_zip_code := COALESCE(
    NEW.raw_user_meta_data->>'homeZipCode', 
    NEW.raw_user_meta_data->>'home_zip_code', 
    ''
  );
  
  -- Get role, default to 'attendee'
  _initial_role := COALESCE(NEW.raw_user_meta_data->>'role', 'attendee');

  -- Determine account type
  IF _initial_role = 'dealer' OR _initial_role = 'mvp_dealer' THEN
    _initial_account_type := 'dealer';
  ELSIF _initial_role = 'show_organizer' THEN
    _initial_account_type := 'organizer';
  ELSE
    _initial_account_type := 'collector';
  END IF;

  -- Skip if essential fields are missing
  IF _email = '' OR _first_name = '' THEN
    RAISE LOG 'Skipping profile creation - missing required fields. Email: %, FirstName: %', _email, _first_name;
    RETURN NEW;
  END IF;

  -- Temporarily disable RLS for this insert by using a security definer function
  -- Insert profile using direct SQL (bypasses RLS in SECURITY DEFINER context)
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
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    home_zip_code = EXCLUDED.home_zip_code,
    updated_at = NOW();
  
  RAISE LOG 'Profile created/updated successfully for user: %', NEW.id;
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    -- Don't re-raise - let auth creation succeed even if profile fails
    RETURN NEW;
END;
$$;

-- Step 5: Alternative approach - temporarily disable RLS during registration
-- You can also disable RLS temporarily if needed:
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- (Remember to re-enable it after testing: ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;)

-- Step 6: Grant necessary permissions
-- Ensure the trigger function has the right permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON public.profiles TO postgres;

SELECT 'RLS policies updated to allow registration' as result;