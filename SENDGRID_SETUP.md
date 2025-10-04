# SendGrid Email Setup for Card Show Finder

## Quick Setup (5 minutes)

### Step 1: Get Your SendGrid API Key

1. Log into your SendGrid account: https://app.sendgrid.com
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it: `CardShowFinder-Approvals`
5. Choose **Full Access** (or at minimum: Mail Send access)
6. Copy the API key (you'll only see it once!)

### Step 2: Apply the Database Migration

In **Supabase SQL Editor**, paste and run:
```
card-show-finder/supabase/migrations/20250203_email_notification_on_approval.sql
```

### Step 3: Set Environment Variables

You need to get your **Supabase Service Role Key**:
1. Go to your Supabase Dashboard
2. Click **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key!)

Then set these environment variables:

**Option A: Export in terminal (temporary)**
```bash
export SUPABASE_URL="https://zmfqzegykwyrrvrpwylf.supabase.co"
export SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
export EMAIL_SERVICE="sendgrid"
export EMAIL_API_KEY="SG.YOUR_SENDGRID_API_KEY_HERE"
export FROM_EMAIL="Card Show Finder <noreply@cardshowfinder.com>"
```

**Option B: Create a .env file (recommended)**
```bash
cd /Users/kevin/card-show-finder
cat > .env << 'EOF'
SUPABASE_URL=https://zmfqzegykwyrrvrpwylf.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=SG.YOUR_SENDGRID_API_KEY_HERE
FROM_EMAIL=Card Show Finder <noreply@cardshowfinder.com>
EOF
```

Then create a wrapper script to load the .env file:

```bash
cat > send-emails.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export $(cat .env | xargs)
node scripts/send-pending-emails.js
EOF

chmod +x send-emails.sh
```

### Step 4: Test It!

**First, test in console mode** (no real emails sent):
```bash
cd /Users/kevin/card-show-finder
node scripts/send-pending-emails.js
```

**Then, test with SendGrid** (sends real email):
```bash
# Make sure environment variables are set!
./send-emails.sh
```

Or if you exported variables:
```bash
node scripts/send-pending-emails.js
```

### Step 5: Verify Email Domain (Optional but Recommended)

For better deliverability:

1. In SendGrid, go to **Settings** → **Sender Authentication**
2. Click **Authenticate Your Domain**
3. Follow the DNS setup instructions
4. Once verified, update your `FROM_EMAIL` to use your verified domain

Example: `FROM_EMAIL="Card Show Finder <noreply@yourdomain.com>"`

### Step 6: Set Up Automated Sending (Cron Job)

**Option A: Using the .env file wrapper**
```bash
crontab -e

# Add this line:
*/5 * * * * /Users/kevin/card-show-finder/send-emails.sh >> /Users/kevin/card-show-finder/logs/email-sender.log 2>&1
```

**Option B: Inline environment variables**
```bash
crontab -e

# Add this line (replace YOUR_KEYS):
*/5 * * * * cd /Users/kevin/card-show-finder && SUPABASE_SERVICE_KEY=your-key EMAIL_SERVICE=sendgrid EMAIL_API_KEY=SG.your-key FROM_EMAIL="Card Show Finder <noreply@cardshowfinder.com>" /usr/bin/node scripts/send-pending-emails.js >> logs/email-sender.log 2>&1
```

This will check for new emails every 5 minutes and send them automatically!

## Testing the Full Flow

1. **Submit a test show** using your own email as organizer
2. **Approve it** in the admin panel  
3. **Run the script**: `./send-emails.sh`
4. **Check your inbox!** You should receive the approval email

## Monitoring

**Check pending emails:**
```sql
SELECT * FROM email_notifications WHERE status = 'PENDING';
```

**Check sent emails:**
```sql
SELECT * FROM email_notifications WHERE status = 'SENT' ORDER BY sent_at DESC;
```

**Check failed emails:**
```sql
SELECT * FROM email_notifications WHERE status = 'FAILED';
```

**View SendGrid dashboard:**
- Go to https://app.sendgrid.com
- Click **Activity** to see all sent emails
- View delivery rates, opens, clicks, etc.

## Troubleshooting

### "401 Unauthorized" error

Your API key is wrong or expired. Get a new one from SendGrid.

### "403 Forbidden" error

Your API key doesn't have "Mail Send" permission. Create a new key with Full Access.

### Emails going to spam

1. Verify your sender domain in SendGrid
2. Set up SPF and DKIM records
3. Make sure your FROM_EMAIL uses a verified domain

### "No pending emails to send"

Email might not have been queued. Check:
```sql
SELECT * FROM email_notifications ORDER BY created_at DESC LIMIT 5;
```

If empty, the migration might not have been applied correctly.

## Email Template Customization

To change the email content, edit the SQL function:

```sql
-- In Supabase SQL Editor
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
  v_email_body TEXT;
BEGIN
  -- Customize this part:
  v_email_body := 'Hi ' || p_organizer_name || ',

Your custom message here...';

  -- Rest of function...
END;
$$;
```

## SendGrid Features You Can Use

- **Email Templates**: Create HTML templates in SendGrid
- **Analytics**: Track open rates, click rates
- **Unsubscribe Management**: Automatic unsubscribe handling
- **Bounce Handling**: Automatic bounce processing
- **Webhooks**: Get notified when emails are delivered/opened

## Cost

SendGrid Free Tier: **100 emails/day**

If you need more:
- Essentials: $19.95/mo (50k emails/mo)
- Pro: $89.95/mo (100k emails/mo)

For your use case (approval emails), the free tier should be plenty!

## Summary

✅ **Step 1**: Get SendGrid API key  
✅ **Step 2**: Apply database migration  
✅ **Step 3**: Set environment variables  
✅ **Step 4**: Test sending  
✅ **Step 5**: Set up cron job  
✅ **Done!** Approval emails will be sent automatically every 5 minutes

Your organizers will now be notified when their shows are approved! 🎉
