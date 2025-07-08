-- db_migrations/show_organizer_series_implementation.sql
-- Migration to implement Show Organizer features with show series, persistent reviews, and broadcast messaging

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. Create show_series table
-- =============================================

CREATE TABLE IF NOT EXISTS public.show_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    average_rating NUMERIC(3,2),
    review_count INTEGER DEFAULT 0
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

-- =============================================
-- 2. Modify shows table to link to show_series
-- =============================================

-- Add series_id to link each show to its parent series
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.show_series(id) ON DELETE SET NULL;

-- Add index on series_id for faster lookups
CREATE INDEX IF NOT EXISTS shows_series_id_idx ON public.shows(series_id);

-- =============================================
-- 3. Modify reviews table to link to show_series
-- =============================================

-- Modify reviews table to link to show_series instead of individual shows
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.show_series(id) ON DELETE CASCADE;

-- Add index on series_id for faster lookups
CREATE INDEX IF NOT EXISTS reviews_series_id_idx ON public.reviews(series_id);

-- =============================================
-- 4. Modify profiles table for broadcast quotas
-- =============================================

-- Add broadcast quota columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pre_show_broadcasts_remaining INTEGER DEFAULT 2;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS post_show_broadcasts_remaining INTEGER DEFAULT 1;

-- =============================================
-- 5. Create broadcast_logs table if it doesn't exist
-- =============================================

