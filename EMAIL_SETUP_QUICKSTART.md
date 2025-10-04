# 📧 Email Notifications - Quick Start Guide

## What You Get

When you approve a show, the organizer automatically receives an email like this:

> ✅ **Your show "Summer Card Show" has been approved!**
> 
> Hi John,
> 
> Great news! Your show is now live on the Card Show Finder app! 🎉
> 
> Collectors can now find your show, get notifications, and mark it as a favorite.

## Setup (5 minutes)

### Step 1: Apply the Migration

In **Supabase SQL Editor**, run:
```
card-show-finder/supabase/migrations/20250203_email_notification_on_approval.sql
```

This creates the email queue system. ✅

### Step 2: Test It (Console Mode)

Test without sending real emails:

```bash
cd /Users/kevin/card-show-finder
node scripts/send-pending-emails.js
```

This will show you what emails *would* be sent.

### Step 3: Approve a Test Show

1. Submit a test show using **your own email** as the organizer
2. Approve it in the admin panel
3. Run the script again:
   ```bash
   node scripts/send-pending-emails.js
   ```
4. You'll see the email preview in your terminal! 📧

### Step 4: Set Up Real Email Sending (Optional - Production Only)

#### Option A: Use Resend (Recommended - Free 100 emails/day)

1. Sign up at https://resend.com
2. Get your API key
3. Set environment variables:
   ```bash
   export SUPABASE_SERVICE_KEY="your-service-role-key-here"
   export EMAIL_SERVICE="resend"
   export EMAIL_API_KEY="re_xxxxxxxxxxxxx"
   export FROM_EMAIL="Card Show Finder <noreply@yourdomain.com>"
   ```
4. Run the script:
   ```bash
   node scripts/send-pending-emails.js
   ```

#### Option B: Run Automatically Every 5 Minutes

```bash
# Edit crontab
crontab -e

# Add this line (replace path)
*/5 * * * * cd /Users/kevin/card-show-finder && /usr/bin/node scripts/send-pending-emails.js >> logs/email-sender.log 2>&1
```

## How It Works

```
[Admin approves show]
         ↓
[Email queued in database]
         ↓
[Script runs] ← Every 5 minutes (or manually)
         ↓
[Email sent via Resend/SendGrid/etc]
         ↓
[Status updated to SENT]
         ↓
[Organizer receives email! 🎉]
```

## Check Email Status

```sql
-- View all emails
SELECT 
  recipient_email,
  subject,
  status,
  created_at,
  sent_at
FROM email_notifications
ORDER BY created_at DESC;

-- Count by status
SELECT status, COUNT(*) 
FROM email_notifications 
GROUP BY status;
```

## Files Created

- ✅ `supabase/migrations/20250203_email_notification_on_approval.sql` - Database setup
- ✅ `scripts/send-pending-emails.js` - Email sender script
- ✅ `docs/EMAIL_NOTIFICATIONS.md` - Full documentation
- ✅ This file - Quick start guide

## Next Steps

1. **For now**: Use console mode to see emails being queued ✅
2. **Before launch**: Set up Resend + cron job for automatic sending
3. **Customize**: Edit the email template in the `queue_approval_email()` function

## Monitoring

**See pending emails:**
```sql
SELECT * FROM pending_email_notifications;
```

**See sent emails:**
```sql
SELECT * FROM email_notifications WHERE status = 'SENT';
```

**See failed emails:**
```sql
SELECT * FROM email_notifications WHERE status = 'FAILED';
```

## Need Help?

See the full documentation: `docs/EMAIL_NOTIFICATIONS.md`

---

That's it! Your email notification system is ready. 🚀

**To test right now:**
1. Apply the migration ✅
2. Approve a show ✅
3. Run `node scripts/send-pending-emails.js` ✅
4. See the email preview! ✅
