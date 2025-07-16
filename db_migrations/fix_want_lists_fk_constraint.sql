-- db_migrations/fix_want_lists_fk_constraint.sql
-- Fix missing foreign key relationship between want_lists.userid and profiles.id
-- This resolves the error: "Could not find a relationship between 'want_lists' and 'userid' in the schema cache"

-- Start a transaction to ensure all changes happen or none
BEGIN;

-- Create a helper function to safely drop constraints
CREATE OR REPLACE FUNCTION safe_drop_constraint(
  table_name TEXT,
  column_name TEXT,
  ref_table TEXT
) RETURNS VOID AS $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find existing foreign key constraint if any
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = table_name
    AND kcu.column_name = column_name
    AND ccu.table_name = ref_table;
  
  -- Drop constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', table_name, constraint_name);
    RAISE NOTICE 'Dropped constraint % on table %', constraint_name, table_name;
  ELSE
    RAISE NOTICE 'No foreign key constraint found on %.% referencing %', table_name, column_name, ref_table;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping constraint on %.%: %', table_name, column_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Fix want_lists.userid foreign key
DO $$
BEGIN
  -- Check if the want_lists table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') THEN
    -- Check if the userid column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'want_lists' AND column_name = 'userid') THEN
      -- 1. Safely drop any existing foreign key constraint
      PERFORM safe_drop_constraint('want_lists', 'userid', 'profiles');
      
      -- 2. Add the correct foreign key constraint
      -- First verify the profiles table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        -- Add the constraint
        ALTER TABLE public.want_lists
        ADD CONSTRAINT want_lists_userid_fkey
        FOREIGN KEY (userid)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Successfully added foreign key constraint: want_lists.userid → profiles.id';
        
        -- Add a comment explaining the constraint
        COMMENT ON CONSTRAINT want_lists_userid_fkey ON public.want_lists IS 
          'Foreign key linking want lists to user profiles. Required for proper PostgREST API joins.';
      ELSE
        RAISE NOTICE 'Table profiles does not exist. Cannot add foreign key constraint.';
      END IF;
    ELSE
      RAISE NOTICE 'Column userid does not exist in table want_lists. Cannot add foreign key constraint.';
    END IF;
  ELSE
    RAISE NOTICE 'Table want_lists does not exist. Cannot add foreign key constraint.';
  END IF;
  
  -- Check if the constraint was successfully added
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'want_lists'
      AND kcu.column_name = 'userid'
  ) THEN
    RAISE NOTICE '✓ Foreign key constraint successfully verified';
  ELSE
    RAISE NOTICE '⚠ Foreign key constraint could not be verified. Please check for errors.';
  END IF;
END;
$$;

-- Check if the auth.users table exists and if we need to add that relationship instead
DO $$
BEGIN
  -- Some Supabase setups use auth.users directly instead of profiles
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'want_lists'
      AND kcu.column_name = 'userid'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    
    RAISE NOTICE 'Attempting to create foreign key to auth.users instead...';
    
    -- Try to add constraint to auth.users
    BEGIN
      ALTER TABLE public.want_lists
      ADD CONSTRAINT want_lists_userid_auth_fkey
      FOREIGN KEY (userid)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
      
      RAISE NOTICE '✓ Successfully added foreign key constraint: want_lists.userid → auth.users.id';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠ Could not add foreign key to auth.users: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Print completion message
DO $$
BEGIN
  RAISE NOTICE '=== Foreign Key Fix Complete ===';
  RAISE NOTICE 'To verify the fix, run a query like:';
  RAISE NOTICE 'SELECT w.id, p.firstName FROM want_lists w JOIN profiles p ON w.userid = p.id LIMIT 5;';
  RAISE NOTICE 'If the query returns results without error, the fix is working.';
END;
$$;

-- Commit the transaction
COMMIT;
