# Admin-Controlled Scraping System – Technical Architecture  
File: `ADMIN_SCRAPER_ARCHITECTURE.md`

---

## 1. Current State Assessment

| Aspect | Status | Notes |
|-------|--------|-------|
| Edge Function | `scraper-agent` | • Processes 7 random URLs/run<br>• Uses Gemini 1.5 Flash for HTML → JSON extraction<br>• Directly UPSERTs into `public.shows` |
| Data Validation | Minimal | Only dedup on `(name,start_date,city)` |
| Admin Workflow | None | All inserted rows go live instantly |
| Geocoding | Manual ad-hoc scripts | No automatic call in scraper |
| Monitoring & Logs | Console logs only | No structured logging, no alerting |

---

## 2. Enhanced Architecture Overview

```
┌────────────┐        ┌───────────────┐        ┌─────────────────┐
│ Edge Fn:   │ HTML   │ Edge Fn:      │ JSON   │ Edge Fn:        │
│ scraper    │───►    │ normalizer    │───►    │ geocoder        │
└────────────┘        └───────────────┘        └─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────┐
|   scraped_shows_pending  (staging)                        |
└────────────────────────────────────────────────────────────┘
       │ (admin reviews)              ▲ feedback / status
       ▼                               │
┌────────────────┐  PATCH/POST  ┌───────────────────────┐
│ Admin “God UI” │◄────────────►│ Edge Fn: admin_api    │
└────────────────┘              └───────────────────────┘
                                         │ APPROVED
                                         ▼
                                 ┌──────────────────┐
                                 │ public.shows     │
                                 └──────────────────┘
```

*Learning Engine* reads `admin_feedback` + scrape stats to reprioritise `scraping_sources`.

---

## 3. Database Schema Additions

```sql
-- 1. Staging table
CREATE TABLE public.scraped_shows_pending (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_url       TEXT NOT NULL,
  raw_payload      JSONB NOT NULL,                -- AI extracted object
  normalized_json  JSONB,                         -- post-normalization
  geocoded_json    JSONB,                         -- coords + parsed addr
  status           TEXT DEFAULT 'PENDING',        -- PENDING | APPROVED | REJECTED
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  reviewed_at      TIMESTAMPTZ
);

-- 2. Admin feedback log
CREATE TABLE public.admin_feedback (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pending_id    UUID REFERENCES scraped_shows_pending(id),
  admin_id      UUID REFERENCES profiles(id),
  action        TEXT,                 -- approve / reject / edit
  feedback      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Scraping sources master list
CREATE TABLE public.scraping_sources (
  url                 TEXT PRIMARY KEY,
  priority_score      INT DEFAULT 50,   -- 0-100, higher runs sooner
  last_success_at     TIMESTAMPTZ,
  last_error_at       TIMESTAMPTZ,
  error_streak        INT DEFAULT 0,
  notes               TEXT
);
```

Indexes:  
* `CREATE INDEX ON scraped_shows_pending(status, created_at DESC);`  
* `CREATE INDEX ON admin_feedback(pending_id);`

---

## 4. Required Edge Functions (Deno)

1. **`scraper-agent` (reworked)**  
   • Pulls `url` queue from `scraping_sources` ordered by `priority_score DESC, last_success_at NULLS FIRST`.  
   • Fetch HTML, send to AI, write row in `scraped_shows_pending` (`raw_payload`).  
   • Update `scraping_sources` stats.

2. **`normalizer` (new)**  
   • Triggered via Supabase Function Scheduler on new `scraped_shows_pending` rows.  
   • Cleans dates, splits multi-day, parses address → `normalized_json`.  

3. **`geocoder` (new)**  
   • Batch resolves lat/lng using existing `create_geography_point` or external API.  
   • Writes result into `geocoded_json`.

4. **`admin_api` (new)**  
   REST-ish handler for admin UI:
   - `GET /pending?status=PENDING` – list
   - `POST /approve/:id` – moves data to `public.shows`
   - `POST /reject/:id` – marks rejected
   - `PATCH /edit/:id` – update `normalized_json` fields  
   All calls log into `admin_feedback`.

5. **`learning-agent` (new, low frequency)**  
   • Aggregates `admin_feedback`, success rates, geocoding failures.  
   • Adjusts `scraping_sources.priority_score` (e.g., +5 for approved row; ‑3 for reject).

---

## 5. Admin Interface (“God Mode”)

React / Expo Web or simple Next.js page secured by Supabase Auth role=ADMIN.

Main Views:
1. Pending Queue (table + filters)
2. Detail Drawer  
   - Raw, Normalized, Map preview  
   - Approve / Reject / Edit & Approve
