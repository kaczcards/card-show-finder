-- dealer_show_participation.sql
-- Migration to add dealer-specific information to the show_participants table
-- This extends the show participation schema to support dealer-specific details

-- First, check if the show_participants table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    
    -- Add dealer-specific columns to the show_participants table
    
    -- Primary card types they sell (array to allow multiple selections)
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS card_types TEXT[] DEFAULT '{}';
    
    -- Their niche or specialty
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS specialty TEXT;
    
    -- Price point range
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS price_range VARCHAR(20) 
    CHECK (price_range IN ('budget', 'mid-range', 'high-end'));
    
    -- Notable items they're known for
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS notable_items TEXT;
    
    -- Booth location information (how to find them)
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS booth_location TEXT;
    
    -- Payment types accepted (array to allow multiple selections)
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';
    
    -- Whether they're open to trades
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS open_to_trades BOOLEAN DEFAULT FALSE;
    
    -- Whether they're buying cards
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS buying_cards BOOLEAN DEFAULT FALSE;
    
    -- Dealer status for the show
    ALTER TABLE public.show_participants 
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'registered'
    CHECK (status IN ('registered', 'confirmed', 'cancelled', 'completed'));
    
    -- Add comments to explain each column
    COMMENT ON COLUMN public.show_participants.card_types IS 'Types of cards the dealer primarily sells (e.g., vintage, modern, specific sports)';
    COMMENT ON COLUMN public.show_participants.specialty IS 'Dealer''s niche or specialty (e.g., pre-war baseball, basketball rookies)';
    COMMENT ON COLUMN public.show_participants.price_range IS 'General price point range (budget, mid-range, high-end)';
    COMMENT ON COLUMN public.show_participants.notable_items IS 'Hot or hard-to-find items the dealer is known for';
    COMMENT ON COLUMN public.show_participants.booth_location IS 'Information to help attendees find the dealer''s booth';
    COMMENT ON COLUMN public.show_participants.payment_methods IS 'Payment types accepted by the dealer';
    COMMENT ON COLUMN public.show_participants.open_to_trades IS 'Whether the dealer is open to trading cards';
    COMMENT ON COLUMN public.show_participants.buying_cards IS 'Whether the dealer is interested in buying cards';
    COMMENT ON COLUMN public.show_participants.status IS 'Status of the dealer''s participation in the show';
    
    -- Create an index to improve query performance when filtering by card types
    CREATE INDEX IF NOT EXISTS idx_show_participants_card_types ON public.show_participants USING GIN(card_types);
    
    -- Create an index for price range to help with filtering
    CREATE INDEX IF NOT EXISTS idx_show_participants_price_range ON public.show_participants(price_range);
    
    -- Create an index for status to help with filtering
    CREATE INDEX IF NOT EXISTS idx_show_participants_status ON public.show_participants(status);
    
    -- Update RLS policies to ensure dealers can only update their own information
    DROP POLICY IF EXISTS show_participants_update_dealer ON public.show_participants;
    CREATE POLICY show_participants_update_dealer ON public.show_participants
      FOR UPDATE 
      USING (auth.uid() = userid)
      WITH CHECK (auth.uid() = userid);
    
    -- Allow show organizers to view all dealer information for their shows
    DROP POLICY IF EXISTS show_participants_select_organizer ON public.show_participants;
    CREATE POLICY show_participants_select_organizer ON public.show_participants
      FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM shows s
          WHERE s.id = show_participants.showid
          AND s.organizer_id = auth.uid()
        )
      );
    
  ELSE
    RAISE NOTICE 'The show_participants table does not exist. Please run the base schema setup first.';
  END IF;
END $$;

-- Instructions for applying this migration:
-- 1. Connect to your Supabase project using the SQL Editor
-- 2. Paste this SQL script into a new query
-- 3. Execute the query to apply the changes
-- 4. Verify the changes by querying the show_participants table structure
