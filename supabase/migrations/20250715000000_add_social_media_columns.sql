-- Add social media columns to profiles table
-- Migration for Task 8: Social Media Links for Profiles & Show Pop-ups

ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "facebook_url" TEXT,
ADD COLUMN IF NOT EXISTS "instagram_url" TEXT,
ADD COLUMN IF NOT EXISTS "twitter_url" TEXT, 
ADD COLUMN IF NOT EXISTS "whatnot_url" TEXT,
ADD COLUMN IF NOT EXISTS "ebay_store_url" TEXT;

-- Add comment for these columns
COMMENT ON COLUMN "profiles"."facebook_url" IS 'Facebook profile URL for the user';
COMMENT ON COLUMN "profiles"."instagram_url" IS 'Instagram profile URL for the user';
COMMENT ON COLUMN "profiles"."twitter_url" IS 'Twitter/X profile URL for the user';
COMMENT ON COLUMN "profiles"."whatnot_url" IS 'Whatnot store URL (for dealers)';
COMMENT ON COLUMN "profiles"."ebay_store_url" IS 'eBay store URL (for dealers)';

-- These are nullable columns, no need to update existing records
