-- db_migrations/show_organizer_phase1.sql
-- Migration to implement Show Organizer features - Phase 1: Database & Core Data Modeling Foundations

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. Update shows table for recurring show management
-- =============================================

-- Add parent_show_id to link individual show instances to a parent show
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS parent_show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL;

-- Add is_series_parent to identify records that define a recurring series
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS is_series_parent BOOLEAN DEFAULT FALSE;

-- Add index on parent_show_id for faster lookups
CREATE INDEX IF NOT EXISTS shows_parent_show_id_idx ON public.shows(parent_show_id);

-- Add extra_details JSONB column for flexible show information storage
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS extra_details JSONB DEFAULT '{}'::jsonb;

-- =============================================
-- 2. Update profiles table for broadcast message tracking
-- =============================================

-- Add broadcast_message_count to track messages sent by this organizer in the current month
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS broadcast_message_count INT DEFAULT 0;

-- Add last_broadcast_reset_date to record the last time the count was reset
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_broadcast_reset_date TIMESTAMPTZ;

-- =============================================
-- 3. Create broadcast_logs table for auditing and history of sent broadcasts
-- =============================================

CREATE TABLE IF NOT EXISTS public.broadcast_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL,
    message_content TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    recipients TEXT[] DEFAULT '{}'::text[],
    CONSTRAINT broadcast_logs_message_content_check CHECK (LENGTH(message_content) <= 1000)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS broadcast_logs_organizer_id_idx ON public.broadcast_logs(organizer_id);
CREATE INDEX IF NOT EXISTS broadcast_logs_show_id_idx ON public.broadcast_logs(show_id);
CREATE INDEX IF NOT EXISTS broadcast_logs_sent_at_idx ON public.broadcast_logs(sent_at);

-- =============================================
-- 4. Create function to claim a show
-- =============================================

CREATE OR REPLACE FUNCTION public.claim_show(show_id UUID, organizer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    organizer_role TEXT;
    current_organizer_id UUID;
    is_parent BOOLEAN;
BEGIN
    -- Check if the organizer has the SHOW_ORGANIZER role
    SELECT role INTO organizer_role
    FROM public.profiles
    WHERE id = organizer_id;
    
    IF organizer_role != 'SHOW_ORGANIZER' THEN
        RAISE EXCEPTION 'Only users with SHOW_ORGANIZER role can claim shows';
        RETURN FALSE;
    END IF;
    
    -- Check if the show exists and is not already claimed
    SELECT shows.organizer_id, shows.is_series_parent 
    INTO current_organizer_id, is_parent
    FROM public.shows
    WHERE id = show_id;
    
    IF current_organizer_id IS NOT NULL THEN
        RAISE EXCEPTION 'Show is already claimed by another organizer';
        RETURN FALSE;
    END IF;
    
    -- Update the show's organizer_id
    UPDATE public.shows
    SET organizer_id = claim_show.organizer_id
    WHERE id = show_id;
    
    -- If this is a series parent, also claim all child shows
    IF is_parent THEN
        UPDATE public.shows
        SET organizer_id = claim_show.organizer_id
        WHERE parent_show_id = show_id;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error claiming show: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- =============================================
-- 5. Create function to get aggregate review score for a series
-- =============================================

CREATE OR REPLACE FUNCTION public.get_aggregate_review_score(series_parent_id UUID)
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
    JOIN public.shows s ON r.show_id = s.id
    WHERE 
        s.id = series_parent_id 
        OR s.parent_show_id = series_parent_id;
END;
$$;

-- =============================================
-- 5a. Create helper to reset monthly broadcast count
-- =============================================

CREATE OR REPLACE FUNCTION public.reset_broadcast_count(p_organizer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    month_start TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
    -- Reset the organizer's broadcast counter if we are in a new month
    UPDATE public.profiles
    SET
        broadcast_message_count      = 0,
        last_broadcast_reset_date    = NOW()
    WHERE id = p_organizer_id
      AND (
            last_broadcast_reset_date IS NULL
         OR last_broadcast_reset_date < month_start
      );
END;
$$;

-- =============================================
-- 6. Set up Row Level Security (RLS) policies
-- =============================================

-- Enable RLS on broadcast_logs table
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_logs table
CREATE POLICY broadcast_logs_insert_policy ON public.broadcast_logs
    FOR INSERT
    WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY broadcast_logs_select_policy ON public.broadcast_logs
    FOR SELECT
    USING (auth.uid() = organizer_id);

-- RLS policy for shows table to allow organizers to update their shows
CREATE POLICY shows_update_by_organizer_policy ON public.shows
    FOR UPDATE
    USING (auth.uid() = organizer_id);

-- RLS policy for reviews table to allow organizers to respond to reviews of their shows
CREATE OR REPLACE FUNCTION public.is_show_organizer_for_review(review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    show_organizer_id UUID;
BEGIN
    SELECT s.organizer_id INTO show_organizer_id
    FROM public.reviews r
    JOIN public.shows s ON r.show_id = s.id
    WHERE r.id = review_id;
    
    RETURN auth.uid() = show_organizer_id;
END;
$$;

-- =============================================
-- 7. Grant necessary permissions
-- =============================================

-- Grant permissions on broadcast_logs
GRANT SELECT, INSERT ON public.broadcast_logs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.claim_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_aggregate_review_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_show_organizer_for_review TO authenticated;

-- =============================================
-- 8. Add helpful comments to the database
-- =============================================

COMMENT ON TABLE public.broadcast_logs IS 'Logs of broadcast messages sent by show organizers';
COMMENT ON COLUMN public.shows.parent_show_id IS 'Reference to the parent show in a recurring series';
COMMENT ON COLUMN public.shows.is_series_parent IS 'Indicates if this show is a parent of a recurring series';
COMMENT ON COLUMN public.shows.extra_details IS 'Additional flexible show details stored as JSON';
COMMENT ON COLUMN public.profiles.broadcast_message_count IS 'Number of broadcast messages sent in the current month';
COMMENT ON COLUMN public.profiles.last_broadcast_reset_date IS 'Date when the broadcast message count was last reset';
COMMENT ON FUNCTION public.claim_show IS 'Function to claim ownership of a show by a show organizer';
COMMENT ON FUNCTION public.get_aggregate_review_score IS 'Function to calculate the average rating and total review count for a series of shows';

-- =============================================
-- IMPORTANT: Data Migration Notes
-- =============================================
/*
MANUAL STEPS REQUIRED:

1. For existing shows that are part of a recurring series:
   - Identify which shows should be marked as is_series_parent = TRUE
   - Set parent_show_id for all child shows to reference their parent

2. For already claimed shows (organizer_id is set):
   - Verify if these claims are valid or if they need to be re-claimed

3. For existing reviews that need organizer responses:
   - Check if organizer_response data needs to be backfilled

Example migration queries (to be run manually after reviewing):

-- Mark recurring show parents
UPDATE public.shows
SET is_series_parent = TRUE
WHERE id IN ('uuid-of-parent-1', 'uuid-of-parent-2');

-- Link child shows to parents
UPDATE public.shows
SET parent_show_id = 'uuid-of-parent-1'
WHERE id IN ('uuid-of-child-1', 'uuid-of-child-2');

-- These are examples only. Please review your data before executing.
*/
