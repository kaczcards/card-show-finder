-- Case-Sensitive Columns Setup Script
-- This script creates tables with properly quoted column names to preserve case sensitivity

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- Table: user_cards
-- Description: Stores user's card collection
-- =======================================================
CREATE TABLE IF NOT EXISTS user_cards (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "imageUrl" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "category" TEXT,
  "isCompressed" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards("userId");

-- =======================================================
-- Table: want_lists
-- Description: Stores user's want lists
-- =======================================================
CREATE TABLE IF NOT EXISTS want_lists (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("userId") -- One want list per user
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_want_lists_user_id ON want_lists("userId");

-- =======================================================
-- Table: show_participants
-- Description: Tracks which users are attending which shows
-- =======================================================
CREATE TABLE IF NOT EXISTS show_participants (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "showId" UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("userId", "showId") -- Prevent duplicate attendance records
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_show_participants_user_id ON show_participants("userId");
CREATE INDEX IF NOT EXISTS idx_show_participants_show_id ON show_participants("showId");

-- =======================================================
-- Table: shared_want_lists
-- Description: Tracks want lists shared with specific shows
-- =======================================================
CREATE TABLE IF NOT EXISTS shared_want_lists (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "showId" UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  "wantListId" UUID NOT NULL REFERENCES want_lists("id") ON DELETE CASCADE,
  "sharedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("userId", "showId") -- Prevent duplicate shares for the same show
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_user_id ON shared_want_lists("userId");
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_show_id ON shared_want_lists("showId");
CREATE INDEX IF NOT EXISTS idx_shared_want_lists_want_list_id ON shared_want_lists("wantListId");

-- Enable Row Level Security on tables
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_want_lists ENABLE ROW LEVEL SECURITY;

-- Basic policies to allow users to access their own data
CREATE POLICY user_cards_policy ON user_cards 
  FOR ALL USING (auth.uid() = "userId");

CREATE POLICY want_lists_policy ON want_lists 
  FOR ALL USING (auth.uid() = "userId");

CREATE POLICY show_participants_policy ON show_participants 
  FOR ALL USING (auth.uid() = "userId");

CREATE POLICY shared_want_lists_policy ON shared_want_lists 
  FOR ALL USING (auth.uid() = "userId");

-- Allow anyone to select from show_participants (to see who's attending)
CREATE POLICY show_participants_select_policy ON show_participants 
  FOR SELECT USING (true);

-- Function to update the updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
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

-- Create storage bucket for card images if it doesn't exist
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
