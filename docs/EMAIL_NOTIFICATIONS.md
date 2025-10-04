# Email Notifications System

## Overview
When a show is approved, the organizer automatically receives an email notification letting them know their show is now live on the Card Show Finder app!

## How It Works

1. **Admin approves a show** via the admin panel
2. **Email is queued** in the `email_notifications` table with status `PENDING`
3. **Email sender script** processes the queue and sends emails
4. **Status is updated** to `SENT` or `FAILED`

## Database Setup

Run this migration to set up the email notification system:

```bash
# Apply the migration in Supabase SQL Editor
supabase/migrations/20250203_email_notification_on_approval.sql
```

This creates:
- ✅ `email_notifications` table to track all emails
- ✅ `queue_approval_email()` function to create email records
- ✅ Updated `approve_show_v2()` function that queues emails
- ✅ `pending_email_notifications` view for easy querying

## Email Sender Script

### Quick Start (Testing Mode)

Test the system without sending real emails:

```bash
cd card-show-finder

# Run in console mode (just prints emails, doesn't send)
node scripts/send-pending-emails.js
```

This will show you what emails would be sent without actually sending them.

### Production Setup

#### Option 1: Using Resend (Recommended - Easy & Free tier)

1. **Sign up for Resend**: https://resend.com (Free: 100 emails/day)

2. **Get your API key** from the Resend dashboard

3. **Set environment variables**:
```bash
export SUPABASE_SERVICE_KEY="your-service-role-key"
export EMAIL_SERVICE="resend"
export EMAIL_API_KEY="re_xxxxxxxxxxxxx"
export FROM_EMAIL="Card Show Finder <noreply@yourdomain.com>"
```

4. **Run the script**:
```bash
node scripts/send-pending-emails.js
```

#### Option 2: Using SendGrid

```bash
export EMAIL_SERVICE="sendgrid"
export EMAIL_API_KEY="SG.xxxxxxxxxxxxx"
# (You'll need to add SendGrid implementation to the script)
```

#### Option 3: Set up a Cron Job

Run the email sender automatically every 5 minutes:

```bash
# Edit your crontab
crontab -e

# Add this line (replace /path/to with your actual path)
*/5 * * * * cd /path/to/card-show-finder && /usr/bin/node scripts/send-pending-emails.js >> logs/email-sender.log 2>&1
```

This will:
- ✅ Check for new emails every 5 minutes
- ✅ Send any pending emails
- ✅ Log results to `logs/email-sender.log`

## Email Content

When a show is approved, the organizer receives:

**Subject**: ✅ Your show "[Show Name]" has been approved!

**Body**:
```
Hi [Organizer Name],

Great news! Your show "[Show Name]" has been approved and is now live on the Card Show Finder app! 🎉

📅 Show Date: [Date]

Collectors can now find and save your show in the app. Here's what happens next:

✅ Your show is now visible to thousands of card collectors
📱 Users will receive notifications if they're near your show
⭐ Collectors can mark your show as a favorite
🔔 They'll get reminders before your show starts

Tips for Success:
- Share your show on social media and mention it's on Card Show Finder
- Encourage attendees to leave reviews after the show
- Update your show details if anything changes

Thank you for using Card Show Finder to promote your show! We're excited to help you connect with more collectors.

Questions? Just reply to this email.

Best regards,
The Card Show Finder Team
```

## Monitoring Emails

### View all emails in database:

```sql
-- All emails
SELECT 
  id,
  recipient_email,
  subject,
  status,
  created_at,
  sent_at
FROM email_notifications
ORDER BY created_at DESC;

-- Pending emails
SELECT * FROM pending_email_notifications;

-- Failed emails
SELECT * 
FROM email_notifications 
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

### Retry failed emails:

```sql
-- Reset failed emails to pending (they'll be retried on next run)
UPDATE email_notifications
SET status = 'PENDING', error_message = NULL
WHERE status = 'FAILED';
```

## Email Services Comparison

| Service | Free Tier | Setup Difficulty | Recommended For |
|---------|-----------|------------------|-----------------|
| **Resend** | 100/day | ⭐ Easy | Small-medium apps, getting started |
| **SendGrid** | 100/day | ⭐⭐ Medium | Established apps, detailed analytics |
| **Mailgun** | 100/day | ⭐⭐ Medium | Developers, custom needs |
| **AWS SES** | 62,000/month | ⭐⭐⭐ Hard | Large scale, cost-sensitive |

**We recommend Resend** for most use cases - it's simple, reliable, and has a generous free tier.

## Customizing Email Content

To change the email template, edit the `queue_approval_email()` function:

```sql
-- Edit in Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.queue_approval_email(...)
-- Update the v_email_body variable
```

## Troubleshooting

### Emails not being sent?

1. **Check if emails are being queued**:
```sql
SELECT COUNT(*) FROM email_notifications WHERE status = 'PENDING';
```

2. **Run the sender script manually**:
```bash
node scripts/send-pending-emails.js
```

3. **Check for errors**:
```sql
SELECT * FROM email_notifications WHERE status = 'FAILED';
```

### Test with a real approval:

1. Submit a test show via the web form
2. Use your own email as the organizer email
3. Approve the show in the admin panel
4. Run the email sender: `node scripts/send-pending-emails.js`
5. Check your inbox!

## Alternative: Supabase Edge Functions

Instead of a cron job, you can use Supabase Edge Functions:

```typescript
// supabase/functions/send-emails/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Fetch pending emails
  // Send via Resend API
  // Update statuses
  return new Response("Emails processed!")
})
```

Then trigger it via:
- Supabase scheduled functions (cron)
- Webhook
- Manual trigger

## Summary

✅ **Database**: Emails are queued automatically when shows are approved  
✅ **Script**: `send-pending-emails.js` processes the queue  
✅ **Cron**: Set up to run every 5 minutes  
✅ **Service**: Use Resend (or any email service)  
✅ **Monitoring**: Track status in `email_notifications` table  

Your organizers will now get notified when their shows go live! 🎉
