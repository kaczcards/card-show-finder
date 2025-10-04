# SendGrid Troubleshooting Guide

## Issue: SendGrid Account Appears New / Emails Not Sending

If your SendGrid account was previously set up for Supabase auth emails but now appears new, here's how to investigate and fix it.

---

## Step 1: Check if Email Was Queued in Database

Run this in **Supabase SQL Editor**:

```sql
-- Check recent email notifications
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
```

**What to look for:**
- ✅ If you see emails with `status = 'PENDING'` → Email was queued, but not sent yet
- ❌ If you see emails with `status = 'FAILED'` → Check the `error_message` column
- ⚠️ If you see NO emails → The approval function didn't queue the email

---

## Step 2: Identify the SendGrid Account Issue

### Possible Scenarios:

### A) Wrong SendGrid Account
You might have multiple SendGrid accounts:
1. **Original account** - Used for Supabase Auth emails
2. **New account** - Just created

**Solution:**
- Log into SendGrid at https://app.sendgrid.com
- Check which account you're in (top-right corner shows your username/email)
- Make sure you're using the **same account** that has Supabase integration

### B) Using Supabase's SendGrid Integration
If your previous setup was through **Supabase's built-in SendGrid integration** for auth emails:
- Supabase manages that SendGrid account for you
- You don't have direct access to it
- It's **separate** from your personal SendGrid account

**Solution:**
- Use your **own SendGrid account** for approval emails
- This is separate from Supabase's auth email system
- They can coexist without conflict

### C) API Key Issues
- Old API key expired or was deleted
- API key doesn't have "Mail Send" permission
- Using wrong API key

**Solution:**
1. Go to SendGrid → Settings → API Keys
2. Create a **new API key** named `CardShowFinder-Approvals`
3. Give it **Full Access** or at minimum **Mail Send** permission
4. Copy the key (starts with `SG.`)
5. Update your environment variables

---

## Step 3: Verify Your SendGrid Setup

### Check SendGrid Dashboard

1. **Log into SendGrid**: https://app.sendgrid.com

2. **Check API Keys**:
   - Settings → API Keys
   - Do you have an active API key?
   - When was it created?
   - Does it have "Mail Send" permission?

3. **Check Activity**:
   - Click "Activity" in the left menu
   - Do you see any recent send attempts?
   - Any errors or bounces?

4. **Check Sender Authentication**:
   - Settings → Sender Authentication
   - Do you have a verified sender email or domain?
   - SendGrid requires this for sending

---

## Step 4: Fix Sender Authentication

SendGrid requires a **verified sender** to send emails. There are two options:

### Option A: Single Sender Verification (Quick)

1. Go to Settings → Sender Authentication → **Single Sender Verification**
2. Click **Create New Sender**
3. Fill in:
   - From Name: `Card Show Finder`
   - From Email: Your actual email (e.g., `you@gmail.com`)
   - Reply To: Same email
   - Company Address: Your address
4. Click **Create**
5. **Check your email** for verification link
6. Click the verification link

**Then update your FROM_EMAIL:**
```bash
export FROM_EMAIL="Card Show Finder <you@gmail.com>"
```

### Option B: Domain Authentication (Better for production)

If you have a domain (e.g., `cardshowfinder.com`):

1. Go to Settings → Sender Authentication → **Authenticate Your Domain**
2. Enter your domain
3. Follow DNS setup instructions
4. Once verified, use:
```bash
export FROM_EMAIL="Card Show Finder <noreply@cardshowfinder.com>"
```

---

## Step 5: Test Your SendGrid Connection

Create a test script to verify SendGrid works:

```bash
cd /Users/kevin/card-show-finder

# Set your environment variables
export SUPABASE_SERVICE_KEY="your-service-role-key"
export EMAIL_SERVICE="sendgrid"
export EMAIL_API_KEY="SG.your-api-key-here"
export FROM_EMAIL="Card Show Finder <your-verified-email@gmail.com>"

# Run in console mode first (no real send)
node scripts/send-pending-emails.js

# If that works, try sending for real
# (Make sure you have a pending email in the database)
node scripts/send-pending-emails.js
```

---

## Step 6: Common SendGrid Errors & Solutions

