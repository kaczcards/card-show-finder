# 🎯 How to Approve Pending Shows

## ❌ Don't Do This
**DON'T** manually change the `status` field in Supabase from `PENDING` to `ACTIVE`.  
This won't work! The show won't appear in the app.

## ✅ Do This Instead

You have **3 options** to approve shows:

---

## Option 1: SQL Query (Quick & Easy)

### Step 1: Find the Show ID
In Supabase, go to **Table Editor** → `scraped_shows_pending`

Copy the `id` (UUID) of the show you want to approve.

### Step 2: Run This Query
In **SQL Editor**, run:
```sql
SELECT public.approve_pending_show('YOUR-SHOW-ID-HERE');
```

Replace `YOUR-SHOW-ID-HERE` with the actual ID.

**Example:**
```sql
SELECT public.approve_pending_show('12345678-1234-1234-1234-123456789abc');
```

### Done!
The show is now:
- ✅ Moved to the `shows` table
- ✅ Status changed to `APPROVED`
- ✅ Visible in the app immediately!

---

## Option 2: Admin Web Panel (Visual)

I created a beautiful admin panel for you!

### Setup (1 minute)
1. Open `website/admin-approve.html` in your browser
2. Or add it to your WordPress site like the submission form

### Use It
1. See all pending shows in cards
2. Click **"✅ Approve & Publish"** button
3. Done! Show appears in app instantly

**Features:**
- 📱 Mobile-friendly
- 🔄 Auto-refreshes every 30 seconds  
- ✅ One-click approve
- ❌ One-click reject
- 📊 Shows count of pending submissions

---

## Option 3: Use the SQL Script (Easiest)

I created a ready-to-use script for you:

1. Open `website/approve-show-quick.sql`
2. Copy STEP 1 query → run in Supabase SQL Editor
3. Find the show ID you want
4. Copy STEP 2 query → replace the ID → run it
5. Done!

---

## Why Does This Matter?

The `approve_pending_show()` function does these important things:

1. **Copies data** from `scraped_shows_pending` to `shows` table
2. **Transforms the data** to match the `shows` table schema
3. **Sets proper status** (`APPROVED` in pending, `ACTIVE` in shows)
4. **Records who approved** and when
5. **Updates priority scores** for the source

Just changing the status field does **NONE** of this!

---

## What Happens When You Approve?

```
scraped_shows_pending table     →     shows table
┌────────────────────┐                ┌──────────────────┐
│ id: abc123         │                │ id: new-xyz      │
│ status: PENDING    │   Approve      │ status: ACTIVE   │
│ raw_payload: {...} │   ────────→    │ title: "Show"    │
│                    │                │ location: "..."   │
└────────────────────┘                │ start_date: ...   │
         ↓                            └──────────────────┘
 Status becomes:                              ↓
 APPROVED                            Appears in app! 🎉
```

---

## Quick Reference

### Approve a Show
```sql
SELECT public.approve_pending_show('SHOW-ID-HERE');
```

### Reject a Show
```sql
SELECT public.reject_pending_show('SHOW-ID-HERE', 'Reason for rejection');
```

### See All Pending
```sql
SELECT 
  id,
  raw_payload->>'name' AS show_name,
  raw_payload->>'startDate' AS date,
  status,
  created_at
FROM public.scraped_shows_pending
WHERE status = 'PENDING'
ORDER BY created_at DESC;
```

### Verify Show Was Published
```sql
SELECT * FROM public.shows
ORDER BY created_at DESC
LIMIT 5;
```

---

## Troubleshooting

**"Show still doesn't appear in app after approving"**
- Check the `shows` table - is it there?
- Check if `status = 'ACTIVE'` in shows table
- Try restarting the app
- Check if `start_date` is in the future

**"Function doesn't exist"**
- Run the migration: `supabase/migrations/20250129_admin_scraping_system_fixed.sql`
- Check if you're connected to the right database

**"Permission denied"**
- Make sure you're logged in as an admin in Supabase
- The function requires admin permissions

---

## Files Reference

- **`approve-show-quick.sql`** - Copy-paste SQL queries
- **`admin-approve.html`** - Beautiful admin panel
- **`HOW-TO-APPROVE-SHOWS.md`** - This guide

---

**Need Help?** Just ask! 🚀
