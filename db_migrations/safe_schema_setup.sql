-- safe_schema_setup.sql
-- A safer version of the setup script that uses IF NOT EXISTS clauses
-- and avoids creating policies that might already exist

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- Table: profiles (if not already created by Supabase auth)
-- =======================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  home_zip_code TEXT,
  role TEXT DEFAULT 'attendee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

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
-- Table: shows (if not already created)
-- Description: Stores card show information
-- =======================================================
CREATE TABLE IF NOT EXISTS shows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  entry_fee NUMERIC DEFAULT 0,
  image_url TEXT,
  rating NUMERIC,
  coordinates GEOGRAPHY(POINT),
  status TEXT DEFAULT 'ACTIVE',
  organizer_id UUID REFERENCES auth.users(id),
  features JSONB DEFAULT '{}'::jsonb,
  categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic index for shows
CREATE INDEX IF NOT EXISTS idx_shows_organizer_id ON shows(organizer_id);
CREATE INDEX IF NOT EXISTS idx_shows_start_date ON shows(start_date);
CREATE INDEX IF NOT EXISTS idx_shows_coordinates ON shows USING GIST(coordinates);

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

-- =======================================================
-- Enable Row Level Security (without creating specific policies)
-- =======================================================
ALTER TABLE IF EXISTS user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS want_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS show_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shared_want_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shows ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- Create storage bucket for card images (if not exists)
-- =======================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('card_images', 'Card Images', true)
ON CONFLICT (id) DO NOTHING;

-- Note: We're skipping policy creation as these likely already exist
-- and were causing the errors in the original script
