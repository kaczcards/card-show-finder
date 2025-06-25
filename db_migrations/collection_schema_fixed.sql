-- Collection Schema Migration (Fixed)
-- This migration creates tables for user card collections, want lists, and related functionality

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- Table: user_cards
-- Description: Stores user's card collection (max 10 cards per user)
-- =======================================================
CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imageUrl TEXT NOT NULL,
  title TEXT,
  description TEXT,
  category TEXT,
  isCompressed BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(userId);

-- Add a check constraint to ensure users don't exceed 10 cards
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_card_limit') THEN
    CREATE OR REPLACE FUNCTION check_card_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      card_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO card_count FROM user_cards WHERE userId = NEW.userId;
      
      IF TG_OP = 'INSERT' AND card_count >= 10 THEN
        RAISE EXCEPTION 'Users can have a maximum of 10 cards in their collection';
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_card_limit') THEN
    CREATE TRIGGER enforce_card_limit
    BEFORE INSERT ON user_cards
    FOR EACH ROW
    EXECUTE FUNCTION check_card_limit();
  END IF;
END $$;

-- =======================================================
-- Table: want_lists
-- Description: Stores user's want lists
-- =======================================================
CREATE TABLE IF NOT EXISTS want_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(userId) -- One want list per user
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_want_lists_user_id ON want_lists(userId);

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
    CREATE TABLE IF NOT EXISTS show_participants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showId UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(userId, showId) -- Prevent duplicate attendance records
    );

    -- Indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_show_participants_user_id ON show_participants(userId);
    CREATE INDEX IF NOT EXISTS idx_show_participants_show_id ON show_participants(showId);

    -- =======================================================
    -- Table: shared_want_lists
    -- Description: Tracks want lists shared with specific shows
    -- =======================================================
    CREATE TABLE IF NOT EXISTS shared_want_lists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showId UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      wantListId UUID NOT NULL REFERENCES want_lists(id) ON DELETE CASCADE,
      sharedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(userId, showId) -- Prevent duplicate shares for the same show
    );

    -- Indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_shared_want_lists_user_id ON shared_want_lists(userId);
    CREATE INDEX IF NOT EXISTS idx_shared_want_lists_show_id ON shared_want_lists(showId);
    CREATE INDEX IF NOT EXISTS idx_shared_want_lists_want_list_id ON shared_want_lists(wantListId);
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
-- Users can only view, insert, update, and delete their own cards
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_cards_select') THEN
    CREATE POLICY user_cards_select ON user_cards
      FOR SELECT USING (auth.uid() = userId);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_cards_insert') THEN
    CREATE POLICY user_cards_insert ON user_cards
      FOR INSERT WITH CHECK (auth.uid() = userId);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_cards_update') THEN
    CREATE POLICY user_cards_update ON user_cards
      FOR UPDATE USING (auth.uid() = userId);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_cards_delete') THEN
    CREATE POLICY user_cards_delete ON user_cards
      FOR DELETE USING (auth.uid() = userId);
  END IF;
END $$;

-- Want Lists Policies
-- Users can only view, insert, update, and delete their own want lists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'want_lists_select') THEN
    CREATE POLICY want_lists_select ON want_lists
      FOR SELECT USING (auth.uid() = userId);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'want_lists_insert') THEN
    CREATE POLICY want_lists_insert ON want_lists
      FOR INSERT WITH CHECK (auth.uid() = userId);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'want_lists_update') THEN
    CREATE POLICY want_lists_update ON want_lists
      FOR UPDATE USING (auth.uid() = userId);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'want_lists_delete') THEN
    CREATE POLICY want_lists_delete ON want_lists
      FOR DELETE USING (auth.uid() = userId);
  END IF;
END $$;

-- Shared Want Lists Policies (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_want_lists') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'shared_want_lists_select_own') THEN
      CREATE POLICY shared_want_lists_select_own ON shared_want_lists
        FOR SELECT USING (auth.uid() = userId);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'shared_want_lists_insert') THEN
      CREATE POLICY shared_want_lists_insert ON shared_want_lists
        FOR INSERT WITH CHECK (auth.uid() = userId);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'shared_want_lists_update') THEN
      CREATE POLICY shared_want_lists_update ON shared_want_lists
        FOR UPDATE USING (auth.uid() = userId);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'shared_want_lists_delete') THEN
      CREATE POLICY shared_want_lists_delete ON shared_want_lists
        FOR DELETE USING (auth.uid() = userId);
    END IF;

    -- MVP Dealers can view want lists shared for shows they're participating in
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'shared_want_lists_select_dealer') THEN
      CREATE POLICY shared_want_lists_select_dealer ON shared_want_lists
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM auth.users u
            JOIN show_participants sp ON sp.userId = auth.uid() AND sp.showId = shared_want_lists.showId
            WHERE u.role = 'mvp_dealer'
          )
        );
    END IF;
  END IF;
END $$;

-- Show Participants Policies (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'show_participants_select') THEN
      CREATE POLICY show_participants_select ON show_participants
        FOR SELECT USING (auth.uid() = userId);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'show_participants_insert') THEN
      CREATE POLICY show_participants_insert ON show_participants
        FOR INSERT WITH CHECK (auth.uid() = userId);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'show_participants_update') THEN
      CREATE POLICY show_participants_update ON show_participants
        FOR UPDATE USING (auth.uid() = userId);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'show_participants_delete') THEN
      CREATE POLICY show_participants_delete ON show_participants
        FOR DELETE USING (auth.uid() = userId);
    END IF;

    -- Allow users to see who else is attending a show
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'show_participants_select_all') THEN
      CREATE POLICY show_participants_select_all ON show_participants
        FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- =======================================================
-- Functions & Triggers for data maintenance
-- =======================================================

-- Function to update the updatedAt timestamp
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updatedAt = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Add triggers to update timestamps
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_cards_updated_at') THEN
    CREATE TRIGGER update_user_cards_updated_at
    BEFORE UPDATE ON user_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_want_lists_updated_at') THEN
    CREATE TRIGGER update_want_lists_updated_at
    BEFORE UPDATE ON want_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

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
      SELECT id INTO want_list_id FROM want_lists WHERE userId = user_id;
      
      IF want_list_id IS NULL THEN
        RAISE EXCEPTION 'User does not have a want list';
      END IF;
      
      -- Check if user is attending the show
      IF NOT EXISTS (SELECT 1 FROM show_participants WHERE userId = user_id AND showId = show_id) THEN
        -- Auto-add user to show participants
        INSERT INTO show_participants (userId, showId) VALUES (user_id, show_id);
      END IF;
      
      -- Share the want list
      INSERT INTO shared_want_lists (userId, showId, wantListId)
      VALUES (user_id, show_id, want_list_id)
      ON CONFLICT (userId, showId) DO UPDATE
      SET sharedAt = NOW()
      RETURNING id INTO shared_id;
      
      RETURN shared_id;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;
