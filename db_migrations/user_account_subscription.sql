-- user_account_subscription.sql
-- Migration to add subscription-related fields to the profiles table
-- This extends the user schema to support the subscription model for dealer/organizer accounts

-- Add account_type column to distinguish between collector (free), dealer and organizer (paid) accounts
ALTER TABLE public.profiles 
ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'collector' 
CHECK (account_type IN ('collector', 'dealer', 'organizer'));

-- Add subscription_status column to track the state of paid subscriptions
ALTER TABLE public.profiles 
ADD COLUMN subscription_status VARCHAR(20) NOT NULL DEFAULT 'none' 
CHECK (subscription_status IN ('active', 'expired', 'none'));

-- Add subscription_expiry column to store when a paid subscription expires
-- This is nullable since free collector accounts won't have an expiry date
ALTER TABLE public.profiles 
ADD COLUMN subscription_expiry TIMESTAMP WITH TIME ZONE;

-- Add an index to improve query performance when filtering by account_type
CREATE INDEX idx_profiles_account_type ON public.profiles(account_type);

-- Add an index to improve query performance when filtering by subscription_status
CREATE INDEX idx_profiles_subscription_status ON public.profiles(subscription_status);

-- Add comment descriptions to the new columns
COMMENT ON COLUMN public.profiles.account_type IS 'Type of user account: collector (free), dealer or organizer (paid)';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Status of user subscription: active, expired, or none (for free accounts)';
COMMENT ON COLUMN public.profiles.subscription_expiry IS 'Date and time when the subscription expires (null for free accounts)';

-- Instructions for applying this migration:
-- 1. Connect to your Supabase project using the SQL Editor
-- 2. Paste this SQL script into a new query
-- 3. Execute the query to apply the changes
-- 4. Verify the changes by querying the profiles table structure
