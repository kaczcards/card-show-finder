-- db_migrations/reviews_and_series_schema.sql
-- Migration to create show series and reviews tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create show_series table for recurring shows
CREATE TABLE IF NOT EXISTS public.show_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    location TEXT,
    description TEXT,
    average_rating NUMERIC(3,2),
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Modify shows table to add series_id
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.show_series(id) ON DELETE SET NULL;

-- Add index on series_id for faster lookups
CREATE INDEX IF NOT EXISTS shows_series_id_idx ON public.shows(series_id);

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE,
    series_id UUID REFERENCES public.show_series(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT CHECK (LENGTH(comment) <= 250),
    favorite_dealer TEXT,
    favorite_dealer_reason TEXT,
    organizer_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure a review is linked to either a show or a series or both
    CONSTRAINT review_link_check CHECK (show_id IS NOT NULL OR series_id IS NOT NULL)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS reviews_show_id_idx ON public.reviews(show_id);
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

-- Function to update average rating and review count for shows and series
CREATE OR REPLACE FUNCTION update_review_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update show stats if show_id is provided
    IF NEW.show_id IS NOT NULL THEN
        UPDATE public.shows
        SET 
            rating = (
                SELECT AVG(rating)::numeric(3,2)
                FROM public.reviews
                WHERE show_id = NEW.show_id
            )
        WHERE id = NEW.show_id;
    END IF;
    
    -- Update series stats if series_id is provided
    IF NEW.series_id IS NOT NULL THEN
        UPDATE public.show_series
        SET 
            average_rating = (
                SELECT AVG(rating)::numeric(3,2)
                FROM public.reviews
                WHERE series_id = NEW.series_id
            ),
            review_count = (
                SELECT COUNT(*)
                FROM public.reviews
                WHERE series_id = NEW.series_id
            )
        WHERE id = NEW.series_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inserting a new review
DROP TRIGGER IF EXISTS reviews_insert_trigger ON public.reviews;

CREATE TRIGGER reviews_insert_trigger
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_review_stats();

-- Trigger for updating a review
DROP TRIGGER IF EXISTS reviews_update_trigger ON public.reviews;

CREATE TRIGGER reviews_update_trigger
AFTER UPDATE ON public.reviews
FOR EACH ROW
WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.show_id IS DISTINCT FROM NEW.show_id OR OLD.series_id IS DISTINCT FROM NEW.series_id)
EXECUTE FUNCTION update_review_stats();

-- Trigger for deleting a review
CREATE OR REPLACE FUNCTION update_review_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Update show stats if show_id was provided
    IF OLD.show_id IS NOT NULL THEN
        UPDATE public.shows
        SET 
            rating = (
                SELECT AVG(rating)::numeric(3,2)
                FROM public.reviews
                WHERE show_id = OLD.show_id
            )
        WHERE id = OLD.show_id;
    END IF;
    
    -- Update series stats if series_id was provided
    IF OLD.series_id IS NOT NULL THEN
        UPDATE public.show_series
        SET 
            average_rating = (
                SELECT AVG(rating)::numeric(3,2)
                FROM public.reviews
                WHERE series_id = OLD.series_id
            ),
            review_count = (
                SELECT COUNT(*)
                FROM public.reviews
                WHERE series_id = OLD.series_id
            )
        WHERE id = OLD.series_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_delete_trigger ON public.reviews;

CREATE TRIGGER reviews_delete_trigger
AFTER DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_review_stats_on_delete();

-- Enable Row Level Security
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

-- Allow users to insert reviews for shows they've attended
-- Note: In a real implementation, you might want to check if the user has attended the show
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

-- Function to check if a user is a show organizer
CREATE OR REPLACE FUNCTION is_show_organizer(show_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    organizer_user_id UUID;
BEGIN
    SELECT organizer_id INTO organizer_user_id
    FROM public.shows
    WHERE id = show_id;
    
    RETURN auth.uid() = organizer_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
COMMENT ON TABLE public.reviews IS 'Stores user reviews for shows and show series';
