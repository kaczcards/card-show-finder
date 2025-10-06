-- Make user f9992c70-291d-47bb-aa5b-ef7d7ef28ca3 a Show Organizer with 90-day subscription
-- Run this in Supabase SQL Editor

-- Update user metadata with all subscription fields
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(raw_user_meta_data, '{}'::jsonb),
          '{role}',
          '"show_organizer"'
        ),
        '{accountType}',
        '"organizer"'
      ),
      '{subscriptionStatus}',
      '"active"'
    ),
    '{paymentStatus}',
    '"paid"'
  ),
  '{subscriptionExpiry}',
  to_jsonb((NOW() + INTERVAL '90 days')::text)
)
WHERE id = 'f9992c70-291d-47bb-aa5b-ef7d7ef28ca3';

-- Verify the changes
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'accountType' as account_type,
  raw_user_meta_data->>'subscriptionStatus' as subscription_status,
  raw_user_meta_data->>'paymentStatus' as payment_status,
  raw_user_meta_data->>'subscriptionExpiry' as subscription_expiry,
  (raw_user_meta_data->>'subscriptionExpiry')::timestamp - NOW() as days_remaining
FROM auth.users
WHERE id = 'f9992c70-291d-47bb-aa5b-ef7d7ef28ca3';
