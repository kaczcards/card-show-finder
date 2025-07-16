-- db_migrations/attendee_want_lists_setup.sql
-- Migration to set up tables for attendee want lists functionality
-- This allows MVP Dealers and Show Organizers to view want lists from attendees

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or update show_participants table
-- This table tracks who is participating in which shows (dealers, vendors, etc.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    CREATE TABLE public.show_participants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showid UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'attendee', -- 'attendee', 'dealer', 'vendor', etc.
      -- Dealer-specific fields
      card_types TEXT[] DEFAULT '{}',
      specialty TEXT,
      price_range VARCHAR(20) CHECK (price_range IN ('budget', 'mid-range', 'high-end')),
      notable_items TEXT,
      booth_location TEXT,
      payment_methods TEXT[] DEFAULT '{}',
      open_to_trades BOOLEAN DEFAULT FALSE,
      buying_cards BOOLEAN DEFAULT FALSE,
      status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'cancelled', 'completed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(userid, showid) -- Each user can only participate once per show
    );

    -- Add comments for clarity
    COMMENT ON TABLE public.show_participants IS 'Tracks participation of users in shows, including dealers and attendees';
    COMMENT ON COLUMN public.show_participants.role IS 'Role of the participant (attendee, dealer, vendor)';
    COMMENT ON COLUMN public.show_participants.card_types IS 'Types of cards the dealer primarily sells';
    COMMENT ON COLUMN public.show_participants.specialty IS 'Dealer''s niche or specialty';
    COMMENT ON COLUMN public.show_participants.price_range IS 'General price point range';
    COMMENT ON COLUMN public.show_participants.notable_items IS 'Hot or hard-to-find items the dealer is known for';
    COMMENT ON COLUMN public.show_participants.booth_location IS 'Information to help attendees find the dealer''s booth';
    COMMENT ON COLUMN public.show_participants.payment_methods IS 'Payment types accepted by the dealer';
    COMMENT ON COLUMN public.show_participants.open_to_trades IS 'Whether the dealer is open to trading cards';
    COMMENT ON COLUMN public.show_participants.buying_cards IS 'Whether the dealer is interested in buying cards';
    COMMENT ON COLUMN public.show_participants.status IS 'Status of the participation (registered, confirmed, cancelled, completed)';
  ELSE
    -- Add any missing columns if the table already exists
    -- This ensures backward compatibility with existing installations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'show_participants' AND column_name = 'role') THEN
      ALTER TABLE public.show_participants ADD COLUMN role TEXT NOT NULL DEFAULT 'attendee';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'show_participants' AND column_name = 'created_at') THEN
      ALTER TABLE public.show_participants ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'show_participants' AND column_name = 'updated_at') THEN
      ALTER TABLE public.show_participants ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Create indexes for show_participants table for better query performance
CREATE INDEX IF NOT EXISTS idx_show_participants_userid ON public.show_participants(userid);
CREATE INDEX IF NOT EXISTS idx_show_participants_showid ON public.show_participants(showid);
CREATE INDEX IF NOT EXISTS idx_show_participants_role ON public.show_participants(role);
CREATE INDEX IF NOT EXISTS idx_show_participants_card_types ON public.show_participants USING GIN(card_types);
CREATE INDEX IF NOT EXISTS idx_show_participants_status ON public.show_participants(status);

-- 2. Create or update planned_attendance table
-- This table tracks which shows users are planning to attend
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planned_attendance') THEN
    CREATE TABLE public.planned_attendance (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, show_id) -- Each user can only plan to attend a show once
    );
    
    COMMENT ON TABLE public.planned_attendance IS 'Tracks which shows users are planning to attend';
  END IF;
END $$;

-- Create indexes for planned_attendance table
CREATE INDEX IF NOT EXISTS idx_planned_attendance_user_id ON public.planned_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_planned_attendance_show_id ON public.planned_attendance(show_id);

-- 3. Create or update want_lists table
-- This table stores user want lists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') THEN
    CREATE TABLE public.want_lists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    COMMENT ON TABLE public.want_lists IS 'Stores user want lists for card collections';
  END IF;
END $$;

