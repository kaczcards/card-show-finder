-- fix-user-favorites-table.sql
-- SQL script to create the missing 'user_favorite_shows' table

-- Drop the table if it already exists to ensure a clean creation
DROP TABLE IF EXISTS public.user_favorite_shows CASCADE;

-- Create the user_favorite_shows table
CREATE TABLE public.user_favorite_shows (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (user_id, show_id) -- Composite primary key to ensure uniqueness
);

-- Add indexes for performance
CREATE INDEX ON public.user_favorite_shows (user_id);
CREATE INDEX ON public.user_favorite_shows (show_id);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE public.user_favorite_shows ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to view their own favorite shows
CREATE POLICY "Allow authenticated users to view their own favorite shows"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Allow authenticated users to insert their own favorite shows
CREATE POLICY "Allow authenticated users to insert their own favorite shows"
  ON public.user_favorite_shows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Allow authenticated users to delete their own favorite shows
CREATE POLICY "Allow authenticated users to delete their own favorite shows"
  ON public.user_favorite_shows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON public.user_favorite_shows TO authenticated;

-- Add a helpful comment to the table
COMMENT ON TABLE public.user_favorite_shows IS 'Stores user favorite shows for quick retrieval and management.';