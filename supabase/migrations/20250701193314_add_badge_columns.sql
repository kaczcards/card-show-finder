ALTER TABLE public.user_badges
ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.badges_definitions
ADD COLUMN IF NOT EXISTS requirement_count INTEGER;