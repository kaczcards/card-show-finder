# 📝 Show Submission Form Setup Guide

## What You Got

A beautiful, mobile-friendly web form that allows show organizers to submit their shows directly to your Supabase database without creating an account.

## Setup Steps (5 minutes)

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon) → **API**
3. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### Step 2: Update the HTML File

1. Open `submit-show.html` in a text editor
2. Find these lines (around line 337):
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
   ```
3. Replace with your actual values:
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGc...your-actual-key-here';
   ```

### Step 3: Enable Public Inserts in Supabase

The form submits to your existing `scraped_shows_pending` table. You need to allow anonymous submissions:

1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Find the table `scraped_shows_pending`
3. Add this policy:

```sql
CREATE POLICY "Allow anonymous show submissions"
ON public.scraped_shows_pending
FOR INSERT
TO anon
WITH CHECK (true);
```

**Or run this in your SQL editor:**
```sql
-- Enable anonymous submissions to the pending shows table
CREATE POLICY IF NOT EXISTS "allow_public_show_submissions"
ON public.scraped_shows_pending
FOR INSERT
TO anon
WITH CHECK (
  status = 'PENDING' AND
  source_url IS NOT NULL AND
  raw_payload IS NOT NULL
);
```

### Step 4: Add to WordPress

**Option A: As a Full Page**
1. In WordPress, go to **Pages** → **Add New**
2. Title: "Submit Your Show"
3. Click the **"+" button** → **Custom HTML** block
4. Copy the ENTIRE contents of `submit-show.html` and paste it
5. Publish!
6. Your URL will be: `https://csfinderapp.com/submit-your-show`

**Option B: Embed in Existing Page**
1. Open the page where you want the form
2. Add a **Custom HTML** block
3. Paste the HTML code
4. Update the page

### Step 5: Test It!

1. Visit your new page
2. Fill out the form with test data
3. Click "Submit Show for Review"
4. Check Supabase:
   - Go to **Table Editor** → `scraped_shows_pending`
   - You should see your test submission with `status = 'PENDING'`

---

## How to View Submissions

### Option 1: In Supabase Dashboard
1. Go to **Table Editor**
2. Click `scraped_shows_pending`
3. Filter by `status = 'PENDING'`
4. See all new submissions!

### Option 2: Build a Simple Admin Page (Future)
We can create a simple admin page where you can:
- View all pending shows
- Click "Approve" to publish them
- Click "Reject" to decline them
- Edit details before publishing

---

## What Happens When Someone Submits?

1. **Form is submitted** → Goes to `scraped_shows_pending` table
2. **Status = PENDING** → Waiting for your approval
3. **You review it** → Check the details
4. **You approve it** → It moves to the `shows` table and appears in the app!

---

## Customization

### Change Colors
The form uses orange (`#FF6B35`). To change:
1. Search for `#FF6B35` in the HTML
2. Replace with your brand color (e.g., `#3B82F6` for blue)

### Change App Download Links
Update lines 223-224:
```html
<a href="YOUR_IOS_APP_LINK">📱 Download on iOS</a>
<a href="YOUR_ANDROID_APP_LINK">🤖 Download on Android</a>
```

### Add More Fields
To add a field (e.g., "Website URL"):
1. Add to the form:
```html
<div class="form-group">
    <label for="website">Website (Optional)</label>
    <input type="url" id="website" name="website">
</div>
```

2. Add to the JavaScript payload (around line 374):
```javascript
website: formData.get('website') || null,
```

---

## Troubleshooting

### "Something went wrong" error
- ✅ Check your Supabase URL and key are correct
- ✅ Make sure the RLS policy is created
- ✅ Check browser console (F12) for detailed errors

### Submissions not appearing
- ✅ Check the `scraped_shows_pending` table in Supabase
- ✅ Verify the RLS policy is enabled
- ✅ Make sure you're logged in as admin to view

### Form looks broken
- ✅ Make sure you copied the ENTIRE HTML file
- ✅ WordPress might be adding extra formatting - use "Custom HTML" block

---

## Next Steps

1. **✅ Set up the form** (you're here!)
2. **Build an approval dashboard** - simple admin page to approve/reject shows
3. **Add email notifications** - get notified when new shows are submitted
4. **Auto-publish certain sources** - trusted organizers get auto-approved

Want help with any of these? Let me know!

---

## Files Included

- `submit-show.html` - The main form (ready to use!)
- `SETUP-GUIDE.md` - This file

---

**Need help?** Just ask! 🚀
