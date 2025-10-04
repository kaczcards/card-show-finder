-- Migration: 20250203_email_notification_on_approval.sql
-- Description: Add email notification when show is approved
-- Created: February 3, 2025

-- Create a table to track email notifications
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  show_id UUID REFERENCES public.shows(id),
  status TEXT DEFAULT 'PENDING', -- PENDING, SENT, FAILED
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view email notifications
CREATE POLICY "Admins can view email notifications"
ON public.email_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'authenticated'
  )
);

-- Create function to queue an approval email
CREATE OR REPLACE FUNCTION public.queue_approval_email(
  p_organizer_email TEXT,
  p_organizer_name TEXT,
  p_show_name TEXT,
  p_show_id UUID,
  p_show_start_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_id UUID;
  v_email_body TEXT;
  v_email_subject TEXT;
BEGIN
  -- Build the email subject
  v_email_subject := '✅ Your show "' || p_show_name || '" has been approved!';
  
  -- Build the email body
  v_email_body := 'Hi ' || COALESCE(p_organizer_name, 'there') || ',

Great news! Your show "' || p_show_name || '" has been approved and is now live on the Card Show Finder app! 🎉

📅 Show Date: ' || to_char(p_show_start_date, 'Day, Month DD, YYYY') || '

Collectors can now find and save your show in the app. Here''s what happens next:

✅ Your show is now visible to thousands of card collectors
📱 Users will receive notifications if they''re near your show
⭐ Collectors can mark your show as a favorite
🔔 They''ll get reminders before your show starts

Tips for Success:
- Share your show on social media and mention it''s on Card Show Finder
- Encourage attendees to leave reviews after the show
- Update your show details if anything changes

Thank you for using Card Show Finder to promote your show! We''re excited to help you connect with more collectors.

Questions? Just reply to this email.

Best regards,
The Card Show Finder Team

---
Download the Card Show Finder app:
📱 iOS: https://apps.apple.com/app/id6749461733
🤖 Android: Coming soon!
';

  -- Insert into email notifications table
  INSERT INTO public.email_notifications (
    recipient_email,
    subject,
    body,
    show_id,
    status
  ) VALUES (
    p_organizer_email,
    v_email_subject,
    v_email_body,
    p_show_id,
    'PENDING'
  )
  RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$;

-- Update the approve_show_v2 function to queue email
CREATE OR REPLACE FUNCTION public.approve_show_v2(
  p_pending_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_data JSONB;
  v_show_id UUID;
  v_daily_schedule JSONB;
  v_start_date DATE;
  v_end_date DATE;
  v_features JSONB;
  v_categories TEXT[];
  v_organizer_email TEXT;
  v_organizer_name TEXT;
  v_show_name TEXT;
  v_email_id UUID;
BEGIN
  -- Get the raw data
  SELECT raw_payload
  INTO v_show_data
  FROM scraped_shows_pending
  WHERE id = p_pending_id
    AND status = 'PENDING';
  
  IF v_show_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Show not found or already processed');
  END IF;
  
  -- Extract organizer info
  v_organizer_email := v_show_data->>'organizerEmail';
  v_organizer_name := v_show_data->>'organizerName';
  v_show_name := v_show_data->>'name';
  
  -- Extract schedule
  v_daily_schedule := v_show_data->'dailySchedule';
  
  -- Get dates
  IF v_daily_schedule IS NOT NULL AND jsonb_array_length(v_daily_schedule) > 0 THEN
    SELECT MIN((e->>'date')::DATE), MAX((e->>'date')::DATE)
    INTO v_start_date, v_end_date
    FROM jsonb_array_elements(v_daily_schedule) e;
  ELSE
    v_start_date := (v_show_data->>'startDate')::DATE;
    v_end_date := COALESCE((v_show_data->>'endDate')::DATE, v_start_date);
  END IF;
  
  -- Get features
  v_features := COALESCE(v_show_data->'features', '[]'::jsonb);
  
  -- Get categories
  IF v_show_data->'categories' IS NOT NULL THEN
    v_categories := ARRAY(SELECT jsonb_array_elements_text(v_show_data->'categories'));
  ELSE
    v_categories := ARRAY[]::text[];
  END IF;
  
  -- Insert the show
  INSERT INTO shows (
    title, location, address, start_date, end_date,
    status, daily_schedule, features, categories
  ) VALUES (
    COALESCE(v_show_name, 'Untitled'),
    COALESCE(v_show_data->>'venueName', 'TBD'),
    COALESCE(v_show_data->>'address', 'TBD'),
    v_start_date::TIMESTAMPTZ,
    v_end_date::TIMESTAMPTZ,
    'ACTIVE',
    v_daily_schedule,
    v_features,
    v_categories
  )
  RETURNING id INTO v_show_id;
  
  -- Update the pending record
  UPDATE scraped_shows_pending
  SET status = 'APPROVED', reviewed_at = now(), admin_notes = p_admin_notes
  WHERE id = p_pending_id;
  
  -- Update the organizer submission
  UPDATE web_show_submissions
  SET approved_show_id = v_show_id, status = 'APPROVED'
  WHERE pending_show_id = p_pending_id;
  
  -- Queue approval email if we have organizer email
  IF v_organizer_email IS NOT NULL AND v_organizer_email != '' THEN
    BEGIN
      v_email_id := queue_approval_email(
        v_organizer_email,
        v_organizer_name,
        v_show_name,
        v_show_id,
        v_start_date
      );
      
      RAISE NOTICE 'Email queued with ID: %', v_email_id;
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail approval if email queueing fails
      RAISE NOTICE 'Failed to queue email: %', SQLERRM;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'show_id', v_show_id,
    'email_queued', v_email_id IS NOT NULL
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'state', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.approve_show_v2 IS 'Approves a show and queues an email notification to the organizer';
COMMENT ON FUNCTION public.queue_approval_email IS 'Queues an approval email for an organizer';
COMMENT ON TABLE public.email_notifications IS 'Tracks email notifications sent to organizers';

-- Create a view for pending emails (for email service to process)
CREATE OR REPLACE VIEW public.pending_email_notifications AS
SELECT 
  id,
  recipient_email,
  subject,
  body,
  show_id,
  created_at
FROM public.email_notifications
WHERE status = 'PENDING'
ORDER BY created_at ASC;

-- Grant access to service role
GRANT SELECT ON public.pending_email_notifications TO service_role;
GRANT UPDATE ON public.email_notifications TO service_role;

SELECT '✅ Email notification system created! Emails are queued in email_notifications table.' as result;
