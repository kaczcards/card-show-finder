-- ================================================================
-- Enable Public Show Submissions via Web Form
-- ================================================================
-- This allows anonymous users to submit shows via the web form
-- Submissions go to scraped_shows_pending table with status='PENDING'
-- Only admins can view/approve these submissions
-- ================================================================

-- Create policy to allow anonymous show submissions
CREATE POLICY IF NOT EXISTS "allow_public_show_submissions"
ON public.scraped_shows_pending
FOR INSERT
TO anon
WITH CHECK (
  -- Only allow inserts with PENDING status
  status = 'PENDING' AND
  -- Require source_url (tracks where submission came from)
  source_url IS NOT NULL AND
  -- Require raw_payload (the actual show data)
  raw_payload IS NOT NULL
);

-- Grant INSERT permission to anonymous users
GRANT INSERT ON public.scraped_shows_pending TO anon;

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'scraped_shows_pending'
  AND policyname = 'allow_public_show_submissions';

-- ================================================================
-- OPTIONAL: Add email notifications when new shows are submitted
-- ================================================================
-- Uncomment the code below if you want to get notified via email
-- when someone submits a show

/*
-- Create a function to notify admins of new submissions
CREATE OR REPLACE FUNCTION public.notify_admin_new_show()
RETURNS TRIGGER AS $$
BEGIN
  -- You can integrate with an email service here
  -- For now, we'll just raise a notice
  RAISE NOTICE 'New show submitted: %', NEW.raw_payload->>'name';
  
  -- TODO: Integrate with your email service (SendGrid, Mailgun, etc.)
  -- to send an email notification to admin
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run on new insertions
CREATE TRIGGER on_new_show_submission
  AFTER INSERT ON public.scraped_shows_pending
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_show();
*/

-- ================================================================
-- Done! Test your form now.
-- ================================================================

COMMENT ON POLICY allow_public_show_submissions ON public.scraped_shows_pending IS 
  'Allows anonymous users to submit shows via web form. Submissions are marked as PENDING for admin review.';
