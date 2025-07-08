-- db_migrations/recurring_shows_schema.sql
-- Migration to implement recurring shows and organizer functionality

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- Table: show_series
-- Description: Represents recurring card shows as a single entity
-- =======================================================
CREATE TABLE IF NOT EXISTS public.show_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index on organizer_id for faster lookups
CREATE INDEX IF NOT EXISTS show_series_organizer_id_idx ON public.show_series(organizer_id);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_show_series_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_show_series_updated_at_trigger ON public.show_series;

CREATE TRIGGER update_show_series_updated_at_trigger
BEFORE UPDATE ON public.show_series
FOR EACH ROW
EXECUTE FUNCTION update_show_series_updated_at();

-- =======================================================
-- Modify shows table to add series_id
-- =======================================================
-- Add series_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'shows' AND column_name = 'series_id'
    ) THEN
        ALTER TABLE public.shows 
        ADD COLUMN series_id UUID REFERENCES public.show_series(id) ON DELETE SET NULL;
        
        -- Add index on series_id for faster lookups
        CREATE INDEX IF NOT EXISTS shows_series_id_idx ON public.shows(series_id);
    END IF;
END $$;

-- =======================================================
-- Modify reviews table to link to series_id instead of show_id
-- =======================================================
-- First, create a backup of the existing reviews table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviews') THEN
        CREATE TABLE IF NOT EXISTS reviews_backup AS SELECT * FROM reviews;
    END IF;
END $$;

-- Drop existing reviews table if it exists and create new one
DROP TABLE IF EXISTS public.reviews CASCADE;

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id UUID NOT NULL REFERENCES public.show_series(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    organizer_reply TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS reviews_series_id_idx ON public.reviews(series_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON public.reviews(created_at);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reviews_updated_at_trigger ON public.reviews;

CREATE TRIGGER update_reviews_updated_at_trigger
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_reviews_updated_at();

-- =======================================================
-- Modify profiles table to add organizer broadcast quotas
-- =======================================================
-- Add columns for organizer message quotas if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'pre_show_broadcasts_remaining'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN pre_show_broadcasts_remaining INTEGER DEFAULT 2;
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'post_show_broadcasts_remaining'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN post_show_broadcasts_remaining INTEGER DEFAULT 1;
    END IF;
END $$;

-- =======================================================
-- Enable Row Level Security
-- =======================================================
ALTER TABLE public.show_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for show_series table
-- Allow anyone to view show series
CREATE POLICY show_series_select_policy ON public.show_series
    FOR SELECT
    USING (true);

-- Allow organizers to insert their own series
CREATE POLICY show_series_insert_policy ON public.show_series
    FOR INSERT
    WITH CHECK (auth.uid() = organizer_id);

-- Allow organizers to update their own series
CREATE POLICY show_series_update_policy ON public.show_series
    FOR UPDATE
    USING (auth.uid() = organizer_id);

-- Allow organizers to delete their own series
CREATE POLICY show_series_delete_policy ON public.show_series
    FOR DELETE
    USING (auth.uid() = organizer_id);

-- RLS Policies for reviews table
-- Allow anyone to view all reviews
CREATE POLICY reviews_select_policy ON public.reviews
    FOR SELECT
    USING (true);

-- Allow users to insert their own reviews
CREATE POLICY reviews_insert_policy ON public.reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own reviews
CREATE POLICY reviews_update_policy ON public.reviews
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow users to delete their own reviews
CREATE POLICY reviews_delete_policy ON public.reviews
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to check if a user is a series organizer
CREATE OR REPLACE FUNCTION is_series_organizer(series_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    organizer_user_id UUID;
BEGIN
    SELECT organizer_id INTO organizer_user_id
    FROM public.show_series
    WHERE id = series_id;
    
    RETURN auth.uid() = organizer_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- Add comments to tables
COMMENT ON TABLE public.show_series IS 'Stores information about recurring show series';
COMMENT ON TABLE public.reviews IS 'Stores user reviews for show series';
COMMENT ON COLUMN public.profiles.pre_show_broadcasts_remaining IS 'Number of messages the organizer can send before a show';
COMMENT ON COLUMN public.profiles.post_show_broadcasts_remaining IS 'Number of messages the organizer can send after a show';
