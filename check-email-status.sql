-- Check email notification status
-- Run this in Supabase SQL Editor to see what happened

-- 1. Check all email notifications
SELECT 
  id,
  recipient_email,
  subject,
  status,
  error_message,
  created_at,
  sent_at
FROM email_notifications
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check pending emails
SELECT 
  id,
  recipient_email,
  subject,
  status,
  created_at
FROM email_notifications
WHERE status = 'PENDING'
ORDER BY created_at DESC;

-- 3. Check failed emails with error details
SELECT 
  id,
  recipient_email,
  subject,
  status,
  error_message,
  created_at
FROM email_notifications
WHERE status = 'FAILED'
ORDER BY created_at DESC;

-- 4. Check if email was queued when show was approved
SELECT 
  sp.id as pending_show_id,
  sp.status as show_status,
  sp.raw_payload->>'name' as show_name,
  sp.raw_payload->>'organizerEmail' as organizer_email,
  sp.reviewed_at,
  en.id as email_id,
  en.status as email_status,
  en.error_message
FROM scraped_shows_pending sp
LEFT JOIN web_show_submissions wss ON wss.pending_show_id = sp.id
LEFT JOIN email_notifications en ON en.show_id = wss.approved_show_id
WHERE sp.status = 'APPROVED'
ORDER BY sp.reviewed_at DESC
LIMIT 5;
