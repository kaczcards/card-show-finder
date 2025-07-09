-- db_migrations/show_claim_functionality.sql
-- Migration to implement Show Claim functionality for Show Organizers

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. Update shows table for claim functionality
-- =============================================

-- Add claimed flag to indicate if a show has been claimed by an organizer
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE;

-- Add claimed_by to reference the profile that claimed the show
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add claimed_at to track when the show was claimed
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Add index on claimed_by for faster lookups
CREATE INDEX IF NOT EXISTS shows_claimed_by_idx ON public.shows(claimed_by);

-- Add index on claimed for faster filtering
CREATE INDEX IF NOT EXISTS shows_claimed_idx ON public.shows(claimed);

-- =============================================
-- 2. Create show_organizers table for many-to-many relationship
-- =============================================

CREATE TABLE IF NOT EXISTS public.show_organizers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'primary', -- primary, assistant, etc.
    permissions JSONB DEFAULT '{}'::jsonb, -- flexible permissions structure
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(show_id, user_id) -- prevent duplicate entries
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS show_organizers_show_id_idx ON public.show_organizers(show_id);
CREATE INDEX IF NOT EXISTS show_organizers_user_id_idx ON public.show_organizers(user_id);
CREATE INDEX IF NOT EXISTS show_organizers_role_idx ON public.show_organizers(role);

-- =============================================
-- 3. Create function to claim a show (enhanced version)
-- =============================================

CREATE OR REPLACE FUNCTION public.claim_show(show_id UUID, organizer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    organizer_role TEXT;
    is_already_claimed BOOLEAN;
    current_claimer UUID;
    result JSONB;
BEGIN
    -- Check if the organizer has the SHOW_ORGANIZER role
    SELECT role INTO organizer_role
    FROM public.profiles
    WHERE id = organizer_id;
    
    IF organizer_role != 'SHOW_ORGANIZER' THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Only users with SHOW_ORGANIZER role can claim shows',
            'code', 'INSUFFICIENT_PERMISSIONS'
        );
        RETURN result;
    END IF;
    
    -- Check if the show exists and is not already claimed
    SELECT 
        shows.claimed, 
        shows.claimed_by 
    INTO 
        is_already_claimed,
        current_claimer
    FROM public.shows
    WHERE id = show_id;
    
    IF is_already_claimed AND current_claimer IS NOT NULL AND current_claimer != organizer_id THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Show is already claimed by another organizer',
            'code', 'ALREADY_CLAIMED'
        );
        RETURN result;
    END IF;
    
    -- Update the show's claim status
    UPDATE public.shows
    SET 
        claimed = TRUE,
        claimed_by = claim_show.organizer_id,
        claimed_at = NOW()
    WHERE id = show_id
    RETURNING id, title, claimed, claimed_by, claimed_at 
    INTO result;
    
    -- Insert record into show_organizers table
    INSERT INTO public.show_organizers (
        show_id,
        user_id,
        role,
        permissions
    )
    VALUES (
        show_id,
        organizer_id,
        'primary',
        '{"can_edit": true, "can_delete": true, "can_broadcast": true}'::jsonb
    )
    ON CONFLICT (show_id, user_id) 
    DO UPDATE SET
        role = 'primary',
        permissions = '{"can_edit": true, "can_delete": true, "can_broadcast": true}'::jsonb,
        updated_at = NOW();
    
    -- Return success response with show data
    result := jsonb_build_object(
        'success', true,
        'message', 'Show successfully claimed',
        'data', result,
        'code', 'SUCCESS'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Error claiming show: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
        RETURN result;
END;
$$;

-- =============================================
-- 4. Create function to check if user is organizer for a show
-- =============================================

CREATE OR REPLACE FUNCTION public.is_show_organizer(p_show_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.shows s
        WHERE 
            s.id = p_show_id
            AND (
                -- Direct claim
                (s.claimed_by = p_user_id)
                OR
                -- Via show_organizers table
                EXISTS (
                    SELECT 1 
                    FROM public.show_organizers so
                    WHERE so.show_id = p_show_id AND so.user_id = p_user_id
                )
            )
    );
END;
$$;

-- =============================================
-- 5. Set up Row Level Security (RLS) policies
-- =============================================

-- Enable RLS on show_organizers table
ALTER TABLE public.show_organizers ENABLE ROW LEVEL SECURITY;

-- RLS policies for show_organizers table
CREATE POLICY show_organizers_insert_policy ON public.show_organizers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY show_organizers_select_policy ON public.show_organizers
    FOR SELECT
    USING (true);  -- Anyone can view organizer info

CREATE POLICY show_organizers_update_policy ON public.show_organizers
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY show_organizers_delete_policy ON public.show_organizers
    FOR DELETE
    USING (auth.uid() = user_id);

-- Update RLS policy for shows table to allow organizers to update their shows
CREATE POLICY shows_update_by_organizer_policy ON public.shows
    FOR UPDATE
    USING (
        auth.uid() = claimed_by
        OR 
        public.is_show_organizer(id, auth.uid())
    );

-- =============================================
-- 6. Grant necessary permissions
-- =============================================

-- Grant permissions on show_organizers
GRANT SELECT ON public.show_organizers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.show_organizers TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.claim_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_show_organizer TO authenticated;

-- =============================================
-- 7. Add helpful comments to the database
-- =============================================

COMMENT ON TABLE public.show_organizers IS 'Tracks the relationship between shows and their organizers, including roles and permissions';
COMMENT ON COLUMN public.shows.claimed IS 'Indicates if this show has been claimed by an organizer';
COMMENT ON COLUMN public.shows.claimed_by IS 'References the profile ID of the user who claimed this show';
COMMENT ON COLUMN public.shows.claimed_at IS 'Timestamp when the show was claimed';
COMMENT ON COLUMN public.show_organizers.role IS 'The role of the organizer for this show (primary, assistant, etc.)';
COMMENT ON COLUMN public.show_organizers.permissions IS 'JSON object containing specific permissions for this organizer';
COMMENT ON FUNCTION public.claim_show IS 'Function to claim ownership of a show by a show organizer with enhanced error handling';
COMMENT ON FUNCTION public.is_show_organizer IS 'Function to check if a user is an organizer for a specific show';

-- =============================================
-- 8. Analytics tracking for show claims
-- =============================================

-- Create a table to track show claim analytics
CREATE TABLE IF NOT EXISTS public.show_claim_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT,
    platform TEXT
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS show_claim_analytics_show_id_idx ON public.show_claim_analytics(show_id);
CREATE INDEX IF NOT EXISTS show_claim_analytics_user_id_idx ON public.show_claim_analytics(user_id);
CREATE INDEX IF NOT EXISTS show_claim_analytics_claimed_at_idx ON public.show_claim_analytics(claimed_at);

-- Enable RLS on show_claim_analytics table
ALTER TABLE public.show_claim_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for show_claim_analytics table
CREATE POLICY show_claim_analytics_insert_policy ON public.show_claim_analytics
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY show_claim_analytics_select_policy ON public.show_claim_analytics
    FOR SELECT
    USING (auth.uid() = user_id);

-- Grant permissions on show_claim_analytics
GRANT SELECT, INSERT ON public.show_claim_analytics TO authenticated;

COMMENT ON TABLE public.show_claim_analytics IS 'Analytics tracking for show claims by organizers';
