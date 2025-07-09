-- Create the table for badge definitions
CREATE TABLE IF NOT EXISTS public.badges_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the table for user-specific badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  badge_id UUID REFERENCES public.badges_definitions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);