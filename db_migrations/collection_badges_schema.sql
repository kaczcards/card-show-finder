-- db_migrations/collection_badges_schema.sql
-- SQL migration for adding My Collection, Show Reviews, and Badges features

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create user_cards table for storing card images
CREATE TABLE public.user_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  category TEXT,
  is_compressed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_cards
CREATE POLICY "Users can view their own cards" 
  ON public.user_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" 
  ON public.user_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" 
  ON public.user_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" 
  ON public.user_cards FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Create user_want_lists table for storing want lists
CREATE TABLE public.user_want_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for user_want_lists
ALTER TABLE public.user_want_lists ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_want_lists
CREATE POLICY "Users can view their own want lists" 
  ON public.user_want_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own want lists" 
  ON public.user_want_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own want lists" 
  ON public.user_want_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own want lists" 
  ON public.user_want_lists FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Create show_reviews table for storing reviews and ratings
CREATE TABLE public.show_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  favorite_dealer TEXT,
  favorite_dealer_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (show_id, user_id) -- One review per show per user
);

-- Enable RLS for show_reviews
ALTER TABLE public.show_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for show_reviews
CREATE POLICY "Anyone can view show reviews" 
  ON public.show_reviews FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert their own reviews" 
  ON public.show_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
  ON public.show_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
  ON public.show_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Create badges_definitions table for storing badge information
CREATE TABLE public.badges_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  requirement TEXT NOT NULL,
  requirement_count INTEGER,
  badge_type TEXT NOT NULL,
  tier TEXT NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for badges_definitions
ALTER TABLE public.badges_definitions ENABLE ROW LEVEL SECURITY;

-- RLS policies for badges_definitions
CREATE POLICY "Anyone can view badge definitions" 
  ON public.badges_definitions FOR SELECT
  TO authenticated, anon
  USING (true);

-- Insert initial badge definitions for show attendance tiers
INSERT INTO public.badges_definitions 
  (name, description, image_url, requirement, requirement_count, badge_type, tier) 
VALUES
  ('First Show', 'Attended your first card show!', '/badges/first_show.png', 'show_attendance', 1, 'attendance', 'bronze'),
  ('Show Explorer', 'Attended 5 card shows!', '/badges/show_explorer.png', 'show_attendance', 5, 'attendance', 'silver'),
  ('Show Enthusiast', 'Attended 25 card shows!', '/badges/show_enthusiast.png', 'show_attendance', 25, 'attendance', 'gold'),
  ('Show Master', 'Attended 100 card shows!', '/badges/show_master.png', 'show_attendance', 100, 'attendance', 'platinum');

-- 5. Create user_badges table for tracking earned badges
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, badge_id) -- Each badge can only be earned once per user
);

-- Enable RLS for user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_badges
CREATE POLICY "Users can view their own badges" 
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert badges" 
  ON public.user_badges FOR INSERT
  WITH CHECK (true);

-- 6. Create planned_attendance table for tracking shows users plan to attend
CREATE TABLE public.planned_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (show_id, user_id) -- Can only plan to attend a show once
);

-- Enable RLS for planned_attendance
ALTER TABLE public.planned_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for planned_attendance
CREATE POLICY "Users can view their own planned attendance" 
  ON public.planned_attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own planned attendance" 
  ON public.planned_attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planned attendance" 
  ON public.planned_attendance FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Update profiles table to add show attendance counter
ALTER TABLE public.profiles
ADD COLUMN show_attendance_count INTEGER DEFAULT 0;

-- 8. Create function to increment show attendance counter when a review is submitted
CREATE OR REPLACE FUNCTION public.increment_show_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment the show attendance counter
  UPDATE public.profiles
  SET 
    show_attendance_count = COALESCE(show_attendance_count, 0) + 1,
    attended_shows = array_append(attended_shows, NEW.show_id)
  WHERE id = NEW.user_id;
  
  -- Check for and award attendance badges
  PERFORM public.check_and_award_attendance_badges(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function when a review is inserted
CREATE TRIGGER on_show_review_submitted
AFTER INSERT ON public.show_reviews
FOR EACH ROW
EXECUTE FUNCTION public.increment_show_attendance();

-- 9. Create function to check and award attendance badges
CREATE OR REPLACE FUNCTION public.check_and_award_attendance_badges(user_id UUID)
RETURNS VOID AS $$
DECLARE
  attendance_count INTEGER;
  badge_record RECORD;
BEGIN
  -- Get the current attendance count
  SELECT show_attendance_count INTO attendance_count
  FROM public.profiles
  WHERE id = user_id;
  
  -- Check each badge definition for attendance badges
  FOR badge_record IN 
    SELECT * FROM public.badges_definitions 
    WHERE badge_type = 'attendance'
    AND requirement = 'show_attendance'
    AND requirement_count <= attendance_count
  LOOP
    -- Insert the badge if the user doesn't already have it
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (user_id, badge_record.id)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create notification table for storing user notifications
CREATE TABLE public.user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'review_request', 'badge_earned', etc.
  reference_id UUID, -- Can reference a show, badge, etc.
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for user_notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_notifications
CREATE POLICY "Users can view their own notifications" 
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" 
  ON public.user_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 11. Create function to generate review request notifications after a show ends
CREATE OR REPLACE FUNCTION public.generate_review_requests()
RETURNS VOID AS $$
DECLARE
  show_record RECORD;
  user_record RECORD;
BEGIN
  -- Find shows that have ended in the last 24 hours
  FOR show_record IN 
    SELECT * FROM public.shows 
    WHERE end_date BETWEEN NOW() - INTERVAL '24 hours' AND NOW()
    AND status = 'ACTIVE'
  LOOP
    -- Update show status to COMPLETED
    UPDATE public.shows
    SET status = 'COMPLETED'
    WHERE id = show_record.id;
    
    -- For each user who favorited or planned to attend the show
    FOR user_record IN 
      SELECT p.id FROM public.profiles p
      WHERE show_record.id = ANY(p.favorite_shows)
      UNION
      SELECT pa.user_id FROM public.planned_attendance pa
      WHERE pa.show_id = show_record.id
    LOOP
      -- Create a notification to request a review
      INSERT INTO public.user_notifications (
        user_id, 
        title, 
        message, 
        type, 
        reference_id
      )
      VALUES (
        user_record.id,
        'How was the show?',
        'Please rate and review ' || show_record.title || ' to help other collectors!',
        'review_request',
        show_record.id
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to be called by a scheduled job (e.g., via pgcron extension)
-- This would typically be set up as a cron job to run daily
COMMENT ON FUNCTION public.generate_review_requests() IS 
  'This function should be scheduled to run daily to generate review requests for completed shows';