### Error: "401 Unauthorized"
**Cause:** Invalid API key

**Solution:**
1. Generate a new API key in SendGrid
2. Make sure it starts with `SG.`
3. Copy it immediately (you only see it once!)
4. Update your environment variable

### Error: "403 Forbidden"
**Cause:** 
- API key lacks "Mail Send" permission
- Or sender email not verified

**Solution:**
1. Check API key permissions in SendGrid
2. Verify your sender email/domain
3. Create new API key with Full Access

### Error: "400 Bad Request - from email not verified"
**Cause:** Sender email address not verified in SendGrid

**Solution:**
- Go to Single Sender Verification
- Add and verify your email
- Use that exact email in `FROM_EMAIL`

### Error: No error, but email not received
**Possible causes:**
- Email went to spam folder
- Recipient email typo
- SendGrid account suspended
- Rate limits exceeded

**Solution:**
1. Check spam folder
2. Check SendGrid Activity dashboard
3. Verify recipient email is correct
4. Check SendGrid account status

---

## Step 7: Supabase Auth Emails vs Approval Emails

### Understanding the Separation:

**Supabase Auth Emails** (existing):
- Managed by Supabase
- Uses Supabase's SendGrid integration
- You configured this in Supabase Dashboard → Authentication → Email Templates
- Sends: Email confirmations, password resets, magic links

**Approval Emails** (new):
- Managed by YOU
- Uses YOUR SendGrid account
- Completely separate system
- Sends: Show approval notifications to organizers

These are **independent systems** and won't conflict.

---

## Step 8: Alternative - Use Supabase for Approval Emails Too

If you want to use Supabase's email system for approval emails:

### Option: Use Supabase Edge Function + Resend

Supabase has a simpler email integration with Resend:

1. Sign up for Resend (free 100 emails/day): https://resend.com
2. Get API key from Resend
3. Use Supabase Edge Function to send emails

This is simpler and doesn't require managing SendGrid separately.

**Want to switch to Resend?** It's actually easier:
```bash
export EMAIL_SERVICE="resend"
export EMAIL_API_KEY="re_your_resend_key"
```

Resend is designed for developers and "just works" - no sender verification needed!

---

## Step 9: Quick Diagnostic Checklist

Run through this checklist:

```
□ I can log into my SendGrid account
□ My SendGrid account has at least 1 verified sender email
□ I created a new API key with "Mail Send" permission
□ I copied the API key correctly (starts with SG.)
□ My FROM_EMAIL matches a verified sender in SendGrid
□ I set all environment variables correctly
□ I ran the email script and saw output
□ I checked the email_notifications table in Supabase
□ I checked SendGrid Activity dashboard for send attempts
```

---

## Step 10: Get More Details

Run these to debug:

**1. Check what's in your database:**
```sql
SELECT * FROM email_notifications ORDER BY created_at DESC LIMIT 5;
```

**2. Run the email script with logging:**
```bash
node scripts/send-pending-emails.js 2>&1 | tee email-debug.log
```

**3. Check SendGrid Activity:**
- Go to https://app.sendgrid.com/activity
- Look for recent attempts
- Check for errors

---

## Need Help?

Share these details:
1. Output from `check-email-status.sql` queries
2. Error message from email script
3. SendGrid Activity dashboard screenshot
4. Which SendGrid account you're using (personal vs Supabase-managed)

Then I can help you debug further!

---

## Quick Fix Summary

**Most common fix:**
1. Create NEW SendGrid API key with Full Access
2. Verify a sender email in SendGrid
3. Set environment variables:
   ```bash
   export EMAIL_SERVICE="sendgrid"
   export EMAIL_API_KEY="SG.new_key_here"
   export FROM_EMAIL="Card Show Finder <your-verified-email@gmail.com>"
   export SUPABASE_SERVICE_KEY="your-service-key"
   ```
4. Test: `node scripts/send-pending-emails.js`

**Or switch to Resend** (easier):
1. Sign up at resend.com
2. Get API key
3. Set variables:
   ```bash
   export EMAIL_SERVICE="resend"
   export EMAIL_API_KEY="re_your_key"
   ```
4. Test: `node scripts/send-pending-emails.js`

Done! 🎉
