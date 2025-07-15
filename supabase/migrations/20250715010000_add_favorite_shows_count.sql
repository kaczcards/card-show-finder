-- Add favorite_shows_count column to profiles table
-- This migration addresses the error: "column profiles.favorite_shows_count does not exist"

-- Add the column with a default value of 0 if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS favorite_shows_count INTEGER NOT NULL DEFAULT 0;

-- Add a helpful comment to explain the column's purpose
COMMENT ON COLUMN public.profiles.favorite_shows_count IS 
'Count of shows favorited by this user. Automatically maintained by database triggers.';

-- Initialize the counts for existing users based on their favorites
UPDATE public.profiles p
SET favorite_shows_count = COALESCE(counts.count, 0)
FROM (
    SELECT user_id, COUNT(*) as count
    FROM public.user_favorite_shows
    GROUP BY user_id
) counts
WHERE p.id = counts.user_id;
