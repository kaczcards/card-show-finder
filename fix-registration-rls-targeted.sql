-- Fix Registration RLS Issue - Targeted Fix
-- 
-- This script only creates missing RLS policies and functions
-- It won't error if policies already exist

-- Enable RLS on profiles table if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Only create the INSERT policy if it doesn't exist
-- This is the critical policy needed for registration to work
DO $$ 
BEGIN
    -- Check if the INSERT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can create their own profile'
        AND cmd = 'INSERT'
    ) THEN
        CREATE POLICY "Users can create their own profile"
        ON public.profiles
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = id);
    END IF;

    -- Check if SELECT policy exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can view their own profile'
        AND cmd = 'SELECT'
    ) THEN
        CREATE POLICY "Users can view their own profile"
        ON public.profiles
        FOR SELECT
        TO authenticated
        USING (auth.uid() = id);
    END IF;

    -- Check if UPDATE policy exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
        AND cmd = 'UPDATE'
    ) THEN
        CREATE POLICY "Users can update their own profile"
        ON public.profiles
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;

    -- Check if service role policy exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Service role has full access'
    ) THEN
        CREATE POLICY "Service role has full access"
        ON public.profiles
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Create or replace the handle_new_user function
-- This will handle profile creation during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile using the metadata from auth.users
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    display_name,
    home_zip_code,
    role,
    account_type,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name', 
      COALESCE(NEW.raw_user_meta_data->>'first_name', '') || 
      CASE 
        WHEN NEW.raw_user_meta_data->>'last_name' IS NOT NULL AND NEW.raw_user_meta_data->>'last_name' != '' 
        THEN ' ' || NEW.raw_user_meta_data->>'last_name' 
        ELSE '' 
      END
    ),
    COALESCE(NEW.raw_user_meta_data->>'home_zip_code', ''),
    'ATTENDEE'::text,
    'collector'::text,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth creation
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Test query to show current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname, cmd;