-- All Lowercase Collection Schema Setup Script
-- This script creates tables with consistently lowercase column names
-- to avoid PostgreSQL case sensitivity issues

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- Table: user_cards
-- Description: Stores user's card collection (max 10 cards per user)
-- =======================================================
DROP TABLE IF EXISTS user_cards CASCADE;
CREATE TABLE user_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imageurl TEXT NOT NULL,
  title TEXT,
  description TEXT,
  category TEXT,
  iscompressed BOOLEAN DEFAULT FALSE,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX idx_user_cards_user_id ON user_cards(userid);

-- Add a check constraint to ensure users don't exceed 10 cards
CREATE OR REPLACE FUNCTION check_card_limit()
RETURNS TRIGGER AS $$
DECLARE
  card_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO card_count FROM user_cards WHERE userid = NEW.userid;
  
  IF TG_OP = 'INSERT' AND card_count >= 10 THEN
    RAISE EXCEPTION 'Users can have a maximum of 10 cards in their collection';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_card_limit
BEFORE INSERT ON user_cards
FOR EACH ROW
EXECUTE FUNCTION check_card_limit();

-- =======================================================
-- Table: want_lists
-- Description: Stores user's want lists
-- =======================================================
DROP TABLE IF EXISTS want_lists CASCADE;
CREATE TABLE want_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(userid) -- One want list per user
);

-- Index for faster queries by user
CREATE INDEX idx_want_lists_user_id ON want_lists(userid);

-- =======================================================
-- Check if shows table exists before creating related tables
-- =======================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shows') THEN
    -- =======================================================
    -- Table: show_participants
    -- Description: Tracks which users are attending which shows
    -- =======================================================
    DROP TABLE IF EXISTS show_participants CASCADE;
    CREATE TABLE show_participants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showid UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(userid, showid) -- Prevent duplicate attendance records
    );

    -- Indexes for faster queries
    CREATE INDEX idx_show_participants_user_id ON show_participants(userid);
    CREATE INDEX idx_show_participants_show_id ON show_participants(showid);

    -- =======================================================
    -- Table: shared_want_lists
    -- Description: Tracks want lists shared with specific shows
    -- =======================================================
    DROP TABLE IF EXISTS shared_want_lists CASCADE;
    CREATE TABLE shared_want_lists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showid UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      wantlistid UUID NOT NULL REFERENCES want_lists(id) ON DELETE CASCADE,
      sharedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(userid, showid) -- Prevent duplicate shares for the same show
    );

    -- Indexes for faster queries
    CREATE INDEX idx_shared_want_lists_user_id ON shared_want_lists(userid);
    CREATE INDEX idx_shared_want_lists_show_id ON shared_want_lists(showid);
    CREATE INDEX idx_shared_want_lists_want_list_id ON shared_want_lists(wantlistid);
  ELSE
    RAISE NOTICE 'The shows table does not exist. Skipping creation of show_participants and shared_want_lists tables.';
  END IF;
END $$;

-- =======================================================
-- Row Level Security Policies
-- =======================================================

-- Enable RLS on all tables
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_lists ENABLE ROW LEVEL SECURITY;

-- Enable RLS on show-related tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    ALTER TABLE shared_want_lists ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    ALTER TABLE show_participants ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- User Cards Policies
CREATE POLICY user_cards_select ON user_cards
  FOR SELECT USING (auth.uid() = userid);

CREATE POLICY user_cards_insert ON user_cards
  FOR INSERT WITH CHECK (auth.uid() = userid);

CREATE POLICY user_cards_update ON user_cards
  FOR UPDATE USING (auth.uid() = userid);

CREATE POLICY user_cards_delete ON user_cards
  FOR DELETE USING (auth.uid() = userid);

-- Want Lists Policies
CREATE POLICY want_lists_select ON want_lists
  FOR SELECT USING (auth.uid() = userid);

