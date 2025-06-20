-- Bare Minimum Collection Setup Script
-- This script creates only the essential tables with lowercase column names
-- No complex triggers, functions, or policies - just the tables and basic indexes

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- Table: user_cards
-- Description: Stores user's card collection
-- =======================================================
CREATE TABLE IF NOT EXISTS user_cards (
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

-- Basic index for user_cards
CREATE INDEX IF NOT EXISTS idx_user_cards_userid ON user_cards(userid);

-- =======================================================
-- Table: want_lists
-- Description: Stores user's want lists
-- =======================================================
CREATE TABLE IF NOT EXISTS want_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(userid) -- One want list per user
);

-- Basic index for want_lists
CREATE INDEX IF NOT EXISTS idx_want_lists_userid ON want_lists(userid);

-- =======================================================
-- Table: show_participants
-- Description: Tracks which users are attending which shows
-- =======================================================
CREATE TABLE IF NOT EXISTS show_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  showid UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(userid, showid) -- Prevent duplicate attendance records
);

-- Basic indexes for show_participants
CREATE INDEX IF NOT EXISTS idx_show_participants_userid ON show_participants(userid);
CREATE INDEX IF NOT EXISTS idx_show_participants_showid ON show_participants(showid);

-- =======================================================
-- Table: shared_want_lists
-- Description: Tracks want lists shared with specific shows
-- =======================================================
CREATE TABLE IF NOT EXISTS shared_want_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  showid UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  wantlistid UUID NOT NULL REFERENCES want_lists(id) ON DELETE CASCADE,
  sharedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(userid, showid) -- Prevent duplicate shares for the same show
);

-- Basic indexes for shared_want_lists
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_userid ON shared_want_lists(userid);
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_showid ON shared_want_lists(showid);
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_wantlistid ON shared_want_lists(wantlistid);

-- Enable basic Row Level Security on tables
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_want_lists ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (one per table)
CREATE POLICY user_cards_policy ON user_cards FOR ALL USING (auth.uid() = userid);
CREATE POLICY want_lists_policy ON want_lists FOR ALL USING (auth.uid() = userid);
CREATE POLICY show_participants_policy ON show_participants FOR ALL USING (auth.uid() = userid);
CREATE POLICY shared_want_lists_policy ON shared_want_lists FOR ALL USING (auth.uid() = userid);

-- Create storage bucket for card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('card_images', 'Card Images', true)
ON CONFLICT (id) DO NOTHING;

-- Simple storage policy for public reading
CREATE POLICY "Public card images access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'card_images');

-- Simple storage policy for authenticated uploads
CREATE POLICY "Authenticated card image uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'card_images');
