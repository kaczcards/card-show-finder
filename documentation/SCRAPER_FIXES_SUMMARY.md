# Scraper Fixes Summary (January 2026)

This document records the critical fixes applied to `supabase/functions/scraper-agent` and provides a quick-start test & maintenance guide for the new admin-controlled scraping pipeline.

---

## 1  Identified Errors & Resolutions

| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `invalid input syntax for type integer` when updating `scraping_sources` | `supabase.rpc()` calls (async **Promises**) were passed straight into the `updates` object, so Postgres received the string `"[object Promise]"` for `priority_score` / `error_streak`. | • **Await** each RPC before building the update object.<br>• Only set the field when the RPC returns a real number.<br>• Added logging for RPC failures. |
| 2 | “AI didn’t return a valid JSON array” → shows discarded | Gemini sometimes prepended prose / markdown fences or returned malformed JSON, breaking `JSON.parse`. | • Added smart cleanup: strip ```json fences, trim to first/last `[]`, regex-extract first JSON array.<br>• Enhanced prompt to stress “JSON array only”. |

### Key Code Fixes

```ts
// BEFORE (buggy)
updates.priority_score = supabase.rpc('increment_priority', { url_param: url, increment_amount: 3 });

// AFTER (fixed)
const { data: incScore } = await supabase.rpc('increment_priority', {
  url_param: url,
  increment_amount: Math.min(showCount, 5)
});
if (typeof incScore === 'number') updates.priority_score = incScore;
```

```ts
// Robust JSON extraction
if (!jsonText.startsWith('[') || !jsonText.endsWith(']')) {
  const first = jsonText.indexOf('[');
  const last  = jsonText.lastIndexOf(']');
  if (first !== -1 && last > first) jsonText = jsonText.slice(first, last + 1);
  if (!jsonText.startsWith('[')) {
    const match = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (match) jsonText = match[0];
  }
}
```

---

## 2  AI Parsing Improvements

1. **Cleaner Prompt** – explicit schema, hard “ONLY output JSON” rule.
2. **Fence Stripping** – removes ```json / ``` wrappers automatically.
3. **Bracket Trimming & Regex Fallback** – recovers the first valid array even with extra text.
4. **Graceful Empty Handling** – returns success with `showCount = 0` instead of aborting.

---

## 3  Testing the Fixed Scraper

### Option A — Dashboard Redeploy (fastest)

1. Supabase → **Edge Functions** → `scraper-agent` → **Redeploy**.  
2. Open **Logs** tab to stream progress.

### Option B — SQL HTTP helper

```sql
-- Run from SQL Editor
SELECT net.http_post(
  '$SUPABASE_URL/functions/v1/scraper-agent',
  '{}'::jsonb,                                    -- body
  '{"Content-Type":"application/json"}'::jsonb    -- headers
) AS resp;
```

### Option C — cURL (local terminal)

```bash
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/scraper-agent" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Successful JSON response:

```json
{
  "message": "Scraper completed in 31.2s. Processed 7 URLs with 6 successful scrapes. Found 18 shows.",
  "results": [ ... ]
}
```

---

## 4  Verifying Pending Shows

```sql
-- Recent pending shows
SELECT id,
       raw_payload->>'name'      AS show_name,
       raw_payload->>'startDate' AS start_date,
       source_url,
       status,
       created_at
FROM public.scraped_shows_pending
ORDER BY created_at DESC
LIMIT 20;
```

Expect rows with `status = 'PENDING'`.  
Use this count check:

```sql
SELECT COUNT(*) FROM public.scraped_shows_pending WHERE status = 'PENDING';
```

---

## 5  Admin Workflow — Next Steps

1. **Normalization Function**

```sql
SELECT net.http_post(
  '$SUPABASE_URL/functions/v1/normalizer',
  '{}'::jsonb,
  '{"Content-Type":"application/json"}'::jsonb
);
```

2. **Approve or Reject**

```sql
-- Approve
SELECT public.approve_pending_show('<pending_id>');

-- Reject
SELECT public.reject_pending_show('<pending_id>', 'Bad address');
```

3. **UI Todo**

* Build React-Native “Admin Queue” screen: list pending, show diff, approve/reject buttons.
* Add a cron (Supabase Scheduled Jobs) to run `scraper-agent` daily.

---

## 6  Maintenance Checklist

- Confirm `GOOGLE_AI_KEY` secret whenever rotating keys.
- Review **Edge Logs** weekly for new parse failures.
- Add new source URLs via `INSERT INTO public.scraping_sources(...)`.
- Re-run migrations when schema changes: `supabase db push`.

---

### Keep this document with the repo root as `SCRAPER_FIXES_SUMMARY.md` for future contributors. 🚀