CREATE POLICY want_lists_insert ON want_lists
  FOR INSERT WITH CHECK (auth.uid() = userid);

CREATE POLICY want_lists_update ON want_lists
  FOR UPDATE USING (auth.uid() = userid);

CREATE POLICY want_lists_delete ON want_lists
  FOR DELETE USING (auth.uid() = userid);

-- Shared Want Lists Policies (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    CREATE POLICY shared_want_lists_select_own ON shared_want_lists
      FOR SELECT USING (auth.uid() = userid);

    CREATE POLICY shared_want_lists_insert ON shared_want_lists
      FOR INSERT WITH CHECK (auth.uid() = userid);

    CREATE POLICY shared_want_lists_update ON shared_want_lists
      FOR UPDATE USING (auth.uid() = userid);

    CREATE POLICY shared_want_lists_delete ON shared_want_lists
      FOR DELETE USING (auth.uid() = userid);

    -- MVP Dealers can view want lists shared for shows they're participating in
    CREATE POLICY shared_want_lists_select_dealer ON shared_want_lists
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM auth.users u
          JOIN show_participants sp ON sp.userid = auth.uid() AND sp.showid = shared_want_lists.showid
          WHERE u.role = 'mvp_dealer'
        )
      );
  END IF;
END $$;

-- Show Participants Policies (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    CREATE POLICY show_participants_select ON show_participants
      FOR SELECT USING (auth.uid() = userid);

    CREATE POLICY show_participants_insert ON show_participants
      FOR INSERT WITH CHECK (auth.uid() = userid);

    CREATE POLICY show_participants_update ON show_participants
      FOR UPDATE USING (auth.uid() = userid);

    CREATE POLICY show_participants_delete ON show_participants
      FOR DELETE USING (auth.uid() = userid);

    -- Allow users to see who else is attending a show
    CREATE POLICY show_participants_select_all ON show_participants
      FOR SELECT USING (true);
  END IF;
END $$;

-- =======================================================
-- Functions & Triggers for data maintenance
-- =======================================================

-- Function to update the updatedat timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedat = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update timestamps
CREATE TRIGGER update_user_cards_updated_at
BEFORE UPDATE ON user_cards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_want_lists_updated_at
BEFORE UPDATE ON want_lists
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to handle sharing want lists (only if related tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    
    CREATE OR REPLACE FUNCTION share_want_list(user_id UUID, show_id UUID)
    RETURNS UUID AS $$
    DECLARE
      want_list_id UUID;
      shared_id UUID;
    BEGIN
      -- Check if user has a want list
      SELECT id INTO want_list_id FROM want_lists WHERE userid = user_id;
      
      IF want_list_id IS NULL THEN
        RAISE EXCEPTION 'User does not have a want list';
      END IF;
      
      -- Check if user is attending the show
      IF NOT EXISTS (SELECT 1 FROM show_participants WHERE userid = user_id AND showid = show_id) THEN
        -- Auto-add user to show participants
        INSERT INTO show_participants (userid, showid) VALUES (user_id, show_id);
      END IF;
      
      -- Share the want list
      INSERT INTO shared_want_lists (userid, showid, wantlistid)
      VALUES (user_id, show_id, want_list_id)
      ON CONFLICT (userid, showid) DO UPDATE
      SET sharedat = NOW()
      RETURNING id INTO shared_id;
      
      RETURN shared_id;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- =======================================================
-- Storage Setup for Card Images
-- =======================================================

-- Create the storage bucket for card images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('card_images', 'Card Images', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure the bucket is public for reading
UPDATE storage.buckets
SET public = true
WHERE id = 'card_images';

-- Basic policy to allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own card images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'card_images'
);

-- Basic policy to allow users to update their own images
CREATE POLICY "Users can update their own card images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'card_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Basic policy to allow users to delete their own images
CREATE POLICY "Users can delete their own card images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'card_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all card images
CREATE POLICY "Public read access for card images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'card_images'
);
