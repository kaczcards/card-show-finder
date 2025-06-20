-- Basic Cards Only Setup Script
-- This script creates only the user_cards and want_lists tables
-- with no dependencies on shows table

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

-- Enable basic Row Level Security on tables
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_lists ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies
CREATE POLICY user_cards_policy ON user_cards FOR ALL USING (auth.uid() = userid);
CREATE POLICY want_lists_policy ON want_lists FOR ALL USING (auth.uid() = userid);

-- Create storage bucket for card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('card_images', 'Card Images', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure the bucket is public for reading
UPDATE storage.buckets
SET public = true
WHERE id = 'card_images';

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
