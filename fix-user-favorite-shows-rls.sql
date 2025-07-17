-- fix-user-favorite-shows-rls.sql
-- SQL script to fix RLS policies on user_favorite_shows table
-- This allows MVP dealers and show organizers to view favorite shows for relevant shows

-- 1. First, check if the table exists and create it if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorite_shows') THEN
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
    
    -- Add a helpful comment to the table
    COMMENT ON TABLE public.user_favorite_shows IS 'Stores user favorite shows for quick retrieval and management.';
  END IF;
END
$$;

-- 2. Enable Row Level Security (RLS) for the table
ALTER TABLE public.user_favorite_shows ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to ensure clean creation
DROP POLICY IF EXISTS "Allow authenticated users to view their own favorite shows" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own favorite shows" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own favorite shows" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow MVP dealers to view favorite shows for shows they participate in" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow show organizers to view favorite shows for shows they organize" ON public.user_favorite_shows;

-- 4. Create RLS policies

-- Policy 1: Allow authenticated users to view their own favorite shows (existing policy)
CREATE POLICY "Allow authenticated users to view their own favorite shows"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Allow MVP dealers to view favorite shows for shows they're participating in (new policy)
CREATE POLICY "Allow MVP dealers to view favorite shows for shows they participate in"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) AND
    -- MVP dealer is participating in the show
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.userid = auth.uid()
      AND sp.showid = user_favorite_shows.show_id
    )
  );

-- Policy 3: Allow show organizers to view favorite shows for shows they organize (new policy)
CREATE POLICY "Allow show organizers to view favorite shows for shows they organize"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'show_organizer'
    ) AND
    -- User is the organizer of the show
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = user_favorite_shows.show_id
      AND s.organizer_id = auth.uid()
    )
  );

-- Policy 4: Allow authenticated users to insert their own favorite shows (existing policy)
CREATE POLICY "Allow authenticated users to insert their own favorite shows"
  ON public.user_favorite_shows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 5: Allow authenticated users to delete their own favorite shows (existing policy)
CREATE POLICY "Allow authenticated users to delete their own favorite shows"
  ON public.user_favorite_shows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON public.user_favorite_shows TO authenticated;

-- 6. Output success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for user_favorite_shows have been successfully updated.';
  RAISE NOTICE 'MVP dealers and show organizers can now view favorite shows for relevant shows.';
END
$$;