3. Source Analytics dashboard  
   - Success %, error streak, priority slider
4. Settings  
   - Toggle auto-approve rules (e.g., trusted sources)

Required API endpoints enumerated in §4.

---

## 6. Intelligent Expansion & Learning

Algorithm outline:

```
score = base + (approved_shows * 2) - (rejected_shows * 3) - error_streak
if score < 0 => temporarily disable
```

Sources with score > 80 shift to **TRUSTED** bucket enabling optional auto-approve.

Future: use LLM classification of new links found in scraped HTML to auto-insert into `scraping_sources`.

---

## 7. Deduplication & Recurring Show Handling

1. **Pre-Insert Check**  
   ```sql
   ON CONFLICT (title, start_date, city) DO UPDATE
   ```
2. **Recurring Detection**  
   - Hash `(title, venue_name, city)`  
   - If new date within ±7 days of existing recurring series → attach to same `series_id`.  
   - Admin UI shows suggestions (“Looks like part of ‘Monthly Tacoma Show’ series. Confirm?”).

3. **Canonical Show Series Table** (already exists `show_series`) – leverage.

---

## 8. Integration Points

| Component | Method | Notes |
|-----------|--------|-------|
| Supabase Auth | RLS | Only role `admin` can SELECT/UPDATE `scraped_shows_pending` |
| Supabase Storage | optional | store screenshot of page for audit |
| PostGIS | coordinates | continue using `create_geography_point` |
| Edge Runtime | Deno | keep timeouts < 30s; heavy AI requests offloaded by function scheduler |
| External APIs | Google Maps (geocode) • Gemini/OpenAI (extract) |

---

## 9. Implementation Phases

| Phase | Scope | Success Metric |
|-------|-------|----------------|
| 0 ‑ Prototype (Done) | Existing `scraper-agent` | Inserts operate |
| 1. MVP | Staging table + Manual Admin Approve for 3 seed sites | Admin can approve rows, no production leaks |
| 2. Automation | Add normalizer, geocoder, dedup logic | 90% approved rows need no manual edits |
| 3. Learning v1 | `learning-agent`, dynamic priority | High-yield sites run daily, low yield weekly |
| 4. Expansion | Auto-discover new sites from known pages | +30 new quality sources added automatically |
| 5. Trusted Auto-Publish | Selected sites bypass manual step | <1% erroneous shows live |

---

## 10. Security & Access Control

1. **RLS Policies**
   ```sql
   ALTER TABLE scraped_shows_pending ENABLE RLS;
   CREATE POLICY admin_all ON scraped_shows_pending
     FOR ALL USING (is_admin());
   ```
2. **Edge Function Secrets**  
   • `SERVICE_ROLE` key only inside Edge functions.  
   • AI & Maps API keys via environment vars.

3. **Audit Trail**  
   • `admin_feedback` immutable; ALL changes captured.  
   • Supabase `realtime` broadcasts to admin UI for live queue updates.

4. **Rate Limits & Bot Detection**  
   • Respect robots.txt; back-off; `scraping_sources.error_streak`.

5. **Monitoring**  
   • Edge logs → Supabase Logflare;  
   • Alerts on ≥5 consecutive failures for any source.

---

## Error Handling & Observability

| Stage | Failure Mode | Strategy |
|-------|--------------|----------|
| Fetch HTML | Timeout / 4xx / 5xx | Increment `error_streak`, store `error_at` |
| AI Extraction | Non-JSON / empty | Flag `status='EXTRACT_ERROR'`, send Slack alert |
| Geocoder | Zero results | Keep row in PENDING, highlight “Needs address fix” |
| DB Upsert | Constraint violation | Log; mark row `status='DUPLICATE'` |

---

### Appendix A – API Contract (admin_api)

| Method | Path | Body / Params | Response |
|--------|------|---------------|----------|
| GET | `/pending?status=PENDING&limit=50` | – | `[ { id, normalized_json, ... } ]` |
| POST | `/approve/:id` | `{ edits? }` | `{ success:true, showId }` |
| POST | `/reject/:id` | `{ reason }` | `{ success:true }` |
| PATCH | `/edit/:id` | `{ normalized_json }` | `{ success:true }` |
| GET | `/sources` | – | list w/ scores |
| PATCH | `/sources/:url` | `{ priority_score }` | ok |

All endpoints require Supabase JWT with `role=admin`.

---

This document serves as the definitive blueprint for engineering the intelligent, admin-controlled scraping subsystem for Card Show Finder.  
