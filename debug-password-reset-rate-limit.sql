-- Debug Password Reset Rate Limiting Issue
-- Run this in Supabase SQL Editor to investigate the rate limit problem

-- Check recent auth events to see actual attempts
SELECT 'Recent Password Reset Attempts:' as info;
SELECT 
    event_type,
    created_at,
    ip_address,
    details->>'email' as email_attempted,
    details->>'error' as error_message
FROM auth.audit_log_entries 
WHERE event_type LIKE '%password%' 
    AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Check if there are any system-level blocks
SELECT 'Auth Event Summary (Last 24 Hours):' as info;
SELECT 
    event_type,
    COUNT(*) as attempt_count,
    MAX(created_at) as last_attempt
FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
HAVING event_type LIKE '%password%' OR event_type LIKE '%email%'
ORDER BY last_attempt DESC;

-- Check for any user-specific issues
SELECT 'User Account Status:' as info;
SELECT 
    au.email,
    au.email_confirmed_at,
    au.created_at,
    au.updated_at,
    au.last_sign_in_at
FROM auth.users au 
WHERE au.email = 'YOUR_EMAIL_HERE'  -- Replace with the email you're trying to reset
LIMIT 1;