-- Create indexes for want_lists table
CREATE INDEX IF NOT EXISTS idx_want_lists_userid ON public.want_lists(userid);
CREATE INDEX IF NOT EXISTS idx_want_lists_updatedat ON public.want_lists(updatedat);

-- 4. Create or update shared_want_lists table
-- This table links want lists to shows for sharing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    CREATE TABLE public.shared_want_lists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showid UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
      wantlistid UUID NOT NULL REFERENCES public.want_lists(id) ON DELETE CASCADE,
      sharedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(userid, showid) -- Each user can only share one want list per show
    );
    
    COMMENT ON TABLE public.shared_want_lists IS 'Tracks which want lists are shared with which shows';
  END IF;
END $$;

-- Create indexes for shared_want_lists table
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_userid ON public.shared_want_lists(userid);
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_showid ON public.shared_want_lists(showid);
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_wantlistid ON public.shared_want_lists(wantlistid);

-- 5. Set up Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE public.show_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.want_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_want_lists ENABLE ROW LEVEL SECURITY;

-- RLS policies for show_participants

-- Users can view their own participation
DROP POLICY IF EXISTS show_participants_select_self ON public.show_participants;
CREATE POLICY show_participants_select_self ON public.show_participants
  FOR SELECT USING (auth.uid() = userid);

-- Show organizers can view all participants for their shows
DROP POLICY IF EXISTS show_participants_select_organizer ON public.show_participants;
CREATE POLICY show_participants_select_organizer ON public.show_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_participants.showid
      AND s.organizer_id = auth.uid()
    )
  );

-- MVP dealers can view all participants for shows they're participating in
DROP POLICY IF EXISTS show_participants_select_mvp_dealer ON public.show_participants;
CREATE POLICY show_participants_select_mvp_dealer ON public.show_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) AND
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.showid = show_participants.showid
      AND sp.userid = auth.uid()
    )
  );

-- Users can insert their own participation
DROP POLICY IF EXISTS show_participants_insert ON public.show_participants;
CREATE POLICY show_participants_insert ON public.show_participants
  FOR INSERT WITH CHECK (auth.uid() = userid);

-- Users can update their own participation
DROP POLICY IF EXISTS show_participants_update ON public.show_participants;
CREATE POLICY show_participants_update ON public.show_participants
  FOR UPDATE USING (auth.uid() = userid);

-- Users can delete their own participation
DROP POLICY IF EXISTS show_participants_delete ON public.show_participants;
CREATE POLICY show_participants_delete ON public.show_participants
  FOR DELETE USING (auth.uid() = userid);

-- RLS policies for planned_attendance

-- Users can view their own planned attendance
DROP POLICY IF EXISTS planned_attendance_select_self ON public.planned_attendance;
CREATE POLICY planned_attendance_select_self ON public.planned_attendance
  FOR SELECT USING (auth.uid() = user_id);

-- Show organizers can view all planned attendance for their shows
DROP POLICY IF EXISTS planned_attendance_select_organizer ON public.planned_attendance;
CREATE POLICY planned_attendance_select_organizer ON public.planned_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = planned_attendance.show_id
      AND s.organizer_id = auth.uid()
    )
  );

-- Users can insert their own planned attendance
DROP POLICY IF EXISTS planned_attendance_insert ON public.planned_attendance;
CREATE POLICY planned_attendance_insert ON public.planned_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own planned attendance
DROP POLICY IF EXISTS planned_attendance_delete ON public.planned_attendance;
CREATE POLICY planned_attendance_delete ON public.planned_attendance
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for want_lists

-- Users can view their own want lists
DROP POLICY IF EXISTS want_lists_select_self ON public.want_lists;
CREATE POLICY want_lists_select_self ON public.want_lists
  FOR SELECT USING (auth.uid() = userid);

-- MVP dealers can view want lists of users attending the same shows
DROP POLICY IF EXISTS want_lists_select_mvp_dealer ON public.want_lists;
CREATE POLICY want_lists_select_mvp_dealer ON public.want_lists
  FOR SELECT USING (
    -- User is an MVP dealer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) AND
    -- Want list owner is attending a show where the MVP dealer is also participating
    EXISTS (
      SELECT 1 FROM show_participants sp1
      JOIN show_participants sp2 ON sp1.showid = sp2.showid
      WHERE sp1.userid = want_lists.userid
      AND sp2.userid = auth.uid()
    )
  );

