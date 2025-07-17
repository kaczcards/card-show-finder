-- db_migrations/add_payment_status_field.sql
-- Migration to add payment_status field to the profiles table
-- This helps distinguish between trial users and paid subscribers

-- Add payment_status column to track whether a user is in trial or has paid
ALTER TABLE public.profiles 
ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'none' 
CHECK (payment_status IN ('trial', 'paid', 'none'));

-- Add an index to improve query performance when filtering by payment_status
CREATE INDEX idx_profiles_payment_status ON public.profiles(payment_status);

-- Add comment description to the new column
COMMENT ON COLUMN public.profiles.payment_status IS 'Payment status of user: trial (free trial period), paid (paid subscription), or none (free accounts)';

-- Update existing users based on their current subscription status
UPDATE public.profiles
SET payment_status = 'paid'
WHERE subscription_status = 'active' 
AND subscription_expiry IS NOT NULL
AND account_type IN ('dealer', 'organizer');

-- Update users who are likely in trial period
-- These are users with active subscriptions who have less than 7 days remaining
-- and have never been marked as paid
UPDATE public.profiles
SET payment_status = 'trial'
WHERE subscription_status = 'active'
AND subscription_expiry IS NOT NULL
AND account_type IN ('dealer', 'organizer')
AND payment_status = 'none'
AND subscription_expiry < (NOW() + INTERVAL '7 days');

-- Instructions for applying this migration:
-- 1. Connect to your Supabase project using the SQL Editor
-- 2. Paste this SQL script into a new query
-- 3. Execute the query to apply the changes
-- 4. Verify the changes by querying the profiles table structure:
--    SELECT column_name, data_type, column_default, is_nullable 
--    FROM information_schema.columns 
--    WHERE table_name = 'profiles' AND column_name = 'payment_status';
