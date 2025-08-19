# Card Show Finder – Admin Evaluation Guide
_Last updated: July 29 2025_

Welcome, Admin!  
This document explains **how to review, approve, reject, edit, and analyse pending card-show records** that the AI‐powered scraper deposits into the `scraped_shows_pending` table.

The goal is two-fold:

1. Keep the production catalogue clean and accurate.  
2. Provide structured feedback that teaches the scraper where it goes wrong so future extractions improve.

---

## 1  Overview of the Evaluation System & Workflow

```
             ┌───────────────┐
             │  Scraper-Agent│
             └──────┬────────┘
                    │  raw_payload
                    ▼
         ┌──────────────────────────┐
         │ scraped_shows_pending    │
         └──────────┬───────────────┘
   admin-review API │ (Edge Function)
                    ▼
  ┌───────────────────────────────────────────┐
  │ Admin tools (CLI • SQL • Dashboard JSON) │
  └──────────┬───────────────┬───────────────┘
             │               │
             │               ▼ admin_feedback
   approve / reject          ────────────────┐
             │                               │
             ▼                               │
┌──────────────────────────┐                 │
│  Normalizer (Edge Fn)    │◄────────┐       │
└──────────┬───────────────┘         │       │
           ▼                         │       │
    production.shows                 │       │
           │                         │       │
           ▼                         ▼       ▼
  Public Search/API        Source statistics & tuning
```

Typical loop:

1. **Scraper-Agent** pushes raw JSON for each show into `scraped_shows_pending` (status = `PENDING`).
2. **Admin** lists pending items with the **CLI** or SQL.
3. For each item (or batch):
   * Approve ➜ status `APPROVED` ➜ Normalizer moves it to `shows`.
   * Reject  ➜ status `REJECTED` and feedback recorded.
   * Edit & approve ➜ corrected payload stored, then approved.
4. **Feedback tags** drive prompt adjustments and source-specific fixes.
5. **Statistics & priority logic** promote good sources and penalise bad ones.

---

## 2  Quality Criteria & Scoring

The scraper produces an internal *quality score* (0-100). Use it as a **starting point**, not gospel.

Weighting (default):

| Field present                            | Pts |
|-----------------------------------------|-----|
| `name`                                   | 20 |
| `startDate`                              | 20 |
| `city`                                   | 15 |
| `state`                                  | 15 |
| `venueName`                              | 15 |
| `address`                                | 15 |

Quality bands:

* **80 – 100 = High** – usually approve with minimal edits.  
* **50 – 79 = Medium** – inspect, fix obvious issues, then approve/reject.  
* **0 – 49 = Low** – likely reject unless the data is salvageable.

Additional red flags:

* Date missing year (`"Aug 17"`).  
* State spelled out (“Texas” instead of “TX”).  
* Multiple events collapsed into one.  
* HTML artefacts (`<br>`, `&nbsp;`).  
* Suspicious titles (“Weekly meetup”, “Cancelled”).  

---

## 3  Using the Evaluation Tools

### 3.1 CLI (`admin-review`)

Install once:

```
npm i -g ./admin_review_cli
```

Environment:

```
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_ANON_KEY=<service_key_or_anon>
```

Key commands:

| Command                      | What it does                                                        |
|------------------------------|---------------------------------------------------------------------|
| `admin-review menu`          | Interactive menu (recommended).                                     |
| `admin-review list -l 25`    | Page through pending shows.                                         |
| `admin-review batch --min-score 80` | Bulk-approve/reject high-score records.              |
| `admin-review stats -d 14`   | View 14-day feedback and source metrics.                            |
| `admin-review duplicates`    | Step-through duplicate pairs and resolve.                           |
| `admin-review export`        | Dump pending/stats/feedback to CSV or JSON.                         |

### 3.2 Edge Function (REST)

Base URL:

```
GET/POST  {SUPABASE_URL}/functions/v1/admin-review
```

Important endpoints:

| Method | Path                    | Purpose |
|--------|-------------------------|---------|
| GET    | `/pending?limit=20`     | List queue. |
| POST   | `/approve` `{ id, feedback }` | Approve one record. |
| POST   | `/reject`  `{ id, feedback }` | Reject one. |
| POST   | `/edit`    `{ id, raw_payload, feedback }` | Save edits then approve. |
| POST   | `/batch`   `{ action, ids[], feedback }` | Approve or reject many. |
| GET    | `/stats?days=30`        | Aggregated metrics. |
| GET    | `/duplicates`           | Potential duplicate pairs. |

All requests require a **Bearer token** from an authenticated Supabase user that has `role = 'admin'`.

### 3.3 SQL

Quick snippets live in `sql/admin_quick_evaluation.sql`.  
Typical examples:

```
-- List high-quality pending shows
SELECT id, raw_payload->>'name', quality_score
FROM pending_quality_view
WHERE quality_score >= 80
ORDER BY quality_score DESC
LIMIT 50;
```

Use psql `\copy` or PgAdmin to export data for offline review.

---

## 4  Feedback Categories

