# Admin Scraping System – Setup & Operations Guide
File: `ADMIN_SCRAPING_SETUP.md`

---

## 0. Prerequisites

* Supabase project already provisioned and the repo cloned locally  
* Supabase CLI ≥ 1.155  
* Node 18+ / Deno 1.44+ installed  
* Service‐role, anon and JWT admin keys available as env vars  
  ```bash
  export SUPABASE_URL=https://xyzcompany.supabase.co
  export SUPABASE_ANON_KEY=ey...
  export SUPABASE_SERVICE_ROLE_KEY=su...
  export GOOGLE_AI_KEY=AIza...
  ```

---

## 1. Deploy & Test – Quick Start

1. **Pull latest code**  
   ```bash
   git pull origin main
   ```

2. **Apply database migration** (details §2)  
   ```bash
   supabase db push \
     --file supabase/migrations/20250129_admin_scraping_system.sql
   ```

3. **Deploy Edge Functions**  
   ```bash
   supabase functions deploy scraper-agent
   supabase functions deploy normalizer
   supabase functions deploy admin-scraper-api
   # optionally:
   supabase functions deploy geocoder
   ```

4. **Run scraper locally (first smoke-test)**  
   ```bash
   supabase functions serve scraper-agent --no-verify-jwt
   ```

5. **Normalize results**  
   ```bash
   supabase functions serve normalizer --no-verify-jwt
   ```

6. **Call admin API** (see §3) to approve a pending row and verify it moves to `public.shows`.

---

## 2. Migration – Step-by-Step

`supabase/migrations/20250129_admin_scraping_system.sql`

1. **Safety check** – ensures `uuid-ossp` & `postgis` extensions.  
2. **Creates**  
   * `scraped_shows_pending` – staging table  
   * `admin_feedback` – audit log  
   * `scraping_sources` – master URL list  
3. **Adds** RLS policies (`is_admin()`), helper functions, approve/reject/edit RPCs.  
4. **Seeds** `scraping_sources` with sample & existing URLs.  

Run it once in **production**:

```bash
supabase db push --file supabase/migrations/20250129_admin_scraping_system.sql
# or psql -f ...
```

If you need to roll back, drop the three new tables and functions, or use Supabase migration history.

---

## 3. Admin API End-Points

Base path: `/admin-scraper-api`

| Method | Path | Purpose |
|--------|------|---------|
| GET    | /pending?status=PENDING&limit=50&offset=0 | List pending shows |
| POST   | /approve/:id | Approve & publish show |
| POST   | /reject/:id  | Reject pending show |
| PATCH  | /edit/:id    | Edit `normalized_json` |
| GET    | /sources?limit=100 | List scraping sources |
| PATCH  | /sources/:url | Update priority / enable |

### cURL Examples

```bash
# List 20 pending
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/pending?limit=20"

# Approve a show
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Looks good"}' \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/approve/8c7e..."

# Reject with reason
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Duplicate entry"}' \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/reject/8c7e..."

# Boost priority of a source
curl -X PATCH -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"priority_score":90,"notes":"High-yield site"}' \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/sources/https%3A%2F%2Fdpmsportcards.com%2Findiana-card-shows%2F"
```

All endpoints require a Supabase JWT whose profile `role = 'admin'`.

---

## 4. JSON Data Flow

1. **scraper-agent** inserts:
   ```json
   {
     "id": "uuid",
     "source_url": "https://dpmsportcards.com/...",
     "raw_payload": {
       "name": "Indy Card Show",
       "startDate": "January 5, 2025",
       "endDate": "January 5, 2025",
       "...": "..."
     },
     "status": "PENDING"
   }
   ```

2. **normalizer** fills `normalized_json`:
   ```json
   {
     "name": "Indy Card Show",
     "startDate": "2025-01-05",
     "endDate": "2025-01-05",
     "venueName": "Fairgrounds Pavilion",
     "address": "123 Main St, Indianapolis, IN",
     "state": "IN",
     "entryFee": 5,
     "normalizedAt": "2025-01-29T14:22:11Z"
   }
   ```

3. **admin-scraper-api /approve** moves the row into `public.shows`, sets `status='APPROVED'`, logs action in `admin_feedback`.

---

## 5. Testing Sample Sites

*The three starter sites were seeded with `priority_score = 90` so they run quickly.*

1. Manually trigger scraper:
   ```bash
   supabase functions invoke scraper-agent
   ```
2. Wait ~30 s, then run:
   ```bash
   supabase functions invoke normalizer
   ```
3. List pending:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_JWT" \
    "$SUPABASE_URL/functions/v1/admin-scraper-api/pending"
   ```
4. Approve one item, then confirm record exists in `public.shows`:

   ```sql
   select * from public.shows
   order by created_at desc
   limit 5;
   ```

---

## 6. Managing Sources & Priorities

* `priority_score 0-100` – higher = scraped sooner  
* `error_streak` auto-increments on failures; success resets to 0  
* Use `/sources/:url` PATCH to:
  * Disable (`enabled=false`) problem sites  
  * Raise priority for high-yield or trusted sites  
* Automatic adjustments:  
  * +2 (max +5) for every successful scrape with inserted rows  
  * ‑1 on failure  

Tip: Periodically audit with

```bash
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "$SUPABASE_URL/functions/v1/admin-scraper-api/sources?limit=300" \
  | jq .
```

---

## 7. Security & Role Setup

1. **Profiles table** must contain admin account(s) with `role='admin'`.
2. RLS policies (`admin_all_*`) allow only:
   * `is_admin()` users
   * service_role key
3. Edge functions use `SUPABASE_SERVICE_ROLE_KEY` in env – keep secret.
4. Admin UI (coming React/Expo web page) should obtain JWT via normal login, server-side JWT introspection ensures admin rights.

---

## 8. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `scraper-agent` logs `AI API Error 403` | Invalid/expired `GOOGLE_AI_KEY` | Export correct key, redeploy |
| Migration fails on `postgis` | Extension missing | Enable PostGIS in Supabase dashboard → SQL editor: `create extension postgis;` |
| Pending rows never normalize | `normalizer` not deployed or scheduler off | Deploy `normalizer`; set Cron: `*/10 * * * *` |
| Approve endpoint returns `Unauthorized` | JWT not admin | Check profile role column |
| Duplicate shows appear | Title/date/city combo differs slightly | Edit normalized_json before approve, merge manually |
| Source keeps failing & spams logs | Bot-blocked or JS-heavy site | Set `enabled=false` or move site to headless-browser queue (future work) |

---

### Need help?

* View Edge logs in Supabase > Functions > Logs  
* Slack channel `#scraper‐ops` for real-time support  
* Check `admin_feedback` table for full audit of actions  

Happy scraping!
