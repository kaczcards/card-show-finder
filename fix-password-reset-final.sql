-- Fix Password Reset Rate Limiting in Supabase
-- Run this in Supabase SQL Editor to check and adjust rate limits

-- Check current auth rate limit settings
SELECT 'Current Auth Configuration' as info;

-- Show recent password reset attempts to understand rate limiting
SELECT 
  'Recent Auth Events (last 24 hours)' as info,
  count(*) as total_events,
  event_type,
  created_at::date as event_date
FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type LIKE '%password%'
GROUP BY event_type, created_at::date
ORDER BY created_at DESC;

-- For development/testing, you can temporarily increase rate limits:
-- Note: These are typically configured in the Supabase Dashboard under Authentication > Settings

SELECT 'Check your Supabase Dashboard -> Authentication -> Settings -> Rate Limits' as next_step;
SELECT 'Increase Email Rate Limit from default (3 per hour) to 10 per hour for testing' as suggestion;