| Tag                    | Use when…                                                |
|------------------------|----------------------------------------------------------|
| `DATE_FORMAT`          | Dates missing year, extra state text, wrong format.      |
| `VENUE_MISSING`        | No venue but expected (large shows).                     |
| `ADDRESS_POOR`         | Address/city/state incomplete or gibberish.              |
| `DUPLICATE`            | Same show already exists (pending or production).        |
| `MULTI_EVENT_COLLAPSE` | Multiple events merged into one record.                  |
| `EXTRA_HTML`           | HTML artefacts in text fields.                           |
| `SPAM`                 | Not a card show, cancelled, or irrelevant.               |
| `STATE_FULL`           | State spelled out (e.g., “Florida”).                     |
| `CITY_MISSING`         | City absent, though venue present.                       |

How to add:

* **CLI** – choose tags in reject prompt.  
* **SQL** – add to `admin_notes` or `admin_feedback.feedback`.  
* Combine tags with extra free-text:  
  `DATE_FORMAT, STATE_FULL - Missing year and state spelled out.`

---

## 5  Batch Processing Strategies

1. **High quality fast-track**  
   ```
   admin-review batch --min-score 85 --limit 100  # Approve
   ```
   or SQL transaction 2.2 in quick-evaluation file.

2. **Source-based approval**  
   Approve shows from a trusted calendar site:
   ```
   admin-review list --source https://reliable.com/calendar
   admin-review batch --source https://reliable.com/calendar
   ```

3. **Low quality purge**  
   Use SQL section 3 to mass-reject obviously bad rows (missing names/dates).

4. **Rolling window**  
   Work newest first to keep pipeline flowing; schedule a weekly clean-up for leftovers older than 14 days.

Safety tips:

* Always run the SELECT preview queries first.  
* Use transaction blocks (`BEGIN … ROLLBACK`) until confident, then `COMMIT`.  
* Keep batch size ≤ 100 to avoid overwhelming the normalizer.

---

## 6  Handling Duplicates & Edge Cases

### 6.1 Detection

* CLI `duplicates` menu → shows fuzzy-matched pairs (> 60 % similarity).  
* SQL section 4 has exact and trigram matching queries.

### 6.2 Resolution Choices

1. **Keep both** – if they are distinct events.  
2. **Keep newer** – approve new, reject original as `DUPLICATE`.  
3. **Reject both** – spam or ambiguous.  
4. **Merge manually** – edit one record to include missing details, then approve.

### 6.3 Edge Cases

| Case                         | Suggested action |
|------------------------------|------------------|
| Multi-day conventions split apart | Edit → combine endDate. |
| Recurring monthly show       | Keep each date as separate record. |
| “TBD” date                   | Reject `DATE_FORMAT`. |
| Venue renamed                | Approve, but note in feedback so deduper learns. |

---

## 7  Performance Monitoring & Improvement

1. **Weekly metrics** (`admin-review stats -d 7`)  
   * Approval rate target > 70 %.  
   * Track top feedback tags – fix most common first.

2. **Source health**  
   * Rejection rate > 80 % for 30 days? Automatic priority drop or disable (SQL 5.2 / 5.3).

3. **Review latency**  
   * `avg_hours_to_review` should stay < 24 h.  
   * If backlog grows > 500 shows, schedule extra review session.

4. **Model prompting**  
   * High incidence of `DATE_FORMAT` → update date-parsing regex or prompt.  
   * Frequent `MULTI_EVENT_COLLAPSE` on large pages → reduce chunk size to 50 KB.

Improvements are logged in `SCRAPER_FIXES_SUMMARY.md`.

---

## 8  Best Practices & Tips

1. **Keyboard-first** – use CLI shortcuts; opens details quickly.  
2. **Work in small slices** – 20-30 items at a time keeps focus high.  
3. **Tag consistently** – pick the closest tag even if multiple apply; consistency beats precision for analytics.  
4. **Add examples** – when rejecting, paste the bad value after the dash:  
   `ADDRESS_POOR - “123 Main St, USA” only`.  
5. **Stay source-aware** – if a site suddenly degrades, flag it to devs.  
6. **Rotate reviewers** – prevents blind-spots; use admin activity report (SQL 6.4).  
7. **Rollback is your friend** – if a bulk action feels wrong, `ROLLBACK;` before commit.  
8. **Trigger normalizer periodically** – `SELECT normalizer();` after large approval batches.  
9. **Export & spot-check** – CSV exports help catching pattern misses.  
10. **Celebrate wins** – rising approval rate means the scraper is learning!

---

### Quick Reference Cheat-Sheet

| Task                                  | CLI / SQL |
|---------------------------------------|-----------|
| See 1st page pending                  | `admin-review list` |
| Approve high-score batch              | `admin-review batch --min-score 85` |
| Reject bad date formats               | SQL 3.3 (`rejection_tag='DATE_FORMAT'`) |
| Resolve duplicates                    | `admin-review duplicates` |
| Weekly stats                          | `admin-review stats -d 7` |
| Export everything to CSV              | `admin-review export` |
| Run normalizer                        | `SELECT normalizer();` |

Happy reviewing!  Your feedback keeps Card Show Finder accurate and trusted by collectors everywhere.
