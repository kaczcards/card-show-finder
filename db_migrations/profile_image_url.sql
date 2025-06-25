-- profile_image_url.sql
-- Migration to add profile_image_url column to the profiles table
-- This extends the user profiles to support profile images

-- First, check if the profiles table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    
    -- Add profile_image_url column to the profiles table
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
    
    -- Add comment to explain the column
    COMMENT ON COLUMN public.profiles.profile_image_url IS 'URL to the user''s profile image stored in storage bucket';
    
    -- Create an index to improve query performance when filtering by profile_image_url
    -- This is optional but can be useful if you frequently search by image URL
    CREATE INDEX IF NOT EXISTS idx_profiles_profile_image_url ON public.profiles(profile_image_url);
    
  ELSE
    RAISE NOTICE 'The profiles table does not exist. Please create the profiles table first.';
  END IF;
END $$;

-- Instructions for applying this migration:
-- 1. Connect to your Supabase project using the SQL Editor
-- 2. Paste this SQL script into a new query
-- 3. Execute the query to apply the changes
-- 4. Verify the changes by querying the profiles table structure:
--    SELECT column_name, data_type, column_default, is_nullable 
--    FROM information_schema.columns 
--    WHERE table_name = 'profiles' AND column_name = 'profile_image_url';
