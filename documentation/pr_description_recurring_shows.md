# Recurring Shows & Organizer Dashboard – Pull Request

## ✨ Overview
This PR introduces full support for **recurring card-show series** and a brand-new **Organizer Dashboard**.  
Organizers can now:

* Claim an entire series (e.g. “Dallas Monthly Card Show”) instead of individual dates
* Manage every occurrence from one place
* Broadcast pre-/post-show messages with enforced quotas
* View & respond to aggregated reviews across the series

The change spans database schema, Supabase Edge Functions, TypeScript services, React-Native screens, and automated data migrations.

---

## 🔄 Database Changes (`db_migrations/`)
| File | Purpose |
|------|---------|
| `recurring_shows_schema.sql` | Creates `show_series`, adds `series_id` to `shows`, redesigns `reviews` to reference both `show_id` & `series_id`, adds broadcast-quota columns to `profiles`. |
| `data_migration_series.sql` | Groups existing shows into series (by identical name & location) and back-fills `series_id` + review aggregates.|

Key points  
* `show_series` holds the canonical record (`id, name, organizer_id, average_rating …`).  
* `shows.series_id` is **nullable** for backward compatibility.  
* New check constraints ensure a show either has an `organizer_id` *or* inherits it from its series.  
* Indexes added for `series_id`, `organizer_id`, review ratings, and quotas.

Run all SQL files in alphabetical order or follow **Migration Steps** below.

---

## ⚡️ Supabase Edge Functions (`/supabase/functions`)
1. `claim_show_series` – allows authenticated organizers to claim an unclaimed series atomically (row-level security enforced).
2. `send_broadcast_message` – validates remaining quota, writes `broadcasts` row, decrements counters in `profiles`.
3. `reset-broadcast-quotas` – scheduled daily @ 00:00 UTC to top-up organizer quotas.

Environment variables required:
```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 🧩 TypeScript Services & Helpers (`src/services/`)
* **`showSeriesService.ts`** – CRUD for series, occurrences, reviews, broadcast calls.
* **`organizerService.ts`** – `claimShow` renamed → `claimSeriesOrShow`, routes to new Edge Function.
* Transaction helpers abstract `supabase.rpc()` vs. `fetch()` calls.


---

## 🖥  Frontend Components / Screens
| File | Description |
|------|-------------|
| `screens/Organizer/OrganizerDashboardScreen.tsx` | Main dashboard with metrics & tab navigation. |
| `components/OrganizerShowsList.tsx` | Lists series, collapsible occurrences, edit/cancel actions. |
| `screens/Organizer/OrganizerReviewsScreen.tsx` | Review management with filters & inline responses. |
| `components/AddEditShowModal.tsx` | Create/edit single or recurring occurrences (weekly/bi-weekly/monthly/quarterly). |
| `screens/ShowDetail/ShowDetailScreen.tsx` | Now displays series banner and aggregated ratings. |
| `navigation/OrganizerNavigator.tsx` | Stack for all organizer flows. |
| `navigation/MainTabNavigator.tsx` | Adds “Organizer” tab with briefcase icon. |

Design tokens reused; loading, empty & error states implemented for every screen.

---

## 🚚 Migration Steps
1. **Clone latest `.env`** values.  
2. **Run SQL** (production/staging):
   ```bash
   psql $DATABASE_URL -f db_migrations/recurring_shows_schema.sql
   psql $DATABASE_URL -f db_migrations/data_migration_series.sql
   ```
3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy claim_show_series
   supabase functions deploy send_broadcast_message
   supabase functions deploy reset-broadcast-quotas
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
   ```
4. **Push mobile app** (`eas update`) or rebuild if native deps changed.

---

## 🧪 Testing Checklist
- [x] Schema migrations succeed locally & on staging
- [x] Claim unclaimed series → organizer_id populated, RLS verified
- [x] Create recurring shows via modal → correct count & dates
- [x] Broadcast sends, quotas decrement, hard stop at 0
- [x] Reviews aggregate correctly, response flow works
- [x] Dashboard metrics refresh & pull-to-refresh works
- [x] Backwards-compat: existing single shows still visible & editable

Automated Jest unit tests added for `showSeriesService` (fetch & aggregation).

---

## 🗒  Notes / Follow-ups
* Series detail & broadcast history screens are placeholders; tracked in #237 & #238.
* Consider moving time-zone handling to `luxon` for DST-safe recurrence generation.
* Cron for quota reset uses Supabase scheduled jobs (requires Tier 2).

---

Closes #131, #132, #180.  
Tagging @backend-team @mobile-team for review. 🚀
