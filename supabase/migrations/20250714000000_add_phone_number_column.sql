-- Migration: Add phone_number column to profiles table if it doesn't exist
-- This migration ensures the phone_number column exists in all environments,
-- fixing the "Could not find the 'phone_number' column" error during profile updates.
-- Date: 2025-07-14

-- Safely add the phone_number column if it doesn't already exist
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'phone_number'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.profiles ADD COLUMN phone_number text;
        
        -- Log the change
        RAISE NOTICE 'Added phone_number column to profiles table';
    ELSE
        RAISE NOTICE 'phone_number column already exists in profiles table';
    END IF;
END $$;