-- Show organizers can view want lists of users attending their shows
DROP POLICY IF EXISTS want_lists_select_organizer ON public.want_lists;
CREATE POLICY want_lists_select_organizer ON public.want_lists
  FOR SELECT USING (
    -- User is a show organizer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'show_organizer'
    ) AND
    -- Want list owner is attending a show organized by this user
    EXISTS (
      SELECT 1 FROM show_participants sp
      JOIN shows s ON sp.showid = s.id
      WHERE sp.userid = want_lists.userid
      AND s.organizer_id = auth.uid()
    )
  );

-- Users can insert their own want lists
DROP POLICY IF EXISTS want_lists_insert ON public.want_lists;
CREATE POLICY want_lists_insert ON public.want_lists
  FOR INSERT WITH CHECK (auth.uid() = userid);

-- Users can update their own want lists
DROP POLICY IF EXISTS want_lists_update ON public.want_lists;
CREATE POLICY want_lists_update ON public.want_lists
  FOR UPDATE USING (auth.uid() = userid);

-- Users can delete their own want lists
DROP POLICY IF EXISTS want_lists_delete ON public.want_lists;
CREATE POLICY want_lists_delete ON public.want_lists
  FOR DELETE USING (auth.uid() = userid);

-- RLS policies for shared_want_lists

-- Users can view their own shared want lists
DROP POLICY IF EXISTS shared_want_lists_select_self ON public.shared_want_lists;
CREATE POLICY shared_want_lists_select_self ON public.shared_want_lists
  FOR SELECT USING (auth.uid() = userid);

-- MVP dealers can view shared want lists for shows they're participating in
DROP POLICY IF EXISTS shared_want_lists_select_mvp_dealer ON public.shared_want_lists;
CREATE POLICY shared_want_lists_select_mvp_dealer ON public.shared_want_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) AND
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.showid = shared_want_lists.showid
      AND sp.userid = auth.uid()
    )
  );

-- Show organizers can view shared want lists for their shows
DROP POLICY IF EXISTS shared_want_lists_select_organizer ON public.shared_want_lists;
CREATE POLICY shared_want_lists_select_organizer ON public.shared_want_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = shared_want_lists.showid
      AND s.organizer_id = auth.uid()
    )
  );

-- Users can insert their own shared want lists
DROP POLICY IF EXISTS shared_want_lists_insert ON public.shared_want_lists;
CREATE POLICY shared_want_lists_insert ON public.shared_want_lists
  FOR INSERT WITH CHECK (auth.uid() = userid);

-- Users can delete their own shared want lists
DROP POLICY IF EXISTS shared_want_lists_delete ON public.shared_want_lists;
CREATE POLICY shared_want_lists_delete ON public.shared_want_lists
  FOR DELETE USING (auth.uid() = userid);

-- 6. Create function to automatically update show_participants when planned_attendance changes
CREATE OR REPLACE FUNCTION public.sync_show_participants_from_planned_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user plans to attend a show, add them to show_participants if not already there
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.show_participants (userid, showid, role, created_at, updated_at)
    VALUES (NEW.user_id, NEW.show_id, 'attendee', NOW(), NOW())
    ON CONFLICT (userid, showid) DO NOTHING;
  
  -- When a user cancels attendance, remove them from show_participants if they're an attendee
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.show_participants
    WHERE userid = OLD.user_id
    AND showid = OLD.show_id
    AND role = 'attendee';
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for the function
DROP TRIGGER IF EXISTS trigger_sync_show_participants ON public.planned_attendance;
CREATE TRIGGER trigger_sync_show_participants
AFTER INSERT OR DELETE ON public.planned_attendance
FOR EACH ROW EXECUTE FUNCTION public.sync_show_participants_from_planned_attendance();

-- 7. Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.want_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_want_lists TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 8. Create function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_update_show_participants_updated_at ON public.show_participants;
CREATE TRIGGER trigger_update_show_participants_updated_at
BEFORE UPDATE ON public.show_participants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add a comment to explain the migration
COMMENT ON TABLE public.want_lists IS 
'Stores user want lists. MVP Dealers and Show Organizers can view want lists from attendees of their shows.';
