-- fix-reviews-table-v2.sql
-- This script handles the case where 'reviews' already exists as a table,
-- checking its structure and adding any missing columns needed for compatibility.

DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Check if the reviews table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reviews'
    ) THEN
        RAISE NOTICE 'Table "reviews" already exists. Checking and updating structure...';
        
        -- Check and add required columns if they don't exist
        
        -- Check for show_id column
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'show_id'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN show_id UUID';
            RAISE NOTICE 'Added missing column: show_id';
        END IF;
        
        -- Check for user_id column
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'user_id'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN user_id UUID';
            RAISE NOTICE 'Added missing column: user_id';
        END IF;
        
        -- Check for rating column
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'rating'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN rating INTEGER';
            RAISE NOTICE 'Added missing column: rating';
        END IF;
        
        -- Check for comment column (this is review_text in show_reviews)
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'comment'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN comment TEXT';
            RAISE NOTICE 'Added missing column: comment';
        END IF;
        
        -- Check for date column (this is created_at in show_reviews)
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'date'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN date TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
            RAISE NOTICE 'Added missing column: date';
        END IF;
        
        -- Check for favorite_dealer column
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'favorite_dealer'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN favorite_dealer TEXT';
            RAISE NOTICE 'Added missing column: favorite_dealer';
        END IF;
        
        -- Check for favorite_dealer_reason column
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'favorite_dealer_reason'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN favorite_dealer_reason TEXT';
            RAISE NOTICE 'Added missing column: favorite_dealer_reason';
        END IF;
        
        -- Check for userName column (needed by the app)
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'reviews'
            AND column_name = 'user_name'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            EXECUTE 'ALTER TABLE public.reviews ADD COLUMN user_name TEXT';
            RAISE NOTICE 'Added missing column: user_name';
        END IF;
        
        RAISE NOTICE 'Successfully updated "reviews" table structure';
    ELSE
        -- Create the reviews table from scratch
        CREATE TABLE public.reviews (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            show_id UUID NOT NULL,
            user_id UUID NOT NULL,
            user_name TEXT,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment TEXT,
            favorite_dealer TEXT,
            favorite_dealer_reason TEXT,
            date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Successfully created "reviews" table from scratch';
    END IF;
    
    -- Make sure RLS is enabled
    EXECUTE 'ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY';
    
    -- Check if policies exist and create them if they don't
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'reviews' 
        AND schemaname = 'public' 
        AND policyname = 'anyone_select_reviews'
    ) THEN
        EXECUTE 'CREATE POLICY "anyone_select_reviews" ON public.reviews FOR SELECT USING (true)';
        RAISE NOTICE 'Created SELECT policy for reviews';
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'reviews' 
        AND schemaname = 'public' 
        AND policyname = 'users_insert_reviews'
    ) THEN
        EXECUTE 'CREATE POLICY "users_insert_reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id)';
        RAISE NOTICE 'Created INSERT policy for reviews';
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'reviews' 
        AND schemaname = 'public' 
        AND policyname = 'users_update_reviews'
    ) THEN
        EXECUTE 'CREATE POLICY "users_update_reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id)';
        RAISE NOTICE 'Created UPDATE policy for reviews';
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'reviews' 
        AND schemaname = 'public' 
        AND policyname = 'users_delete_reviews'
    ) THEN
        EXECUTE 'CREATE POLICY "users_delete_reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id)';
        RAISE NOTICE 'Created DELETE policy for reviews';
    END IF;
    
    -- Grant permissions
    EXECUTE 'GRANT SELECT ON public.reviews TO authenticated, anon';
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated';
    
    -- Add helpful comment to the database
    COMMENT ON TABLE public.reviews IS 'Reviews for shows - updated structure for app compatibility';
END $$;

-- Verify the table exists and has the right structure
SELECT 
    table_name, 
    column_name, 
    data_type
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'reviews'
ORDER BY 
    ordinal_position;

-- Verify RLS policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM 
    pg_policies
WHERE 
    schemaname = 'public' 
    AND tablename = 'reviews';