CREATE TABLE IF NOT EXISTS public.broadcast_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL,
    series_id UUID REFERENCES public.show_series(id) ON DELETE SET NULL,
    message_content TEXT NOT NULL,
    broadcast_type TEXT NOT NULL CHECK (broadcast_type IN ('pre_show', 'post_show')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    recipients TEXT[] DEFAULT '{}'::text[],
    CONSTRAINT broadcast_logs_message_content_check CHECK (LENGTH(message_content) <= 1000)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS broadcast_logs_organizer_id_idx ON public.broadcast_logs(organizer_id);
CREATE INDEX IF NOT EXISTS broadcast_logs_show_id_idx ON public.broadcast_logs(show_id);
CREATE INDEX IF NOT EXISTS broadcast_logs_series_id_idx ON public.broadcast_logs(series_id);
CREATE INDEX IF NOT EXISTS broadcast_logs_sent_at_idx ON public.broadcast_logs(sent_at);
CREATE INDEX IF NOT EXISTS broadcast_logs_broadcast_type_idx ON public.broadcast_logs(broadcast_type);

-- =============================================
-- 6. Create function to claim a show series
-- =============================================

CREATE OR REPLACE FUNCTION public.claim_show_series(series_id UUID, organizer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    organizer_role TEXT;
    current_organizer_id UUID;
    result JSONB;
BEGIN
    -- Check if the organizer has the SHOW_ORGANIZER role
    SELECT role INTO organizer_role
    FROM public.profiles
    WHERE id = organizer_id;
    
    IF organizer_role != 'SHOW_ORGANIZER' THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Only users with SHOW_ORGANIZER role can claim show series',
            'code', 'INSUFFICIENT_PERMISSIONS'
        );
        RETURN result;
    END IF;
    
    -- Check if the series exists and is not already claimed
    SELECT organizer_id INTO current_organizer_id
    FROM public.show_series
    WHERE id = series_id;
    
    IF current_organizer_id IS NOT NULL AND current_organizer_id != organizer_id THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Show series is already claimed by another organizer',
            'code', 'ALREADY_CLAIMED'
        );
        RETURN result;
    END IF;
    
    -- Update the series organizer_id
    UPDATE public.show_series
    SET organizer_id = claim_show_series.organizer_id
    WHERE id = series_id
    RETURNING id, name, organizer_id, created_at, updated_at 
    INTO result;
    
    -- Return success response with show data
    result := jsonb_build_object(
        'success', true,
        'message', 'Show series successfully claimed',
        'data', result,
        'code', 'SUCCESS'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Error claiming show series: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
        RETURN result;
END;
$$;

-- =============================================
-- 7. Create function to check if user is organizer for a series
-- =============================================

CREATE OR REPLACE FUNCTION public.is_series_organizer(p_series_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.show_series s
        WHERE 
            s.id = p_series_id
            AND s.organizer_id = p_user_id
    );
END;
$$;

-- =============================================
-- 8. Create function to get aggregate review score for a series
-- =============================================

CREATE OR REPLACE FUNCTION public.get_series_review_stats(p_series_id UUID)
RETURNS TABLE (
    average_rating NUMERIC(3,2),
    total_reviews INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(AVG(r.rating)::NUMERIC(3,2), 0) as average_rating,
        COUNT(r.id) as total_reviews
    FROM public.reviews r
    WHERE r.series_id = p_series_id;
END;
$$;

-- =============================================
-- 9. Create function to send a broadcast message
-- =============================================

CREATE OR REPLACE FUNCTION public.send_broadcast_message(
    p_series_id UUID,
    p_show_id UUID,
    p_organizer_id UUID,
    p_message TEXT,
    p_broadcast_type TEXT,
    p_recipients TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    organizer_role TEXT;
    is_organizer BOOLEAN;
    quota_remaining INTEGER;
    result JSONB;
BEGIN
    -- Check if the organizer has the SHOW_ORGANIZER role
    SELECT role INTO organizer_role
    FROM public.profiles
    WHERE id = p_organizer_id;
    
    IF organizer_role != 'SHOW_ORGANIZER' THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Only users with SHOW_ORGANIZER role can send broadcasts',
            'code', 'INSUFFICIENT_PERMISSIONS'
        );
        RETURN result;
    END IF;
    
    -- Check if the user is the organizer for this series
    SELECT public.is_series_organizer(p_series_id, p_organizer_id) INTO is_organizer;
    
    IF NOT is_organizer THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'You can only send broadcasts for series you organize',
            'code', 'NOT_SERIES_ORGANIZER'
        );
        RETURN result;
    END IF;
    
    -- Check if there's quota remaining for this broadcast type
    IF p_broadcast_type = 'pre_show' THEN
        SELECT pre_show_broadcasts_remaining INTO quota_remaining
        FROM public.profiles
        WHERE id = p_organizer_id;
    ELSIF p_broadcast_type = 'post_show' THEN
        SELECT post_show_broadcasts_remaining INTO quota_remaining
        FROM public.profiles
        WHERE id = p_organizer_id;
    ELSE
        result := jsonb_build_object(
            'success', false,
            'message', 'Invalid broadcast type. Must be "pre_show" or "post_show"',
            'code', 'INVALID_BROADCAST_TYPE'
        );
        RETURN result;
    END IF;
    
    IF quota_remaining <= 0 THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'You have no remaining ' || p_broadcast_type || ' broadcasts',
            'code', 'QUOTA_EXCEEDED'
        );
        RETURN result;
    END IF;
    
    -- Insert the broadcast log
    INSERT INTO public.broadcast_logs (
        organizer_id,
        show_id,
        series_id,
        message_content,
        broadcast_type,
        recipients
    )
    VALUES (
        p_organizer_id,
        p_show_id,
        p_series_id,
        p_message,
        p_broadcast_type,
        p_recipients
    )
    RETURNING id, sent_at
    INTO result;
    
    -- Decrement the appropriate quota
    IF p_broadcast_type = 'pre_show' THEN
        UPDATE public.profiles
        SET pre_show_broadcasts_remaining = pre_show_broadcasts_remaining - 1
        WHERE id = p_organizer_id;
    ELSIF p_broadcast_type = 'post_show' THEN
        UPDATE public.profiles
        SET post_show_broadcasts_remaining = post_show_broadcasts_remaining - 1
        WHERE id = p_organizer_id;
    END IF;
    
    -- Return success response
    result := jsonb_build_object(
        'success', true,
        'message', 'Broadcast message sent successfully',
        'data', result,
        'code', 'SUCCESS'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Error sending broadcast: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
        RETURN result;
END;
$$;

-- =============================================
-- 10. Create function to reset broadcast quotas for a show
-- =============================================

CREATE OR REPLACE FUNCTION public.reset_show_broadcast_quotas(p_organizer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset the broadcast quotas to their default values
    UPDATE public.profiles
    SET 
        pre_show_broadcasts_remaining = 2,
        post_show_broadcasts_remaining = 1
    WHERE id = p_organizer_id;
END;
$$;

-- =============================================
-- 11. Create function to update review stats for a series
-- =============================================

CREATE OR REPLACE FUNCTION update_series_review_stats()
RETURNS TRIGGER AS $$
BEGIN
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
EXECUTE FUNCTION update_series_review_stats();

-- Trigger for updating a review
DROP TRIGGER IF EXISTS reviews_update_trigger ON public.reviews;

CREATE TRIGGER reviews_update_trigger
AFTER UPDATE ON public.reviews
FOR EACH ROW
WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.series_id IS DISTINCT FROM NEW.series_id)
EXECUTE FUNCTION update_series_review_stats();

-- Trigger for deleting a review
CREATE OR REPLACE FUNCTION update_series_review_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
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
EXECUTE FUNCTION update_series_review_stats_on_delete();

-- =============================================
-- 12. Set up Row Level Security (RLS) policies
-- =============================================

-- Enable RLS on show_series table
ALTER TABLE public.show_series ENABLE ROW LEVEL SECURITY;

-- RLS policies for show_series table
CREATE POLICY show_series_select_policy ON public.show_series
    FOR SELECT
    USING (true);

CREATE POLICY show_series_insert_policy ON public.show_series
    FOR INSERT
    WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY show_series_update_policy ON public.show_series
    FOR UPDATE
    USING (auth.uid() = organizer_id);

CREATE POLICY show_series_delete_policy ON public.show_series
    FOR DELETE
    USING (auth.uid() = organizer_id);

-- Enable RLS on broadcast_logs table
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_logs table
CREATE POLICY broadcast_logs_insert_policy ON public.broadcast_logs
    FOR INSERT
    WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY broadcast_logs_select_policy ON public.broadcast_logs
    FOR SELECT
    USING (auth.uid() = organizer_id);

-- Update RLS policy for reviews table to allow organizers to respond to reviews
CREATE OR REPLACE FUNCTION public.is_series_organizer_for_review(review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    series_organizer_id UUID;
BEGIN
    SELECT s.organizer_id INTO series_organizer_id
    FROM public.reviews r
    JOIN public.show_series s ON r.series_id = s.id
    WHERE r.id = review_id;
    
    RETURN auth.uid() = series_organizer_id;
END;
$$;

-- =============================================
-- 13. Grant necessary permissions
-- =============================================

-- Grant permissions on show_series
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_series TO authenticated;

-- Grant permissions on broadcast_logs
GRANT SELECT, INSERT ON public.broadcast_logs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.claim_show_series TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_series_organizer TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_series_review_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_broadcast_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_show_broadcast_quotas TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_series_organizer_for_review TO authenticated;

-- =============================================
-- 14. Add helpful comments to the database
-- =============================================

COMMENT ON TABLE public.show_series IS 'Stores information about recurring show series';
COMMENT ON COLUMN public.show_series.organizer_id IS 'References the profile ID of the user who organizes this series';
COMMENT ON COLUMN public.shows.series_id IS 'References the show_series this show belongs to';
COMMENT ON COLUMN public.reviews.series_id IS 'References the show_series this review is for';
COMMENT ON COLUMN public.profiles.pre_show_broadcasts_remaining IS 'Number of pre-show broadcast messages the organizer can send';
COMMENT ON COLUMN public.profiles.post_show_broadcasts_remaining IS 'Number of post-show broadcast messages the organizer can send';
COMMENT ON COLUMN public.broadcast_logs.broadcast_type IS 'Type of broadcast: pre_show or post_show';
COMMENT ON FUNCTION public.claim_show_series IS 'Function to claim ownership of a show series by a show organizer';
COMMENT ON FUNCTION public.is_series_organizer IS 'Function to check if a user is the organizer for a specific show series';
COMMENT ON FUNCTION public.get_series_review_stats IS 'Function to calculate the average rating and total review count for a series';
COMMENT ON FUNCTION public.send_broadcast_message IS 'Function to send a broadcast message to recipients of a show';
COMMENT ON FUNCTION public.reset_show_broadcast_quotas IS 'Function to reset the broadcast quotas for a show organizer';

-- =============================================
-- 15. Data Migration Section
-- =============================================

/*
MANUAL STEPS REQUIRED FOR DATA MIGRATION:

1. Create show_series records for existing recurring shows:

-- First identify recurring shows by looking for shows with the same title/location
WITH recurring_shows AS (
    SELECT 
        title, 
        address, 
        COUNT(*) as instance_count
    FROM 
        public.shows
    GROUP BY 
        title, address
    HAVING 
        COUNT(*) > 1
)
SELECT * FROM recurring_shows ORDER BY instance_count DESC;

-- For each identified recurring show, create a show_series record
INSERT INTO public.show_series (name, description)
SELECT DISTINCT 
    title as name,
    'Recurring show at ' || address as description
FROM 
    public.shows
WHERE 
    title IN (SELECT title FROM recurring_shows)
RETURNING id, name;

2. Link existing shows to their series:

-- For each show_series created, update the corresponding shows
UPDATE public.shows
SET series_id = (SELECT id FROM public.show_series WHERE name = shows.title LIMIT 1)
WHERE title IN (SELECT name FROM public.show_series);

3. Migrate existing reviews to link to show_series:

-- For each review, update it to reference the show's series
UPDATE public.reviews r
SET series_id = (
    SELECT s.series_id
    FROM public.shows s
    WHERE s.id = r.show_id
)
WHERE r.show_id IN (
    SELECT id FROM public.shows WHERE series_id IS NOT NULL
);

4. Assign organizers to series based on existing show claims:

-- If shows already have organizer_id set, use that to set the series organizer
UPDATE public.show_series ss
SET organizer_id = (
    SELECT DISTINCT organizer_id
    FROM public.shows s
    WHERE s.series_id = ss.id
    AND s.organizer_id IS NOT NULL
    LIMIT 1
);

5. Initialize broadcast quotas for all organizers:

-- Set default quotas for all show organizers
UPDATE public.profiles
SET 
    pre_show_broadcasts_remaining = 2,
    post_show_broadcasts_remaining = 1
WHERE role = 'SHOW_ORGANIZER';

IMPORTANT: These are example migration queries. Always review and test them on a staging environment before running in production.
*/
