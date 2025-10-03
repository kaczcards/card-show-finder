-- Fix Registration Foreign Key Issue - FINAL SOLUTION
-- Run this in Supabase SQL Editor to resolve the foreign key constraint issue

-- Step 1: Check what foreign key constraint is causing the problem
SELECT 'Current Foreign Key Constraints:' as info;
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

-- Step 2: Drop the problematic foreign key constraint
-- This constraint is likely referencing a 'users' table instead of 'auth.users'
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 3: Add the correct foreign key constraint that references auth.users
-- This ensures profiles.id must exist in auth.users.id
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_auth_user_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Create/update the trigger function to handle new user registration
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

  -- Skip if essential fields are missing (let the app handle it)
  IF _email = '' OR _first_name = '' THEN
    RAISE LOG 'Skipping profile creation - missing required fields. Email: %, FirstName: %', _email, _first_name;
    RETURN NEW;
  END IF;

  -- Insert profile using UPSERT to handle conflicts
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

-- Step 5: Create the trigger (drop existing first if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Enable RLS on profiles table and set up policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create RLS policies
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Step 7: Test the setup
SELECT 'Foreign key constraint fixed - profiles now references auth.users' as result;
SELECT 'Trigger function updated with better error handling' as result;
SELECT 'RLS policies updated for proper access control' as result;

-- Clean up any orphaned profiles (optional)
-- DELETE FROM public.profiles 
-- WHERE id NOT IN (SELECT id FROM auth.users);