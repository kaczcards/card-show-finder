-- fix-reviews-table.sql
-- This script creates a view named 'reviews' that points to the 'show_reviews' table
-- to fix the "relation 'public.reviews' does not exist" error.

-- First, check if the show_reviews table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'show_reviews'
    ) THEN
        -- Create a view that maps to the show_reviews table
        CREATE OR REPLACE VIEW public.reviews AS
        SELECT 
            id,
            show_id,
            user_id,
            rating,
            review_text AS comment,
            favorite_dealer,
            favorite_dealer_reason,
            created_at AS date,
            updated_at
        FROM public.show_reviews;
        
        RAISE NOTICE 'Successfully created "reviews" view that points to "show_reviews" table';
    ELSE
        -- If show_reviews doesn't exist, create a new reviews table
        CREATE TABLE IF NOT EXISTS public.reviews (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            show_id UUID NOT NULL,
            user_id UUID NOT NULL,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment TEXT,
            favorite_dealer TEXT,
            favorite_dealer_reason TEXT,
            date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add foreign key constraints if possible
        BEGIN
            ALTER TABLE public.reviews 
            ADD CONSTRAINT reviews_show_id_fkey 
            FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;
            
            ALTER TABLE public.reviews 
            ADD CONSTRAINT reviews_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            
            RAISE NOTICE 'Successfully created "reviews" table with foreign key constraints';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Created "reviews" table without foreign key constraints: %', SQLERRM;
        END;
        
        -- Enable RLS for reviews
        ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
        
        -- RLS policies for reviews
        CREATE POLICY "Anyone can view reviews" 
        ON public.reviews FOR SELECT
        TO authenticated, anon
        USING (true);
        
        CREATE POLICY "Users can insert their own reviews" 
        ON public.reviews FOR INSERT
        WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own reviews" 
        ON public.reviews FOR UPDATE
        USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own reviews" 
        ON public.reviews FOR DELETE
        USING (auth.uid() = user_id);
        
        RAISE NOTICE 'Successfully created "reviews" table with RLS policies';
    END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public.reviews TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- Add helpful comment to the database
COMMENT ON TABLE public.reviews IS 'Reviews for shows - created to fix app compatibility issue';
