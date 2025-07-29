# Testing & Validation Guide  
File: **TESTING_NEXT_STEPS.md**

Welcome — this document walks you through verifying that the new admin-controlled scraping system is working end-to-end inside Supabase.

---

There is no longer an “Invoke” button in the dashboard UI.  
Use **one of the following methods** instead:

### 3-a. CURL (quickest & works everywhere)

```bash
# No auth header required – the function uses the Service-Role key set in env
curl -X POST \
  "$SUPABASE_URL/functions/v1/scraper-agent" \
  -H "Content-Type: application/json"
```

### 3-b. SQL Editor (if you prefer the dashboard)

1. Dashboard → **SQL Editor**  
2. Run:

```sql
select 'Triggering scraper…' as note,
       net.http_post(
         '$SUPABASE_URL/functions/v1/scraper-agent',
         '',          -- empty body
         '{}');       -- empty headers
```

### 3-c. Re-deploy (also triggers)
`supabase functions deploy scraper-agent` will automatically run the
function once the upload finishes – handy during development.

### 🔍 Where to see the result

* **Dashboard → Functions → scraper-agent → Logs** – real-time console output  
* Response of the cURL/SQL call – should look like:
* Edge Functions `scraper-agent`, `normalizer`, `admin-scraper-api` are deployed.  
* You are logged-in to the Supabase dashboard with an **admin** profile (role = `admin`).  
* Environment variables:  
  * `$SUPABASE_URL` – project URL  
  * `$SUPABASE_ANON_KEY` – anon key (test calls)  
  * `$ADMIN_JWT` – JWT from your admin session (for admin API tests)  

---

## 1. Verify New Tables Exist

1. Open **Dashboard → Database → Tables**.  
2. Confirm you see:
   * `scraped_shows_pending`
   * `admin_feedback`
   * `scraping_sources`
3. Click each table → **Explorer** tab → you should see the expected columns.

📸 Screenshot tip:  
Take a shot of the **Tables list** with the three new tables highlighted.

---

## 2. Check Seed Data (Priority = 90)

In the SQL editor run:

```sql
select url, priority_score, enabled
from public.scraping_sources
where priority_score >= 90
order by priority_score desc;
```

Expected rows (3):

| url (starts with) | priority_score | enabled |
|-------------------|----------------|---------|
| https://dpmsportcards.com/… | 90 | t |
| https://tcdb.com/CardShows… | 90 | t |
| https://sportscollectorsdigest.com/show-calendar | 90 | t |

If you don’t see them, run **“Refresh”** and ensure the migration really ran.

---

## 3. Trigger the Scraper Function

1. Dashboard → **Edge Functions → scraper-agent → Invoke**.  
2. Leave the body blank; headers can stay empty (function uses Service Role).  
3. Click **Invoke**.

You should receive JSON similar to:

```json
{
  "message": "Scraper completed in 18.42s. Processed 7 URLs with 5 successful scrapes. Found 12 shows.",
  "results": [
    { "url": "...dpmsportcards...", "success": true, "showCount": 4 },
    …
  ]
}
```

---

## 4. Run the Normalizer

Trigger it the same way you did the scraper:

```bash
# Optionally add ?limit=100 to process more rows
curl -X POST \
  "$SUPABASE_URL/functions/v1/normalizer?limit=100"
```

Or via SQL:

```sql
select net.http_post(
  '$SUPABASE_URL/functions/v1/normalizer',
  '', '{}');
```

Check **Functions → normalizer → Logs** for detailed output.  
Successful response example:

```json
{
  "message": "Normalizer completed in 2.01s. Processed 12 shows with 0 errors.",
  "processed": 12,
  "errors": 0
}
```

---

## 5. Test Admin API End-points

Base URL:  
`$SUPABASE_URL/functions/v1/admin-scraper-api`

Make sure **Authorization** header is set:

```
Authorization: Bearer $ADMIN_JWT
```

### 5-a List Pending Shows

```bash
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/pending?limit=10"
```

You should see an array of pending objects with `status:"PENDING"`.

### 5-b Approve One Show

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"notes":"looks good"}' \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/approve/<PENDING_ID>"
```

The response returns `{ "success": true, "show_id": "…" }`.

### 5-c Reject One Show

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"reason":"duplicate"}' \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/reject/<PENDING_ID>"
```

---

## 6. Confirm Pending Queue & Feedback

Run the “list pending” call again.  
• Approved item should now be gone.  
• In **Tables → admin_feedback** you’ll see a new row with `action='APPROVE'` or `REJECT`.

---

## 7. Verify Show Published

SQL to run in the dashboard:

```sql
select id, title, start_date, location, created_at
from public.shows
order by created_at desc
limit 10;
```

Your approved show’s **title / date / location** should appear at the top of the list.

📸 Screenshot tip:  
Take a capture of the **shows** table with your new record highlighted.

---

## Troubleshooting Checklist

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Pending rows never appear | Scraper didn’t run / AI returned no list | Re-invoke `scraper-agent`, inspect logs |
| Normalizer processed 0 | `status != PENDING` or already normalized | Check table rows; look at `normalized_json` field |
| `401 Unauthorized` on admin API | Wrong JWT / profile not `admin` | Log in with admin user and copy fresh JWT |
| Show not in `public.shows` after approve | Conflict skipped insert | Look in shows table for existing title/date combo |

---

## Next Automation Step

Add a scheduled invocation:

* **Settings → Edge Function Schedules**  
  * `scraper-agent` → every hour  
  * `normalizer` → every 15 min  

That’s it — you now have a fully test-validated, admin-controlled scraping pipeline running in production. 🎉
