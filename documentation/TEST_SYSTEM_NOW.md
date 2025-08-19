# TEST_SYSTEM_NOW.md
## 🚀 Instant Sanity-Check Guide (Dashboard-Only)

This short guide lets you confirm the new admin-controlled scraping pipeline is working **without installing any CLI tools**.

---

### 0. Open the Supabase Dashboard
1. Log in to your project.  
2. Keep two tabs handy:  
   • **Database → SQL Editor** (for quick queries)  
   • **Edge Functions → Logs** (live output)

---

### 1. Verify Schema & Seed Data

Paste & run in **SQL Editor**:

```sql
-- 1A. Confirm new staging & control tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'scraped_shows_pending',
    'admin_feedback',
    'scraping_sources'
);

-- 1B. Check high-priority seed URLs (should list 3 sample sites)
SELECT url, priority_score
FROM public.scraping_sources
WHERE priority_score >= 90
ORDER BY priority_score DESC;
```

You should see three rows for  
`dpmsportcards`, `tcdb`, `sportscollectorsdigest` each with `priority_score = 90`.

> 🛠️ **Heads-up — Latest Fixes Deployed (Jan 2026)**  
> • Scraper logic now **awaits** priority/error-streak RPCs → resolves the  
>   `invalid input syntax for type integer` database error.  
> • AI response cleanup improved → handles “AI didn’t return a valid JSON array”.  
> • Typical run time is **~60-120 seconds** for the three high-priority seed URLs—be patient while logs stream.

---

### 2. Ensure `GOOGLE_AI_KEY` Secret Is Present
Dashboard → **Settings → Edge Functions → Environment Variables**.  
If missing, add it then **Redeploy** `scraper-agent`.

---

### 3. Fire the Scraper (no JSON error)

Postgres’ HTTP helper expects **valid JSON** for the body argument.  
We’ll send an empty JSON object `{}` instead of an empty string.

```sql
-- Trigger scraper-agent
SELECT net.http_post(
  '$SUPABASE_URL/functions/v1/scraper-agent',
  '{}'::jsonb,                                           -- body
  '{"Content-Type":"application/json"}'::jsonb           -- headers
) AS response_json;
```

• Watch **Edge Functions → scraper-agent → Logs** for live activity.  
  (Use the new **“Stream”** toggle for real-time output.)
• A successful call returns status **200** and a body like:

```json
{ "message": "Scraper completed … Found 6 shows.", "results": [ … ] }
```

#### 👉 Alternative simpler method
1. Go to **Edge Functions → scraper-agent**  
2. Click **Redeploy** – the function auto-runs after deployment.  
3. Open the **Logs** panel (or press **Stream**) to follow progress live.  
   Expect ~1-2 minutes before the final “Scraper completed …” message appears.

---

### 4. Normalize the Raw Rows

```sql
SELECT
  (net.http_post(
    '$SUPABASE_URL/functions/v1/normalizer',
    '{}'::jsonb,
    '{"Content-Type":"application/json"}'::jsonb
  )).body;
```

Logs should show “Normalizer completed … Processed X shows”.

---

### 5. Inspect the Pending Queue

```sql
SELECT id,
       (raw_payload->>'name')                AS name,
       (normalized_json->>'startDate')       AS start_date,
       status
FROM public.scraped_shows_pending
ORDER BY created_at DESC
LIMIT 20;
```

Rows with `status = 'PENDING'` confirm the pipeline is staging data correctly.

Need deeper visibility?  Run the **diagnostic script** committed at  
`/supabase/sql/check_pending_shows.sql` (or copy its contents into the SQL Editor).  
It checks table existence, recent rows, counts per source, and more.

---

### 6. Quick Approval Test (Optional)

1. Copy an `id` from the previous query.  
2. Approve via SQL (dashboard user must be **admin**):

```sql
SELECT
  (net.http_post(
    '$SUPABASE_URL/functions/v1/admin-scraper-api/approve/<PASTE_ID>',
    '{}'::jsonb,
    format(
      '{"Authorization":"Bearer %s"}',
      auth.jwt()                       -- current dashboard session JWT
    )::jsonb
  )).body;
```

Expected body:

```json
{ "success": true, "show_id": "…" }
```

3. Confirm movement:

```sql
-- Gone from pending?
SELECT status
FROM public.scraped_shows_pending
WHERE id = '<PASTE_ID>';

-- Present in production table
SELECT title, start_date, created_at
FROM public.shows
ORDER BY created_at DESC
LIMIT 5;
```

---

### 7. Troubleshooting Quick-Reference

| Issue | Quick Check |
|-------|-------------|
| `GOOGLE_AI_KEY` error in logs | Secret missing or mis-typed → add & redeploy |
| JSON parse error in step 3 | Ensure body argument is `'{}'::jsonb`, not empty string |
| No rows in `scraped_shows_pending` | Function logs show 0 shows → site HTML changed; inspect `results` array |
| Normalizer processes 0 | Ensure rows still `status='PENDING'` & `normalized_json IS NULL` |
| Approve returns `401` | Dashboard session user isn’t admin; set `role='admin'` in `profiles` |
| `invalid input syntax for type integer` (old) | **Resolved** — redeploy pulled fix; update Supabase Edge with latest code |
| “AI didn’t return a valid JSON array” | **Resolved** — new cleanup logic; if still seen, capture log & open issue |

---

### 8. 🎉 You’re Done

You’ve validated:
1. Tables exist & seeded ✔️  
2. Scraper runs and stages raw shows ✔️  
3. Normalizer converts them ✔️  
4. Data flows to production after approval ✔️  

Your admin-controlled scraping pipeline is **live and working**. Next up: schedule the functions or build the React-Native “God Mode” UI! 🚀
