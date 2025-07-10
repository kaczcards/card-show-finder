-- 20250710_update_favorites_count_trigger.sql
-- This migration adds a favorite_shows_count column to the profiles table
-- and creates triggers to automatically maintain this count when users
-- add or remove shows from their favorites.

-- Step 1: Add favorite_shows_count column to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'favorite_shows_count'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN favorite_shows_count INTEGER NOT NULL DEFAULT 0;
        
        COMMENT ON COLUMN public.profiles.favorite_shows_count IS 
        'Count of shows favorited by this user. Automatically maintained by database triggers.';
    END IF;
END $$;

-- Step 2: Create function to update favorite count when a show is favorited
CREATE OR REPLACE FUNCTION public.increment_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the favorite count in the profiles table
    UPDATE public.profiles
    SET favorite_shows_count = favorite_shows_count + 1,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Return the new row to complete the trigger
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create function to update favorite count when a show is unfavorited
CREATE OR REPLACE FUNCTION public.decrement_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the favorite count in the profiles table, ensuring it never goes below 0
    UPDATE public.profiles
    SET favorite_shows_count = GREATEST(0, favorite_shows_count - 1),
        updated_at = NOW()
    WHERE id = OLD.user_id;
    
    -- Return the old row to complete the trigger
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create triggers to call these functions
DROP TRIGGER IF EXISTS on_favorite_added ON public.user_favorite_shows;
CREATE TRIGGER on_favorite_added
    AFTER INSERT ON public.user_favorite_shows
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_favorite_count();

DROP TRIGGER IF EXISTS on_favorite_removed ON public.user_favorite_shows;
CREATE TRIGGER on_favorite_removed
    AFTER DELETE ON public.user_favorite_shows
    FOR EACH ROW
    EXECUTE FUNCTION public.decrement_favorite_count();

-- Step 5: Create a function to recalculate all favorite counts
-- This can be run manually to fix any inconsistencies
CREATE OR REPLACE FUNCTION public.recalculate_all_favorite_counts()
RETURNS void AS $$
BEGIN
    -- First reset all counts to 0
    UPDATE public.profiles
    SET favorite_shows_count = 0;
    
    -- Then calculate the correct counts from the user_favorite_shows table
    UPDATE public.profiles p
    SET favorite_shows_count = COALESCE(counts.count, 0)
    FROM (
        SELECT user_id, COUNT(*) as count
        FROM public.user_favorite_shows
        GROUP BY user_id
    ) counts
    WHERE p.id = counts.user_id;
    
    RAISE NOTICE 'All favorite counts have been recalculated.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Run the recalculation function to ensure all counts are correct
-- This will initialize counts for existing data
SELECT public.recalculate_all_favorite_counts();

-- Add helpful comment to the functions
COMMENT ON FUNCTION public.increment_favorite_count IS 'Automatically increments the favorite_shows_count in profiles when a show is favorited.';
COMMENT ON FUNCTION public.decrement_favorite_count IS 'Automatically decrements the favorite_shows_count in profiles when a show is unfavorited.';
COMMENT ON FUNCTION public.recalculate_all_favorite_counts IS 'Recalculates all favorite counts based on entries in the user_favorite_shows table. Run this to fix any inconsistencies.';
